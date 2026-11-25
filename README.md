# Ruang Kelas · SMPN 62 Surabaya

Website papan kabar kelas: info kelas, PR, jadwal ulangan, kisi-kisi, pengumuman, jadwal harian pintar, roda putar, galeri foto, laporan via WhatsApp, dan kotak saran. Semua isi website dan foto dikelola langsung melalui file `data/class-data.js` dan folder `assets/photos/` di VS Code (tanpa Dashboard dan tanpa database eksternal).

## Menjalankan di Laptop (Lokal)

Karena website ini memakai JavaScript module (`type="module"`) dan Service Worker, jangan buka `index.html` dengan klik dua kali (`file://`). Jalankan server lokal sederhana di PowerShell. Salin perintahnya saja, **jangan** ikut menyalin baris tiga backtick:

```
cd "C:\workspace\Class website Project2"
python -m http.server 8080
```

Lalu buka http://localhost:8080/ di browser. Untuk menghentikan server, tekan `Ctrl + C` di jendela PowerShell.

Untuk menjalankan tes otomatis:

```
cd "C:\workspace\Class website Project2"
node --test
```

## Isi folder

| File / folder | Gunanya |
|---|---|
| `index.html` | Satu-satunya halaman website (semua menu berpindah di dalam halaman ini) |
| `manifest.webmanifest` & `sw.js` | Konfigurasi PWA dan Service Worker untuk simpan tampilan saat offline |
| `package.json` | Hanya untuk menjalankan `node --test` (tanpa library tambahan) |
| `PROJECT_SPEC.md` | Rencana lengkap proyek (apa yang dibuat dan aturannya) |
| `HANDOFF.md` | Status terbaru, hasil tes, dan langkah selanjutnya |
| `LICENSE` | Hak cipta: All rights reserved, FarskyRF |
| `.gitignore`, `.gitattributes`, `.nojekyll` | Pengaturan Git dan GitHub Pages |
| `assets/css/styles.css` | Token warna (terang & gelap) dan seluruh tampilan |
| `assets/js/` | Kode JavaScript (`app.js`, `class-info.js`, `schedule.js`, `disc-math.js`, `gallery.js`, `wheel.js`, `reports.js`, `theme.js`, `storage.js`, `ui.js`, `utils.js`) |
| `assets/fonts/` | Font lokal (`Atkinson Hyperlegible` dan `Source Serif 4`) beserta lisensinya |
| `assets/icons/` | Ikon aplikasi (192px, 512px, maskable, dan SVG) |
| `assets/photos/` | Folder tempat menaruh foto galeri (`momen-01.jpg`, dst.) dan lampiran info kelas (`kelas/info-01.jpg`) |
| `data/class-data.js` | **File utama untuk mengedit seluruh isi website** (berisi komentar panduan bahasa Indonesia) |
| `data/default-data.json` | Salinan JSON dari `data/class-data.js` |
| `PANDUAN_EDIT_DATA.md` | Panduan lengkap cara mengedit isi website & menambah foto |
| `tests/` | Tes otomatis (`contrast.test.js`, `clock.test.js`, `storage.test.js`, `class-info.test.js`, `schedule.test.js`, `disc-math.test.js`, `wheel.test.js`, `reports.test.js`) |

## Mengunggah ke GitHub

Lakukan ini **sendiri** di PowerShell. Cukup sekali di awal. Salin perintahnya satu per satu, **tanpa** baris tiga backtick (```) di atas dan bawahnya.

### 1. Siapkan akun dan repository

1. Login ke https://github.com.
2. Klik tombol **+** di kanan atas, lalu **New repository**.
3. Isi **Repository name** tanpa spasi, misalnya `ruang-kelas`. Nama ini akan jadi bagian alamat website.
4. Pilih **Public** (GitHub Pages gratis butuh repo publik). Ingat: **semua isi repo publik bisa dilihat siapa saja.**
5. **Jangan** centang "Add a README", ".gitignore", atau "license" (kita sudah punya). Klik **Create repository**.
6. Salin alamat repo yang muncul, contohnya `https://github.com/<username>/ruang-kelas.git`.

### 2. Masuk ke folder proyek

Pakai tanda kutip karena nama folder ada spasinya:

```
cd "C:\workspace\Class website Project2"
```

### 3. Cek kondisi repo

```
git status
```

Kalau muncul `fatal: not a git repository`, jalankan dulu `git init -b main`.

### 4. (Sekali saja) Kenalkan dirimu ke Git

Ganti dengan nama dan email akun GitHub-mu:

```
git config --global user.name "FarskyRF"
git config --global user.email "email-github-kamu@contoh.com"
```

### 5. Simpan semua file ke commit pertama

```
git add .
git commit -m "Fase 0: rencana proyek dan file Git"
```

### 6. Pastikan nama branch `main`, sambungkan ke GitHub, lalu upload

Ganti `<URL>` dengan alamat repo dari langkah 1:

```
git branch -M main
git remote add origin <URL>
git push -u origin main
```

Kalau muncul jendela login GitHub, login seperti biasa. Kalau muncul `remote origin already exists`, berarti remote sudah pernah ditambahkan; cek dengan `git remote -v`.

### 7. Nyalakan GitHub Pages

1. Buka repo di GitHub, lalu klik **Settings**, lalu **Pages** (menu kiri).
2. Di **Build and deployment**, bagian **Source**, pilih **Deploy from a branch**.
3. Di **Branch**, pilih `main` dan folder `/ (root)`, lalu klik **Save**.
4. Tunggu 1 sampai 3 menit. Alamat website-mu nanti:
   `https://<username>.github.io/<repo-name>/`
   (contoh: `https://farskyrf.github.io/ruang-kelas/`)

> Di Fase 0 belum ada `index.html`, jadi alamat itu belum menampilkan website. Upload ke GitHub boleh ditunda sampai fase berikutnya.

### Upload perubahan berikutnya

Setiap kali ada perubahan baru:

```
git add .
git commit -m "Tulis singkat apa yang berubah"
git push
```

## Hak cipta

Copyright (c) 2026 FarskyRF. All rights reserved. Lihat `LICENSE`.
