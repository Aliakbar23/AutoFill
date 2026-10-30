/**
 * content.js — di-inject ke halaman aktif (on-demand, bukan declared content script)
 * Tugas:
 *  1. EXTRACT_FORM : baca semua field di halaman + label + opsi pilihan
 *  2. FILL_FORM    : isi field SATU PER SATU secara animasi (scroll + highlight +
 *                    simulasi mengetik) supaya pengguna bisa memverifikasi isian
 *  3. SUBMIT_FORM  : klik tombol kirim (opsional)
 */

(() => {
  "use strict";
  if (window.__formAutofillInjected) {
    // sudah pernah di-inject, jangan daftarkan listener dua kali
    return;
  }
  window.__formAutofillInjected = true;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // Cache referensi elemen dari ekstraksi terakhir, supaya index cocok 1:1
  let fieldCache = [];

  const SPEEDS = {
    slow: { scroll: 650, delay: 900, cps: 8 },
    normal: { scroll: 350, delay: 500, cps: 18 },
    fast: { scroll: 150, delay: 200, cps: 45 },
  };

  /* ---------------------------------------------------------------- helpers */

  const visible = (el) => {
    if (!el || !el.isConnected) return false;
    const r = el.getBoundingClientRect();
    const st = getComputedStyle(el);
    if (st.display === "none" || st.visibility === "hidden") return false;
    return r.width > 0 && r.height > 0;
  };

  const textOf = (el) => (el?.textContent || "").trim().replace(/\s+/g, " ").slice(0, 120);

  /** Tipe efektif: atribut type, atau role (Google Forms pakai div role=radio), atau tag. */
  function effectiveType(el) {
    const t = (el.getAttribute("type") || "").toLowerCase();
    if (t) return t;
    const r = (el.getAttribute("role") || "").toLowerCase();
    if (r) return r;
    return el.tagName.toLowerCase();
  }

  /** Coba temukan label teks untuk sebuah control. */
  function labelFor(el) {
    if (!el) return "";
    if (el.getAttribute("aria-label")) return el.getAttribute("aria-label").trim();
    if (el.id) {
      const lb = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (lb && textOf(lb)) return textOf(lb);
    }
    const wrap = el.closest("label");
    if (wrap && textOf(wrap)) return textOf(wrap);
    // Google Forms: label biasanya di elemen judul dekat dengan control
    const box = el.closest(
      "[role='radiogroup'], [role='group'], .freebirdFormviewerComponentsQuestionRadioRoot, div"
    );
    if (box) {
      const head = box.querySelector("[role='heading'], .M7eMe, .AgroKb, span[dir='auto']");
      if (head && textOf(head)) return textOf(head);
    }
    return el.placeholder || el.name || el.id || "";
  }

  const SELECTOR =
    "input:not([type=hidden]), select, textarea, [contenteditable=true], [role=radio], [role=checkbox], [role=combobox]";

  /* ------------------------------------------------------------------ styles */

  function ensureStyle() {
    if (document.getElementById("fa-style")) return;
    const s = document.createElement("style");
    s.id = "fa-style";
    s.textContent = `
      .fa-active {
        outline: 3px solid #4f8cff !important;
        outline-offset: 2px !important;
        box-shadow: 0 0 0 7px rgba(79, 140, 255, .28) !important;
        transition: box-shadow .18s ease !important;
      }
      .fa-done {
        outline: 3px solid #2ecc71 !important;
        outline-offset: 2px !important;
      }
      #fa-hud * { box-sizing: border-box; }
    `;
    document.documentElement.appendChild(s);
  }

  function hudEnsure() {
    let h = document.getElementById("fa-hud");
    if (h) return h;
    h = document.createElement("div");
    h.id = "fa-hud";
    Object.assign(h.style, {
      position: "fixed",
      right: "16px",
      bottom: "16px",
      zIndex: 2147483647,
      background: "#0f1115",
      color: "#e6e9ef",
      border: "1px solid #262b36",
      borderRadius: "10px",
      padding: "10px 12px",
      font: "12px/1.45 'Segoe UI', system-ui, sans-serif",
      boxShadow: "0 8px 24px rgba(0,0,0,.45)",
      maxWidth: "320px",
      opacity: "1",
      transition: "opacity .4s ease",
    });
    h.innerHTML =
      '<div id="fa-hud-title" style="font-weight:700"></div>' +
      '<div id="fa-hud-sub" style="color:#8b93a3;margin-top:2px"></div>' +
      '<div style="margin-top:8px;background:#262b36;border-radius:99px;height:5px;overflow:hidden">' +
      '<div id="fa-hud-bar" style="height:100%;width:0;background:#4f8cff;transition:width .25s ease"></div></div>';
    document.documentElement.appendChild(h);
    return h;
  }

  function hudSet(title, sub, done, total) {
    const h = hudEnsure();
    h.querySelector("#fa-hud-title").textContent = title;
    h.querySelector("#fa-hud-sub").textContent = sub || "";
    h.querySelector("#fa-hud-bar").style.width = total ? `${Math.round((done / total) * 100)}%` : "0%";
  }

  function hudFadeOut() {
    const h = document.getElementById("fa-hud");
    if (!h) return;
    h.style.opacity = "0";
    setTimeout(() => h.remove(), 500);
  }

  /* --------------------------------------------------------------- extract */

  function extractForm() {
    const nodes = Array.from(document.querySelectorAll(SELECTOR)).filter(visible);
    const fields = [];
    const seenRadio = new Set();
    let idx = 0;

    nodes.forEach((el) => {
      const type = effectiveType(el);

      // radio: satu entri per group (elemen lain di group yang sama dilewati)
      if (type === "radio") {
        const container = el.closest("[role=radiogroup]") || el.parentElement;
        const key = el.name || container;
        if (seenRadio.has(key)) return;
        seenRadio.add(key);
        const group = el.name
          ? Array.from(document.querySelectorAll(`input[name="${CSS.escape(el.name)}"]`))
          : Array.from(container.querySelectorAll("[role=radio], input[type=radio]"));
        const g = group.length ? group : [el];
        fields.push({
          index: idx++,
          tag: el.tagName.toLowerCase(),
          type: "radio",
          name: el.name || "",
          id: el.id || "",
          placeholder: "",
          label: labelFor(g[0]) || labelFor(el),
          value: "",
          options: g
            .map((x) => x.getAttribute("aria-label") || labelFor(x) || x.value || textOf(x))
            .filter(Boolean),
          _el: g[0],
          _els: g,
        });
        return;
      }

      const field = {
        index: idx++,
        tag: el.tagName.toLowerCase(),
        type,
        name: el.name || "",
        id: el.id || "",
        placeholder: el.placeholder || "",
        label: labelFor(el),
        value: el.value ?? textOf(el),
        _el: el,
        _els: [el],
      };

      if (el.tagName === "SELECT") {
        field.options = Array.from(el.options).map((o) => o.textContent.trim()).filter(Boolean);
      } else if (type === "checkbox") {
        field.options = [el.getAttribute("aria-label") || labelFor(el) || "centang"];
        field.value = el.checked ? field.options[0] : "";
      }

      fields.push(field);
    });

    fieldCache = fields;

    // kembalikan salinan tanpa referensi DOM (tidak bisa dikirim via message)
    return {
      url: location.href,
      title: document.title,
      fields: fields.map(({ _el, _els, ...rest }) => rest),
    };
  }

  /* ------------------------------------------------------------------ fill */

  function setNativeValue(el, value) {
    const proto =
      el instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : el instanceof HTMLSelectElement
          ? HTMLSelectElement.prototype
          : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    if (setter) setter.call(el, value);
    else el.value = value;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  /** Simulasi mengetik: nilai bertambah bertahap supaya terlihat bergerak. */
  async function typeValue(el, value, cps) {
    const len = value.length;
    const chunks = Math.min(14, Math.max(1, len));
    const stepLen = Math.ceil(len / chunks);
    const stepMs = Math.max(12, Math.round(1000 / (cps * stepLen)));
    for (let i = stepLen; i < len; i += stepLen) {
      setNativeValue(el, value.slice(0, i));
      await sleep(stepMs);
    }
    setNativeValue(el, value);
  }

  function mark(el, cls) {
    if (!el) return;
    el.classList.add(cls);
    setTimeout(() => el.classList.remove(cls), cls === "fa-done" ? 1400 : 1e9);
  }

  /** Cari opsi radio/checkbox yang paling cocok dengan value dari AI. */
  function matchOption(group, want) {
    const w = String(want).toLowerCase().trim();
    for (const g of group) {
      const l = (g.getAttribute("aria-label") || labelFor(g) || g.value || textOf(g) || "")
        .toLowerCase()
        .trim();
      if (l && (l === w || l.includes(w) || w.includes(l))) return g;
    }
    return null;
  }

  async function fillField(f, value, speed) {
    const el = f._el;
    if (!el || !el.isConnected || !visible(el)) {
      return { index: f.index, ok: false, label: f.label, reason: "elemen tidak terlihat (mungkin di halaman form lain)" };
    }

    // 1. scroll ke tengah layar biar kelihatan
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    await sleep(speed.scroll);

    // 2. highlight biru = sedang diisi
    mark(el, "fa-active");
    hudSet(
      `Mengisi ${f.index + 1}: ${f.label || f.name || f.id}`,
      `→ ${value}`,
      f.index,
      fieldCache.length
    );

    const t = f.type;
    try {
      if (t === "radio" || t === "checkbox") {
        const target = matchOption(f._els, value);
        if (!target) {
          return {
            index: f.index,
            ok: false,
            label: f.label,
            reason: `opsi "${value}" tidak ada (tersedia: ${f.options.join(", ")})`,
          };
        }
        await sleep(180);
        target.click();
        await sleep(150);
        mark(target, "fa-done");
      } else if (t === "select") {
        const opt = Array.from(el.options).find(
          (o) =>
            o.textContent.toLowerCase().trim() === String(value).toLowerCase().trim() ||
            o.value.toLowerCase().trim() === String(value).toLowerCase().trim()
        );
        if (!opt) {
          return {
            index: f.index,
            ok: false,
            label: f.label,
            reason: `opsi "${value}" tidak ada di dropdown`,
          };
        }
        setNativeValue(el, opt.value);
        mark(el, "fa-done");
      } else if (el.isContentEditable) {
        el.textContent = "";
        await typeValue(el, value, speed.cps);
        el.dispatchEvent(new InputEvent("input", { bubbles: true }));
        mark(el, "fa-done");
      } else {
        setNativeValue(el, "");
        await typeValue(el, value, speed.cps);
        mark(el, "fa-done");
      }
      return { index: f.index, ok: true, label: f.label, value: String(value) };
    } catch (err) {
      return { index: f.index, ok: false, label: f.label, reason: err.message };
    }
  }

  function progress(text) {
    try {
      const p = chrome.runtime.sendMessage({ type: "FILL_PROGRESS", text });
      if (p && p.catch) p.catch(() => {});
    } catch (_) {
      /* popup sudah tertutup — abaikan */
    }
  }

  async function fillFormAnimated(answers, speedKey) {
    ensureStyle();
    const speed = SPEEDS[speedKey] || SPEEDS.normal;
    const results = [];
    const total = answers.length;

    hudSet("AI Filler", `Menyiapkan ${total} field…`, 0, total);
    await sleep(300);

    for (let i = 0; i < total; i++) {
      const a = answers[i];
      const f = fieldCache.find((x) => x.index === a.index);
      if (!f) {
        results.push({ index: a.index, ok: false, reason: "field tidak ditemukan di halaman ini" });
        progress(`⚠️ #${a.index} tidak ditemukan di halaman ini`);
        continue;
      }
      const r = await fillField(f, a.value, speed);
      results.push(r);
      if (r.ok) {
        progress(`✅ ${r.label || "#" + r.index} = ${r.value}`);
      } else {
        progress(`❌ ${r.label || "#" + r.index}: ${r.reason}`);
      }
      // jeda antar field supaya mudah diikuti
      if (i < total - 1) await sleep(speed.delay);
    }

    const okCount = results.filter((r) => r.ok).length;
    hudSet(
      okCount === total ? "✅ Semua terisi" : `⚠️ ${okCount}/${total} terisi`,
      "Verifikasi isian sebelum mengirim",
      total,
      total
    );
    setTimeout(hudFadeOut, 2600);

    return { results };
  }

  /* ---------------------------------------------------------------- submit */

  function submitForm() {
    const btn = document.querySelector("input[type=submit], button[type=submit]");
    const alt = Array.from(document.querySelectorAll("div[role=button], button"))
      .filter(visible)
      .find((b) => /^(kirim|submit|send|berikutnya|next|save)$/i.test(textOf(b)));
    const target = btn || alt;
    if (target) {
      mark(target, "fa-active");
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      target.click();
      return { ok: true, clicked: textOf(target) || "submit" };
    }
    return { ok: false, reason: "tombol kirim tidak ditemukan" };
  }

  /* ---------------------------------------------------------------- listener */

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === "EXTRACT_FORM") {
      sendResponse(extractForm());
      return true;
    }
    if (msg?.type === "FILL_FORM") {
      // async: jawab lewat sendResponse setelah animasi selesai
      fillFormAnimated(msg.answers || [], msg.speed).then(sendResponse);
      return true;
    }
    if (msg?.type === "SUBMIT_FORM") {
      sendResponse(submitForm());
      return true;
    }
  });
})();
