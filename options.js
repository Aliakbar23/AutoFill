const $ = (id) => document.getElementById(id);

/** Simpan config lama per-provider (key/model dipisah tiap provider). */
async function load() {
  const s = await chrome.storage.local.get(["aiProvider", "aiConfig", "aiKey", "aiModel", "customBaseURL"]);
  $("provider").value = s.aiProvider || "gemini";
  applyUI(s);
}

function applyUI(stored) {
  const key = $("provider").value;
  const preset = AI_PROVIDERS[key] || AI_PROVIDERS.custom;
  const cfg = resolveAIConfig(stored || {}, key);

  $("key").value = cfg.key || "";
  $("key").disabled = !preset.needsKey;
  $("key").placeholder = preset.needsKey ? "API key…" : "Tidak butuh API key";
  $("keyHint").textContent = preset.keyHint || "";

  $("model").value = cfg.model || "";
  $("model").placeholder = preset.defaultModel || "nama-model";
  $("modelHint").textContent = `Base URL: ${cfg.baseURL}`;

  const dl = $("modelList");
  dl.innerHTML = "";
  (preset.models || []).forEach((m) => {
    const o = document.createElement("option");
    o.value = m;
    dl.appendChild(o);
  });

  // base URL hanya relevan untuk provider custom
  $("baseURL").disabled = key !== "custom";
  $("baseURL").value = key === "custom" ? cfg.baseURL : "";
}

$("provider").addEventListener("change", async () => {
  const s = await chrome.storage.local.get(["aiProvider", "aiConfig", "aiKey", "aiModel", "customBaseURL"]);
  applyUI(s);
});

$("save").addEventListener("click", async () => {
  const key = $("provider").value;
  const s = await chrome.storage.local.get(["aiConfig"]);
  const aiConfig = s.aiConfig || {};
  aiConfig[key] = {
    ...(aiConfig[key] || {}),
    key: $("key").value.trim(),
    model: sanitizeModel($("model").value),
    baseURL: key === "custom" ? $("baseURL").value.trim() : undefined,
  };
  await chrome.storage.local.set({ aiProvider: key, aiConfig });
  $("status").textContent = `✅ Tersimpan untuk ${key}.`;
  setTimeout(() => ($("status").textContent = ""), 2500);
});

load();
