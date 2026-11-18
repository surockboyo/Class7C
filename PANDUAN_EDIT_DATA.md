# Panduan Mengedit Isi Website & Menambah Foto (Tanpa Dashboard)

Website **Ruang Kelas (SMPN 62 Surabaya)** ini dirancang supaya kamu bisa mengubah **semua isinya langsung dari file di VS Code**, tanpa perlu login Dashboard dan tanpa perlu menyiapkan database rumit.

Setiap kali kamu mengubah file ini lalu melakukan `git push` ke GitHub, semua HP teman sekelasmu yang membuka website akan langsung melihat perubahan terbarunya.

---

## 1. File Apa yang Harus Diedit?

Buka file ini di VS Code:
- **`data/class-data.js`** ← **Satu-satunya file untuk mengubah seluruh isi website.**

Di dalam `data/class-data.js` sudah ada petunjuk berbahasa Indonesia di setiap bagian (`// ...`).

---

## 2. Cara Menambah atau Mengganti Foto

Semua foto disimpan di dalam folder **`assets/photos/`**:

### A. Menambah Foto ke Galeri ("Piringan Momen")
1. Siapkan foto (`.jpg`, `.jpeg`, `.png`, atau `.webp`). Usahakan ukuran filenya di bawah **2 MB** supaya website tetap cepat dibuka di HP teman-temanmu.
2. Masukkan file foto tersebut ke dalam folder:
   ```text
   assets/photos/
   ```
3. Beri nama file yang jelas, **huruf kecil semua dan tanpa spasi** (gunakan tanda hubung `-`), contohnya:
   - `momen-04.jpg`
   - `lomba-agustusan.jpg`
   - `praktikum-ipa.webp`
4. Buka file **`data/class-data.js`**, cari bagian **`galleryPosts`**, lalu tambahkan blok baru seperti ini:
   ```js
   {
     id: 'momen-04',
     file: 'momen-04.jpg', // cukup tulis nama filenya saja!
     album: 'Kegiatan Kelas',
     event: 'Praktikum',
     month: '2026-11',
     caption: 'Keseruan praktikum di laboratorium IPA.',
     uploader: 'Farsky',
     date: '2026-11-17',
     tags: ['ipa', 'praktikum']
   }
   ```
5. Sistem otomatis akan membaca fotomu dari `./assets/photos/momen-04.jpg`.

### B. Menambah Gambar pada PR, Pengumuman, atau Info Kelas (Opsional)
1. Masukkan gambar ke dalam subfolder:
   ```text
   assets/photos/kelas/
   ```
2. Beri nama misalnya `pr-matematika-1.jpg`.
3. Pada item PR atau Pengumuman di `data/class-data.js`, isi bagian `image` dengan:
   ```js
   image: 'kelas/pr-matematika-1.jpg',
   ```
   *(Kalau tidak memakai gambar, biarkan `image: ''`.)*

---

## 3. Daftar Bagian di Dalam `data/class-data.js`

| Nama Bagian di `data/class-data.js` | Gunanya di Website |
|---|---|
| `siteSettings` | Nama kelas, judul & kalimat di kartu atas (Hero), nomor WhatsApp laporan (`whatsappNumber`), jeda laporan (`reportCooldownSeconds`), dan warna aksen bawaan (`defaultAccent`). |
| `classInfo` | Judul dan deskripsi kelas, nama wali kelas, ketua kelas, ruang kelas, tahun ajaran, dan foto kelas. |
| `homework` | Daftar PR (`id`, `title`, `subject`, `description`, `deadline` format `YYYY-MM-DD`, `status`: `'aktif'` atau `'selesai'`). |
| `exams` | Daftar Jadwal Ulangan (`id`, `title`, `subject`, `description`, `date` format `YYYY-MM-DD`, `status`). |
| `kisiKisi` | Daftar Kisi-kisi Ulangan (`id`, `title`, `subject`, `description`, `date`). |
| `announcements` | Daftar Pengumuman Kelas (`id`, `title`, `subject`, `description`, `date`). |
| `customSections` | Bagian tambahan buatanmu sendiri (misalnya `Kesepakatan Kelas`, `Daftar Buku`, dll.). Kamu bebas menambah, mengubah judul, atau menghapus bagian di sini. |
| `scheduleSettings` & `schedule` | Jam berganti hari (`switchTime`, bawaan `'20:00'`) dan jadwal pelajaran harian dari Senin sampai Jumat. |
| `students` | Daftar nama siswa untuk **Roda Putar (Spin Wheel)**. |
| `albums` & `galleryPosts` | Daftar album dan foto untuk **Piringan Momen**. |
| `birthdays` & `piket` | Daftar ulang tahun (`MM-DD`) dan jadwal piket harian. |

---

## 4. Cara Mengecek Apakah Editanmu Sudah Benar (Bebas Typo)

Setelah selesai mengedit `data/class-data.js` atau menambah foto baru di `assets/photos/`, jalankan perintah ini di PowerShell (salin perintahnya saja, **jangan** salin baris tiga backtick):

```
cd "C:\workspace\Class website Project2"
node --test
```

Tes otomatis akan langsung memeriksa:
- Apakah ada tanda koma atau tanda kutip yang lupa ditutup di `data/class-data.js`,
- Apakah format tanggal (`YYYY-MM-DD`) dan jam (`HH:MM`) sudah benar,
- Apakah semua nama file foto yang kamu tulis di `file` atau `image` **benar-benar ada** di dalam folder `assets/photos/`. Kalau kamu salah ketik nama file foto, tes akan langsung memberitahu nama file mana yang belum ditemukan!
