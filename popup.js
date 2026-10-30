/**
 * popup.js — logika utama ekstensi
 * Bagian 1: AUTO SUBMIT Google Form via fetch (fetch API + URLSearchParams)
 * Bagian 2: AI FILLER — membaca form di tab aktif, mengisi lewat AI
 */

/* ==========================================================================
 *  KONFIGURASI — UBAH DI SINI SAJA (atau lewat tab ⚙️ Konfigurasi)
 *  Semua nilai di bawah KOSONG/TEMPLATE. Isi dengan datamu sendiri.
 *  ======================================================================== */

// 1) Endpoint formResponse form-mu.
//    Contoh: "https://docs.google.com/forms/d/e/XXXXX/formResponse"
const FORM_URL = "";

// 2) ID pertanyaan (entry.XXXXX) — TEMPLATE DUMMY, ganti dengan ID asli milikmu.
//    Cara menemukan ID asli: buka form → Inspect → cari name="entry.XXXXX"
//    di elemen input. Atau buka tab ⚙️ Konfigurasi untuk mengedit JSON-nya.
const ENTRY_IDS = {
  nama: "entry.000000001",       // pertanyaan teks: Nama
  email: "entry.000000002",      // pertanyaan teks: Email (opsional)
  usia: "entry.000000003",       // pilihan: Usia
  lamaKerja: "entry.000000004",  // pilihan: Lama kerja
  jamKerja: "entry.000000005",   // pilihan: Jam kerja per hari
  posisi: "entry.000000006",     // pilihan: Posisi
};

// 3) Daftar responden (pairing 1-to-1: nama[i] ↔ email[i]) — ISI SENDIRI
const LIST_NAMA = [];

const LIST_EMAIL = [];

// 4) Jawaban statis yang sama untuk semua iterasi — ISI SENDIRI
//    Contoh: { usia: "25-34", posisi: "Staff" }
const STATIC_ANSWERS = {};

// 5) Jeda antar submit (ms) — hindari rate-limit
const DELAY_MS = 2000;

// 6) Kalau true, field email ikut dikirim (nonaktif kalau form tidak punya email)
const SEND_EMAIL = false;

/* ==========================================================================
 *  UTIL
 *  ======================================================================== */

const $ = (id) => document.getElementById(id);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function log(elId, msg, cls = "") {
  const el = $(elId);
  const line = document.createElement("div");
  if (cls) line.className = cls;
  line.textContent = msg;
  el.appendChild(line);
  el.scrollTop = el.scrollHeight;
}

function clearLog(elId) {
  $(elId).innerHTML = "";
}

/* ==========================================================================
 *  TAB UI
 *  ======================================================================== */

document.querySelectorAll(".tab").forEach((t) => {
  t.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((x) => x.classList.remove("active"));
    document.querySelectorAll("section").forEach((x) => x.classList.remove("active"));
    t.classList.add("active");
    $("tab-" + t.dataset.tab).classList.add("active");
  });
});

/* ==========================================================================
 *  BAGIAN 1 — AUTO SUBMIT
 *  ======================================================================== */

/** Susun payload satu iterasi dari data responden ke-i. */
function buildPayload(i) {
  const p = new URLSearchParams();
  p.append(ENTRY_IDS.nama, LIST_NAMA[i]);
  if (SEND_EMAIL && ENTRY_IDS.email && LIST_EMAIL[i]) p.append(ENTRY_IDS.email, LIST_EMAIL[i]);
  // jawaban statis — kirim hanya yang punya nilai
  for (const [key, val] of Object.entries(STATIC_ANSWERS)) {
    if (ENTRY_IDS[key] && val) p.append(ENTRY_IDS[key], String(val));
  }
  return p;
}

let stopFlag = false;

async function runAutoSubmit() {
  clearLog("log");
  stopFlag = false;

  // --- validasi konfigurasi sebelum jalan ---
  if (!FORM_URL) {
    log("log", "❌ Belum ada endpoint formResponse.", "err");
    log("log", 'Buka tab ⚙️ Konfigurasi → isi "Endpoint formResponse" → Simpan.', "muted");
    return;
  }
  if (LIST_NAMA.length === 0) {
    log("log", "❌ Daftar nama masih kosong.", "err");
    log("log", 'Buka tab ⚙️ Konfigurasi → isi "Daftar Nama" (JSON array) → Simpan.', "muted");
    return;
  }

  const total = SEND_EMAIL && LIST_EMAIL.length
    ? Math.min(LIST_NAMA.length, LIST_EMAIL.length)
    : LIST_NAMA.length;
  if (SEND_EMAIL && LIST_EMAIL.length && LIST_NAMA.length !== LIST_EMAIL.length) {
    log("log", `⚠️ Panjang daftar nama (${LIST_NAMA.length}) ≠ email (${LIST_EMAIL.length}). Dipakai ${total}.`, "warn");
  }

  $("btnStart").disabled = true;
  $("btnStop").disabled = false;

  log("log", `Mulai submit ${total}x → ${FORM_URL.slice(0, 60)}...`, "muted");
  log("log", `Jeda antar submit: ${DELAY_MS / 1000} detik`, "muted");

  let sukses = 0;
  for (let i = 0; i < total; i++) {
    if (stopFlag) {
      log("log", "⏹ Dihentikan oleh pengguna.", "warn");
      break;
    }

    const payload = buildPayload(i);

    try {
      const res = await fetch(FORM_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
        body: payload.toString(),
        mode: "cors",
        credentials: "omit",
        redirect: "follow",
      });

      if (res.ok || res.status === 200 || res.status === 302) {
        sukses++;
        const kontak = SEND_EMAIL && LIST_EMAIL[i] ? ` - ${LIST_EMAIL[i]}` : "";
        log("log", `[${i + 1}/${total}] ✅ Sukses submit data: ${LIST_NAMA[i]}${kontak}`, "ok");
      } else {
        log("log", `[${i + 1}/${total}] ⚠️ HTTP ${res.status} — cek entry ID / required field.`, "warn");
      }
    } catch (err) {
      log("log", `[${i + 1}/${total}] ❌ Gagal: ${err.message}`, "err");
    }

    // jeda 2 detik di akhir iterasi (kecuali iterasi terakhir)
    if (i < total - 1 && !stopFlag) await sleep(DELAY_MS);
  }

  log("log", `Selesai. Total sukses: ${sukses}/${total}`, "ok");
  $("btnStart").disabled = false;
  $("btnStop").disabled = true;
}

$("btnStart").addEventListener("click", runAutoSubmit);
$("btnStop").addEventListener("click", () => {
  stopFlag = true;
});

/* ==========================================================================
 *  BAGIAN 2 — AI FILLER (tab aktif)
 *  ======================================================================== */

// Progres live dari content.js selama animasi pengisian berjalan.
chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === "FILL_PROGRESS") {
    const cls = msg.text.startsWith("✅") ? "ok" : msg.text.startsWith("⚠️") ? "warn" : "err";
    log("logAi", "   " + msg.text, cls);
  }
});

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error("Tidak ada tab aktif.");
  return tab;
}

async function injectContent(tabId) {
  await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
}

async function sendToTab(tabId, msg) {
  return chrome.tabs.sendMessage(tabId, msg);
}

$("btnAnalyze").addEventListener("click", async () => {
  clearLog("logAi");
  try {
    const tab = await getActiveTab();
    await injectContent(tab.id);
    const data = await sendToTab(tab.id, { type: "EXTRACT_FORM" });
    log("logAi", `📄 ${data.title}`, "muted");
    log("logAi", `Ditemukan ${data.fields.length} field:`, "muted");
    data.fields.forEach((f) => {
      const opt = f.options?.length ? `  [opsi: ${f.options.slice(0, 4).join(", ")}${f.options.length > 4 ? ", …" : ""}]` : "";
      log("logAi", `  • #${f.index} ${f.label || f.name || f.id} (${f.type})${opt}`);
    });
  } catch (e) {
    log("logAi", "❌ " + e.message, "err");
  }
});

$("btnFill").addEventListener("click", async () => {
  clearLog("logAi");
  const prompt = $("aiPrompt").value.trim();
  if (!prompt) return log("logAi", "⚠️ Tulis instruksi dulu.", "warn");

  const provider = $("aiProvider").value;
  const apiKey = $("aiKey").value.trim();
  const model = $("aiModel").value.trim();

  // validasi: Ollama tidak butuh key, lainnya wajib
  const preset = AI_PROVIDERS[provider] || AI_PROVIDERS.custom;
  if (preset.needsKey && !apiKey) {
    return log("logAi", `⚠️ API key belum diisi untuk ${preset.label}.`, "warn");
  }

  // tampilkan peringatan config (mis. model milik provider lain)
  const cfg = resolveAIConfig({ aiProvider: provider, aiKey: apiKey, aiModel: model }, provider);
  cfg.warnings.forEach((w) => log("logAi", "⚠️ " + w, "warn"));
  log("logAi", `Using: ${preset.kind} · ${cfg.model} @ ${cfg.baseURL}`, "muted");

  try {
    const tab = await getActiveTab();
    await injectContent(tab.id);
    const schema = await sendToTab(tab.id, { type: "EXTRACT_FORM" });
    if (!schema.fields.length) return log("logAi", "⚠️ Tidak ada field terdeteksi di tab ini.", "warn");

    log("logAi", `🔎 Menganalisis ${schema.fields.length} field dengan AI…`, "muted");
    const answers = await askAI(provider, apiKey, model, prompt, schema);

    log("logAi", "🤖 AI menjawab — mulai mengisi satu per satu:", "muted");
    answers.forEach((a) => log("logAi", `  • rencana #${a.index} = ${a.value}`));

    // isi dengan animasi (scroll + highlight + simulasi ketik di halaman)
    const speed = $("aiSpeed").value;
    const fillRes = await sendToTab(tab.id, { type: "FILL_FORM", answers, speed });

    const okCount = fillRes.results.filter((r) => r.ok).length;
    log("logAi", "── Hasil akhir ──", "muted");
    fillRes.results.forEach((r) => {
      if (r.ok) log("logAi", `✅ #${r.index} ${r.label || ""} = ${r.value}`, "ok");
      else log("logAi", `❌ #${r.index} gagal: ${r.reason}`, "err");
    });
    log("logAi", `Terisi ${okCount}/${fillRes.results.length} field.`, okCount === fillRes.results.length ? "ok" : "warn");

    if ($("aiAutoSubmit").checked) {
      const sub = await sendToTab(tab.id, { type: "SUBMIT_FORM" });
      log("logAi", sub.ok ? `📤 Form dikirim (tombol: ${sub.clicked})` : `⚠️ ${sub.reason}`, sub.ok ? "ok" : "warn");
    }
  } catch (e) {
    log("logAi", "❌ " + e.message, "err");
  }
});

/**
 * Panggil AI provider. Selalu minta balasan JSON murni berupa
 * [{ "index": <int>, "value": "<string>" }, ...]
 */
async function askAI(provider, apiKey, model, instruction, schema) {
  const sys =
    "You are a form-filling assistant. Given the JSON schema of a web form " +
    "and a user instruction, return ONLY a JSON array of answers. Each item: " +
    '{"index": <field index from schema>, "value": "<answer>"}. ' +
    "For select/radio/checkbox fields, value MUST be one of the provided options " +
    "(exact text). For text fields, use plain text. Do not invent new fields, " +
    "do not add explanations, no markdown fences.";

  const userMsg = `INSTRUCTION:\n${instruction}\n\nFORM SCHEMA:\n${JSON.stringify(schema.fields, null, 1)}`;

  const ai = resolveAIConfig({ aiProvider: provider, aiKey: apiKey, aiModel: model }, provider);

  let raw;
  if (ai.kind === "gemini") {
    const url = `${ai.baseURL}/models/${ai.model}:generateContent?key=${encodeURIComponent(ai.key)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: sys + "\n\n" + userMsg }] }],
        generationConfig: { temperature: 0.2 },
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      let hint = "";
      if (res.status === 404) {
        hint = `\n→ Model "${ai.model}" tidak tersedia untuk key-mu. Coba: gemini-3.8-flash / gemini-flash-latest`;
      } else if (res.status === 400 || /API_KEY_INVALID/.test(body)) {
        hint = `\n→ Cek API key Gemini-mu (harus diawali "AIza...")`;
      } else if (res.status === 429) {
        hint = `\n→ Rate limit. Tunggu sebentar lalu coba lagi.`;
      }
      throw new Error(`Gemini HTTP ${res.status}: ${body.slice(0, 200)}${hint}`);
    }
    const data = await res.json();
    raw = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    if (!raw) throw new Error("Gemini mengembalikan respons kosong (kemungkinan diblokir filter).");
  } else {
    // openai / groq / openrouter / ollama / custom (semua OpenAI-compatible)
    const headers = { "Content-Type": "application/json" };
    if (ai.key) headers.Authorization = `Bearer ${ai.key}`;
    const res = await fetch(`${ai.baseURL}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: ai.model,
        temperature: 0.2,
        messages: [
          { role: "system", content: sys },
          { role: "user", content: userMsg },
        ],
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      let hint = "";
      if (res.status === 404) {
        hint = `\n→ Model "${ai.model}" tidak ditemukan di ${ai.baseURL}. Cek daftar model provider-mu.`;
      } else if (res.status === 401 || res.status === 403) {
        hint = `\n→ API key ditolak. Pastikan key sesuai provider yang dipilih.`;
      } else if (/ECONNREFUSED|Failed to fetch|NetworkError/i.test(body)) {
        hint = `\n→ Tidak bisa konek. Pastikan Ollama sudah jalan: jalankan "ollama serve".`;
      }
      throw new Error(`AI HTTP ${res.status}: ${body.slice(0, 200)}${hint}`);
    }
    const data = await res.json();
    raw = data.choices?.[0]?.message?.content || "";
  }

  return parseAnswers(raw);
}

/** Parser longgar: dukung JSON murni, JSON di dalam ```json fences, atau teks biasa. */
function parseAnswers(raw) {
  const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start === -1 || end === -1) throw new Error("AI tidak mengembalikan JSON array.\n" + raw.slice(0, 200));
  const arr = JSON.parse(cleaned.slice(start, end + 1));
  if (!Array.isArray(arr)) throw new Error("Format jawaban AI tidak valid.");
  return arr
    .filter((x) => x && Number.isInteger(Number(x.index)) && x.value !== undefined)
    .map((x) => ({ index: Number(x.index), value: String(x.value) }));
}

/* ==========================================================================
 *  BAGIAN 3 — KONFIGURASI (override lokal via chrome.storage)
 *  ======================================================================== */

async function loadConfigIntoUI() {
  const stored = await chrome.storage.local.get([
    "FORM_URL", "ENTRY_IDS", "LIST_NAMA", "LIST_EMAIL", "STATIC_ANSWERS", "DELAY_MS",
    "aiProvider", "aiKey", "aiModel", "aiConfig", "customBaseURL",
  ]);

  $("cfgUrl").value = stored.FORM_URL || FORM_URL;
  $("cfgDelay").value = stored.DELAY_MS || DELAY_MS;
  $("cfgNama").value = JSON.stringify(stored.LIST_NAMA || LIST_NAMA, null, 1);
  $("cfgEmail").value = JSON.stringify(stored.LIST_EMAIL || LIST_EMAIL, null, 1);
  $("cfgStatic").value = JSON.stringify(stored.STATIC_ANSWERS || STATIC_ANSWERS, null, 1);
  $("cfgEntry").value = JSON.stringify(stored.ENTRY_IDS || ENTRY_IDS, null, 1);

  $("aiProvider").value = stored.aiProvider || "gemini";
  applyProviderToUI(stored);

  $("autoSummary").textContent = `Target: ${(stored.FORM_URL || FORM_URL).replace(/\/formResponse$/, "")}`;
}

/** Sinkronkan dropdown provider → kolom key/model/hint sesuai preset. */
function applyProviderToUI(stored) {
  const key = $("aiProvider").value;
  const preset = AI_PROVIDERS[key] || AI_PROVIDERS.custom;
  const cfg = resolveAIConfig(stored || {}, key);

  // isi kolom key & model dari config tersimpan (fallback: preset)
  $("aiKey").value = cfg.key || "";
  $("aiKey").disabled = !preset.needsKey;
  $("aiKey").placeholder = preset.needsKey ? "API key…" : "Tidak butuh API key";
  $("keyHint").textContent = preset.keyHint || "";

  $("aiModel").value = cfg.model || "";
  $("aiModel").placeholder = preset.defaultModel || "nama-model";
  $("modelHint").textContent = cfg.model
    ? `Base URL: ${cfg.baseURL}`
    : `Base URL: ${cfg.baseURL} · model default: ${preset.defaultModel}`;

  // daftar saran model
  const dl = $("modelList");
  dl.innerHTML = "";
  (preset.models || []).forEach((m) => {
    const o = document.createElement("option");
    o.value = m;
    dl.appendChild(o);
  });
}

$("aiProvider").addEventListener("change", async () => {
  const stored = await chrome.storage.local.get(["aiProvider", "aiKey", "aiModel", "aiConfig", "customBaseURL"]);
  await chrome.storage.local.set({ aiProvider: $("aiProvider").value });
  applyProviderToUI(stored);
});

$("aiKey").addEventListener("change", async () => {
  const key = $("aiProvider").value;
  const { aiConfig = {} } = await chrome.storage.local.get("aiConfig");
  aiConfig[key] = { ...(aiConfig[key] || {}), key: $("aiKey").value.trim() };
  await chrome.storage.local.set({ aiConfig });
});

$("aiModel").addEventListener("change", async () => {
  const key = $("aiProvider").value;
  const { aiConfig = {} } = await chrome.storage.local.get("aiConfig");
  const clean = sanitizeModel($("aiModel").value);
  aiConfig[key] = { ...(aiConfig[key] || {}), model: clean };
  await chrome.storage.local.set({ aiConfig });
  $("aiModel").value = clean; // tampilkan versi sudah bersih
});

$("btnSaveCfg").addEventListener("click", async () => {
  try {
    const patch = {
      FORM_URL: $("cfgUrl").value.trim(),
      DELAY_MS: Math.max(0, Number($("cfgDelay").value) || DELAY_MS),
      LIST_NAMA: JSON.parse($("cfgNama").value),
      LIST_EMAIL: JSON.parse($("cfgEmail").value),
      STATIC_ANSWERS: JSON.parse($("cfgStatic").value),
      ENTRY_IDS: JSON.parse($("cfgEntry").value),
    };
    await chrome.storage.local.set(patch);
    log("logCfg", "✅ Konfigurasi tersimpan. Muat ulang popup untuk berlaku di tab Auto Submit.", "ok");
  } catch (e) {
    log("logCfg", "❌ JSON tidak valid: " + e.message, "err");
  }
});

$("lnkOptions").addEventListener("click", (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

// 🧹 Hapus SEMUA data lokal (API key, nama, email, endpoint) dari browser ini
$("btnWipe").addEventListener("click", async () => {
  const yakin = confirm(
    "Hapus semua data lokal ekstensi ini?\n\n" +
      "• API key semua provider\n" +
      "• Daftar nama & email\n" +
      "• Endpoint & entry ID form\n\n" +
      "Tindakan ini tidak bisa dibatalkan."
  );
  if (!yakin) return;
  await chrome.storage.local.clear();
  clearLog("logCfg");
  log("logCfg", "🧹 Semua data lokal berhasil dihapus. Muat ulang popup.", "ok");
  // muat ulang UI dengan nilai default (kosong)
  setTimeout(() => loadConfigIntoUI(), 400);
});

loadConfigIntoUI();
