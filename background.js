/**
 * background.js — service worker.
 *
 * TIDAK menyimpan API key apa pun. Setiap pengguna memasukkan API key
 * miliknya sendiri lewat popup (tab AI Filler) atau halaman Opsi.
 * Key disimpan HANYA di chrome.storage.local browser masing-masing.
 */

chrome.runtime.onInstalled.addListener(async () => {
  const cur = await chrome.storage.local.get(["aiProvider", "aiConfig"]);
  const patch = {};

  // provider default = gemini (gratis), TANPA key bawaan
  if (!cur.aiProvider) patch.aiProvider = "gemini";
  if (!cur.aiConfig) {
    patch.aiConfig = {
      gemini: { model: "gemini-3.8-flash" },
    };
  }

  if (Object.keys(patch).length) await chrome.storage.local.set(patch);
});
