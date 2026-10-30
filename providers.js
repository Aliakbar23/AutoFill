/**
 * providers.js — preset provider AI bersama (dipakai popup.js & options.js)
 *
 * Setiap provider punya:
 *   kind       : "gemini" (format Google) atau "openai" (format /chat/completions)
 *   baseURL    : endpoint dasar
 *   defaultModel : dipakai kalau kolom Model kosong
 *   models     : daftar saran yang ditawarkan (datalist)
 *   needsKey   : false = tidak butuh API key (mis. Ollama lokal)
 */

const AI_PROVIDERS = {
  gemini: {
    label: "Google Gemini — gratis ✅",
    kind: "gemini",
    baseURL: "https://generativelanguage.googleapis.com/v1beta",
    defaultModel: "gemini-3.8-flash",
    models: [
      "gemini-3.8-flash",
      "gemini-flash-latest",
      "gemini-3.5-flash",
      "gemini-3.5-flash-lite",
      "gemini-3.7-flash",
      "gemini-3.6-flash",
    ],
    needsKey: true,
    keyHint: "Buka aistudio.google.com → Get API key",
  },
  openai: {
    label: "OpenAI",
    kind: "openai",
    baseURL: "https://api.openai.com/v1",
    defaultModel: "gpt-4o-mini",
    models: ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini"],
    needsKey: true,
    keyHint: "platform.openai.com → API keys",
  },
  groq: {
    label: "Groq — gratis, super cepat ✅",
    kind: "openai",
    baseURL: "https://api.groq.com/openai/v1",
    defaultModel: "llama-3.3-70b-versatile",
    models: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "gemma2-9b-it"],
    needsKey: true,
    keyHint: "console.groq.com → API Keys",
  },
  openrouter: {
    label: "OpenRouter — gratis (:free) ✅",
    kind: "openai",
    baseURL: "https://openrouter.ai/api/v1",
    defaultModel: "meta-llama/llama-3.3-70b-instruct:free",
    models: [
      "meta-llama/llama-3.3-70b-instruct:free",
      "deepseek/deepseek-chat-v3-0324:free",
      "google/gemma-3-27b-it:free",
    ],
    needsKey: true,
    keyHint: "openrouter.ai/keys",
  },
  ollama: {
    label: "Ollama — lokal, 100% offline ✅",
    kind: "openai",
    baseURL: "http://localhost:11434/v1",
    defaultModel: "llama3.2",
    models: ["llama3.2", "qwen2.5:3b", "phi3"],
    needsKey: false,
    keyHint: "Tidak butuh API key (jalan di PC kamu)",
  },
  custom: {
    label: "Custom (OpenAI-compatible)",
    kind: "openai",
    baseURL: "",
    defaultModel: "",
    models: [],
    needsKey: true,
    keyHint: "Isi Base URL sendiri di halaman Opsi",
  },
};

/** Buang prefix "models/" dan spasi nyasar dari nama model. */
function sanitizeModel(raw) {
  return String(raw || "")
    .replace(/^\s*models\//i, "")
    .replace(/\s+/g, "")
    .trim();
}

/** Pola nama model yang "nyasar" — dipakai provider A tapi namanya milik provider B. */
const FOREIGN_MODEL_RE = {
  gemini: /^(gpt|o[134]-|\d+$|llama|deepseek|qwen|mistral|grok|claude|command|gemma)/i,
  openai: /^gemini-/i,
};

/**
 * Gabungkan config tersimpan + preset + sanitasi.
 * @param {object} stored  hasil chrome.storage.local
 * @param {string} key     salah satu kunci AI_PROVIDERS
 * @returns {{kind,baseURL,model,key,needsKey,warnings:string[]}}
 */
function resolveAIConfig(stored, key) {
  const preset = AI_PROVIDERS[key] || AI_PROVIDERS.custom;
  const warnings = [];

  // dukung format lama (aiKey/aiModel) kalau config per-provider belum ada
  const legacy = key === stored.aiProvider;
  const saved = (stored.aiConfig && stored.aiConfig[key]) || {};
  const rawKey = saved.key || (legacy ? stored.aiKey || "" : "");
  const rawModel = saved.model || (legacy ? stored.aiModel || "" : "");
  const rawBase = saved.baseURL || (key === "custom" ? stored.customBaseURL || "" : "");

  let model = sanitizeModel(rawModel) || preset.defaultModel;

  // deteksi model milik provider lain
  const re = FOREIGN_MODEL_RE[preset.kind];
  if (re && rawModel && re.test(sanitizeModel(rawModel))) {
    warnings.push(
      `Nama model "${sanitizeModel(rawModel)}" bukan model ${preset.kind === "gemini" ? "Gemini" : "OpenAI-compatible"}. ` +
        `Dipakai default: ${model}`
    );
  }

  const baseURL = (rawBase || preset.baseURL).replace(/\/+$/, "");

  return {
    kind: preset.kind,
    baseURL,
    model,
    key: rawKey,
    needsKey: preset.needsKey,
    warnings,
  };
}
