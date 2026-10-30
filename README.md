# ⚡ FormPilot AI

Ekstensi browser (Manifest V3) untuk **Google Chrome** dan **Brave** yang bisa:

1. **Auto Submit** — mengirim Google Form berulang lewat `fetch` (`POST` ke `/formResponse`) dengan jeda antar submit.
2. **AI Filler** — mengisi form apa pun di tab aktif memakai AI, dengan animasi pengisian (scroll + highlight + simulasi mengetik) supaya bisa kamu verifikasi.

> 🔑 **Privasi** — Ekstensi ini **TIDAK menyertakan API key apa pun**.
> Setiap pengguna memasukkan API key miliknya sendiri, dan key tersebut
> disimpan **HANYA di `chrome.storage.local` browser-mu** (tidak dikirim ke
> server mana pun selain provider AI yang kamu pilih).
> Begitu pula data form-mu (nama, email, endpoint) — semuanya lokal.

---

## 1. Menjalankan di Local (Local Installation)

### Langkah umum

1. **Clone atau download** repo ini ke PC-mu:
   ```bash
   git clone https://github.com/<username>/<nama-repo>.git
   ```
   (atau klik **Code → Download ZIP**, lalu ekstrak.)

2. Buka folder hasil clone/ekstrak — pastikan isinya `manifest.json`, `popup.html`, dst.

### Google Chrome

1. Buka `chrome://extensions/`
2. Aktifkan **Developer mode** (toggle di pojok kanan atas).
3. Klik **Load unpacked** → pilih folder repo tadi.
4. Klik ikon **FormPilot AI** (petir ungu) di toolbar, atau klik 🧩 → pin.

### Brave

1. Buka `brave://extensions/`
2. Aktifkan **Developer mode** (toggle pojok kanan atas).
3. Klik **Load unpacked** → pilih folder yang sama.
4. Ikon akan muncul di toolbar (klik 🧩 lalu pin).

> 💡 Setiap kali file kode diubah, klik tombol **🔄 reload** di kartu
> ekstensi supaya perubahan terbaca.

---

## 2. Struktur File

```
├── manifest.json    # Manifest V3 (permissions, popup, icons, service worker)
├── popup.html       # Antarmuka: tab Auto Submit / AI Filler / Konfigurasi
├── popup.js         # Logika utama: fetch loop + AI + konfigurasi
├── content.js       # Di-inject ke tab aktif: baca & isi form di DOM (animasi)
├── providers.js     # Preset provider AI (Gemini, Groq, OpenRouter, Ollama, ...)
├── background.js    # Service worker (tanpa API key bawaan)
├── options.html     # Halaman pengaturan AI lanjutan
├── options.js
├── icons/           # Logo ekstensi (icon16/32/48/128.png)
├── make_icons.ps1   # Script untuk regenerasi logo (opsional)
└── README.md
```

---

## 3. Setup AI (wajib untuk tab AI Filler)

Ekstensi **tidak menyertakan API key**. Pilih salah satu provider gratis:

| Provider | Gratis? | Daftar key di | Model yang disarankan |
| --- | --- | --- | --- |
| **Google Gemini** | ✅ | aistudio.google.com → *Get API key* | `gemini-3.8-flash`, `gemini-flash-latest`, `gemini-3.5-flash` |
| **Groq** | ✅ | console.groq.com → *API Keys* | `llama-3.3-70b-versatile` |
| **OpenRouter** | ✅ | openrouter.ai/keys | model ber-suffix `:free` |
| **Ollama (lokal)** | ✅ | tidak perlu key — install [ollama.com](https://ollama.com) | `llama3.2` |
| **OpenAI** | ❌ | platform.openai.com | `gpt-4o-mini` |

### Cara memasukkan key

1. Klik ekstensi → tab **🤖 AI Filler**.
2. Pilih **Provider** → isi **API Key** → **Model** terisi otomatis (atau pilih dari daftar).
3. Key otomatis tersimpan lokal saat kamu pindah fokus dari kolom.

Atau lewat halaman **⚙️ Opsi** (klik kanan ikon ekstensi → *Options*).

> ⚠️ **Jangan pernah** menaruh API key milikmu di kode kalau repo ini mau
> dipublikasikan. Selalu masukkan lewat UI, karena itu tersimpan lokal.

### Catatan model Gemini

Nama model `gemini-1.5-flash` dan `gemini-2.5-flash` sudah **di-retire** untuk
API key baru (error `NOT_FOUND` / `unexpected model name format`). Gunakan
`gemini-3.8-flash`, `gemini-flash-latest`, atau `gemini-3.5-flash`.
Ekstensi otomatis membersihkan input model yang salah format.

---

## 4. Pakai Tab ⚡ Auto Submit

1. Klik ekstensi → tab **⚙️ Konfigurasi**.
2. Isi:
   - **Endpoint formResponse** — `https://docs.google.com/forms/d/e/XXXX/formResponse`
   - **Mapping entry ID** (JSON) — contoh:
     ```json
     {
       "nama": "entry.111111111",
       "email": "entry.222222222",
       "usia": "entry.333333333"
     }
     ```
   - **Daftar Nama** (JSON array) — `["Budi Santoso", "Siti Aminah", ...]`
   - **Daftar Email** (JSON array, opsional) — pasangan per index
   - **Jawaban statis** (JSON object) — contoh: `{ "usia": "25-34", "posisi": "Staff" }`
3. Klik **💾 Simpan Konfigurasi**.
4. Buka tab **⚡ Auto Submit** → **▶️ Mulai Submit**.

Log akan tampil langsung:

```
Mulai submit 3x → https://docs.google.com/forms/d/e/XXXX...
Jeda antar submit: 2 detik
[1/3] ✅ Sukses submit data: Budi Santoso - budi@example.com
[2/3] ✅ Sukses submit data: Siti Aminah - siti@example.com
Selesai. Total sukses: 3/3
```

### Cara menemukan `entry.XXXXX` form-mu

1. Buka form → klik kanan elemen jawaban → **Inspect**.
2. Cari `name="entry.123456789"` pada `<input>` / `<select>`.
3. Semua opsi dalam satu pertanyaan ganda memakai `entry.X` yang sama.

Atau via DevTools Console (saat form terbuka):

```js
document.querySelectorAll("[name^=entry.]")
  .forEach(i => console.log(i.name, "→", i.closest("div").innerText.split("\n")[0]));
```

---

## 5. Pakai Tab 🤖 AI Filler

1. Buka halaman yang berisi form (di tab biasa).
2. Klik ekstensi → tab **🤖 AI Filler**.
3. Tulis instruksi, contoh:
   `isi nama Budi Santoso, email budi@example.com, posisi Staff`
4. Pilih kecepatan (🐢 Santai / ⚡ Normal / 🚀 Cepat).
5. Klik **🔍 Analisis Form** untuk melihat field terdeteksi.
6. Klik **🤖 Isi dengan AI** — field akan terisi satu per satu dengan animasi:
   - scroll ke field → glow **biru** (sedang diisi) → **hijau** (selesai)
   - HUD progress di pojok kanan bawah halaman
   - log progres live di popup
7. Verifikasi hasilnya, lalu kirim manual (atau centang **Kirim otomatis**).

### Cara kerja AI

- `content.js` mengekstrak struktur form (label, tipe, opsi pilihan).
- Struktur + instruksi dikirim ke provider AI pilihanmu.
- AI membalas JSON `[{ "index": 0, "value": "..." }]`.
- `content.js` mengisi DOM-nya satu per satu (dengan animasi).

---

## 6. Troubleshooting

| Gejala | Solusi |
| --- | --- |
| Log: *"Belum ada endpoint formResponse"* | Isi endpoint di tab ⚙️ Konfigurasi dulu |
| `HTTP 400` / form kosong | Entry ID masih dummy, atau ada field *required* yang belum dikirim |
| `Failed to fetch` | Endpoint salah, atau izin host belum ada (cek `manifest.json`) |
| `Gemini HTTP 503 (high demand)` | Server Gemini sibuk → tunggu ~30 detik, atau ganti model (`gemini-flash-latest`, `gemini-3.5-flash`) |
| `Gemini HTTP 404` / `unexpected model name format` | Nama model tidak valid/retire → pakai `gemini-3.8-flash` |
| `Gemini HTTP 400 API_KEY_INVALID` | API key salah → paste ulang dari AI Studio |
| AI tidak mengisi | Cek key/model, dan pastikan tab aktif benar-benar berisi form |
| Field tidak terisi (form multi-halaman) | Field mungkin di halaman lain → klik "Berikutnya" dulu lalu isi terpisah |
| Popup tertutup saat submit | Jangan tutup popup sampai loop selesai |

---

## 7. Keamanan & Privasi

- **API key & data form** hanya ada di `chrome.storage.local` browser-mu.
- Ekstensi hanya mengirim data ke: (a) endpoint Google Forms yang **kamu** isi, dan (b) provider AI yang **kamu** pilih.
- Untuk menghapus semua data lokal: tab **⚙️ Konfigurasi** → **🧹 Hapus Semua Data Lokal**.
- Sebelum membagikan/fork repo: pastikan tidak ada API key atau data pribadi di kode (jalankan pencarian kata kunci di seluruh folder).

---

## 8. Etika Penggunaan

- Gunakan untuk **form milikmu sendiri**, form testing, atau survei internal — **dengan izin**.
- Jangan isi formulir milik orang lain tanpa izin, apalagi kuesioner penelitian aktif (itu data fabrication).
- Hormati ToS Google dan rate-limit: jaga jeda ≥ 2 detik antar submit.
- Hormati privasi responden: jangan sebarkan data pribadi orang lain.

---

## Lisensi

MIT — silakan dipakai, dimodifikasi, dan dibagikan. Credits appreciated. ⚡
