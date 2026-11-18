/**
 * ============================================================================
 * FILE PUSAT DATA KELAS · RUANG KELAS (SMPN 62 SURABAYA)
 * Lokasi file: data/class-data.js
 * ============================================================================
 *
 * CARA MENGEDIT WEBSITE (SANGAT MUDAH):
 * 1. Semua isi website (Pengaturan, Info Kelas, PR, Jadwal Ulangan, Kisi-kisi,
 *    Pengumuman, Bagian Tambahan, Jadwal Pelajaran, Roda Putar, Galeri Foto,
 *    Ulang Tahun, dan Jadwal Piket) diatur dari SATU file ini.
 * 2. Tidak perlu login Dashboard. Cukup ubah teks di bawah ini di VS Code,
 *    lalu tekan Ctrl + S untuk menyimpan.
 * 3. Tulisan yang diawali tanda garis miring ganda (//) adalah KOMENTAR
 *    penjelasan untukmu dan tidak akan tampil di website.
 *
 * CARA MENAMBAH FOTO:
 * - Untuk foto Galeri ("Piringan Momen"):
 *   1. Taruh file fotomu (.jpg / .png / .webp) ke dalam folder:
 *      assets/photos/
 *   2. Beri nama file yang rapi tanpa spasi, contoh:
 *      momen-04.jpg   atau   lomba-kelas.jpg
 *   3. Di bagian `galleryPosts` di bawah, cukup tulis nama filenya saja:
 *      file: "momen-04.jpg"
 *      (Sistem otomatis mencari di `./assets/photos/momen-04.jpg`.)
 *
 * - Untuk gambar lampiran pada PR / Pengumuman / Info Kelas (opsional):
 *   1. Taruh file gambarnya ke dalam folder:
 *      assets/photos/kelas/
 *   2. Di bagian `image` pada item PR/Pengumuman, tulis:
 *      image: "kelas/nama-file.jpg"
 *      (Atau kosongkan `image: ""` kalau tidak pakai gambar.)
 *
 * CATATAN PRIVASI:
 * Data contoh di bawah ini memakai nama samaran ("Siswa Contoh 01", dst.) dan
 * nomor WhatsApp kosong supaya aman saat di-upload ke GitHub publik.
 * ============================================================================
 */

export const CLASS_DATA = {
  // Versi data. Naikkan angkanya atau ubah tanggalnya setiap kali kamu mengedit
  // isi file ini supaya semua perangkat tahu ada pembaruan.
  meta: {
    isExampleSeedData: true,
    updatedAt: '2026-11-17T19:07:00+08:00',
    note: 'Data contoh awal (bukan nama siswa asli dan tanpa nomor telepon).'
  },

  // ==========================================================================
  // 1. PENGATURAN WEBSITE (siteSettings)
  // ==========================================================================
  siteSettings: {
    className: 'Kelas VII C · SMPN 62 Surabaya',
    schoolSubtitle: 'SMPN 62 - SURABAYA',

    // Teks di kartu paling atas (Hero) pada halaman Beranda:
    heroEyebrow: 'Papan kabar kelas',
    heroTitle: 'Kabar kelas hari ini',
    heroSubtitle: 'Cek jadwal besok, PR terdekat, dan pengumuman kelas di satu tempat.',

    // Nomor WhatsApp tujuan Laporan & Saran (format internasional, HANYA ANGKA,
    // diawali 62, panjang 10-15 digit, contoh: "6281234567890").
    // Biarkan "" (kosong) jika tombol kirim WhatsApp belum ingin diaktifkan.
    whatsappNumber: '6283167295938',

    // Jeda waktu (detik) antar pengiriman laporan di satu browser (minimal 10):
    reportCooldownSeconds: 60,

    // Warna aksen bawaan pengunjung baru:
    // Pilihan: "red" | "periwinkle" | "green" | "teal" | "orange"
    defaultAccent: 'red'
  },

  // ==========================================================================
  // 2. DESKRIPSI KELAS (classInfo)
  // ==========================================================================
  classInfo: {
    id: 'info-utama',
    title: 'Selamat datang di Ruang Kelas 7C SMPN 62 Surabaya',
    description:
      'Papan kabar digital untuk melihat PR, jadwal ulangan, kisi-kisi, jadwal pelajaran harian, dan dokumentasi kegiatan kelas.',
    homeroomTeacher: 'Bu Linda',
    classLeader: 'Moh.Rizal',
    roomName: 'Class 7C',
    schoolYear: '2026/2027',
    image: 'kelas/info-01.jpg', // diambil dari assets/photos/kelas/info-01.jpg (kosongkan "" jika tidak pakai)
    author: 'Owner',
    updatedAt: '2026-11-17T16:00:00+07:00'
  },

  // ==========================================================================
  // 3. PR / PEKERJAAN RUMAH (homework)
  // Status yang bisa dipilih: "aktif" | "selesai"
  // Format deadline: "YYYY-MM-DD" (contoh: "2026-11-20")
  // ==========================================================================
  homework: [
    // --- CONTOH ITEM PR (salin blok { ... } ini untuk menambah PR baru) ---
    {
      id: 'pr-01',
      title: 'mengerjakan gladhen 2 halaman 36-37',
      subject: 'B. Jawa',
      description: 'kerjakan gladhen 2 halaman 36-37.',
      deadline: '2026-11-19',
      image: '',
      author: 'Guru',
      status: 'aktif',
      createdAt: '2026-11-16T08:00:00+07:00',
      updatedAt: '2026-11-16T08:00:00+07:00'
    },
    {
      id: 'pr-02',
      title: 'mek gae ngetes',
      subject: 'FOR TESTING ONLY',
      description: 'mek gae ngetes',
      deadline: '2026-11-18',
      image: '',
      author: 'Guru',
      status: 'aktif',
      createdAt: '2026-11-15T09:00:00+07:00',
      updatedAt: '2026-11-15T09:00:00+07:00'
    }
  ],

  // ==========================================================================
  // 4. JADWAL ULANGAN (exams)
  // Status yang bisa dipilih: "aktif" | "selesai"
  // ==========================================================================
  exams: [
    {
      id: 'ulangan-01',
      title: 'For Testing Only',
      subject: 'IPA',
      description: 'mek gae ngetes tok.',
      date: '2026-11-24',
      image: '',
      author: 'Guru',
      status: 'aktif',
      createdAt: '2026-11-16T10:00:00+07:00',
      updatedAt: '2026-11-16T10:00:00+07:00'
    }
  ],

  // ==========================================================================
  // 5. KISI-KISI ULANGAN (kisiKisi)
  // ==========================================================================
  kisiKisi: [
    {
      id: 'kisi-01',
      title: 'Kisi-kisi Ulangan Harian IPA Bab 2',
      subject: 'IPA',
      description:
        'Mek gae ngetes.',
      date: '2026-11-24',
      image: '',
      author: 'Guru',
      status: 'aktif',
      createdAt: '2026-11-16T10:15:00+07:00',
      updatedAt: '2026-11-16T10:15:00+07:00'
    }
  ],

  // ==========================================================================
  // 6. PENGUMUMAN KELAS (announcements)
  // ==========================================================================
  announcements: [
    {
      id: 'pengumuman-01',
      title: 'Bawa pakaian olahraga hari selasa',
      subject: 'Umum',
      description: 'Hari selasa ada praktik lapangan PJOK pukul 07.00. Jangan lupa bawa botol minum sendiri.',
      date: '2026-11-24',
      image: '',
      author: 'Owner',
      status: 'aktif',
      createdAt: '2026-11-17T07:00:00+07:00',
      updatedAt: '2026-11-17T07:00:00+07:00'
    }
  ],

  // ==========================================================================
  // 7. BAGIAN TAMBAHAN BUATAN OWNER (customSections)
  // Kamu bebas menambah bagian baru (misalnya "Peraturan Kelas" atau "Daftar Buku").
  // Kalau tidak ingin bagian tambahan, cukup isi `customSections: []`.
  // ==========================================================================
  customSections: [
    {
      id: 'bagian-kesepakatan',
      title: 'Kesepakatan Kelas',
      items: [
        {
          id: 'kesepakatan-01',
          title: 'Datang sebelum bel pukul 07.00 WIB',
          subject: 'Ketertiban',
          description: 'Petugas piket hadir 15 menit lebih awal untuk menyiapkan papan tulis.',
          date: '',
          image: '',
          author: 'Owner',
          status: 'aktif',
          createdAt: '2026-11-16T07:00:00+07:00',
          updatedAt: '2026-11-16T07:00:00+07:00'
        }
      ]
    }
  ],

  // ==========================================================================
  // 8. PENGATURAN JADWAL & JADWAL PELAJARAN HARIAN (scheduleSettings & schedule)
  // switchTime: jam berganti tampilan ke jadwal hari besok (format "HH:MM" 24 jam,
  // bawaan "20:00").
  // ==========================================================================
  scheduleSettings: {
    switchTime: '20:00',
    schoolDays: ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat']
  },

  schedule: [
    // ========================================================================
    // JADWAL KBM KELAS 7C SEMESTER GANJIL · SMP NEGERI 62 SURABAYA (2026/2027)
    // ========================================================================

    // --- SENIN ---
    { id: 'sen-0', day: 'Senin', subject: 'Upacara Bendera / Apel', start: '06:30', end: '07:20', teacher: 'Seluruh Guru', classroom: 'Lapangan' },
    { id: 'sen-1', day: 'Senin', subject: 'PAI (Jam ke-1–3)', start: '07:20', end: '09:20', teacher: 'P. Misbah', classroom: 'R. 7C' },
    // 09:20 - 09:40 Istirahat 20 menit
    { id: 'sen-2', day: 'Senin', subject: 'PKN (Jam ke-4–6)', start: '09:40', end: '11:40', teacher: 'B. Desi', classroom: 'R. 7C' },
    { id: 'sen-3', day: 'Senin', subject: 'Sholat Dhuhur Berjamaah', start: '11:40', end: '12:30', teacher: 'Pembina Rohis / Guru', classroom: 'Musholla' },
    { id: 'sen-4', day: 'Senin', subject: 'SBK (Jam ke-7–9)', start: '12:30', end: '14:15', teacher: 'B. Kis', classroom: 'R. 7C' },

    // --- SELASA ---
    { id: 'sel-0', day: 'Selasa', subject: 'Pembiasaan Karakter: Asmaul Husna & Mengaji', start: '06:30', end: '07:10', teacher: 'Wali Kelas / Guru', classroom: 'R. 7C' },
    { id: 'sel-1', day: 'Selasa', subject: 'PJOK (Jam ke-1–3)', start: '07:10', end: '09:10', teacher: 'P. Hasan', classroom: 'Lapangan / R. 7C' },
    { id: 'sel-2', day: 'Selasa', subject: 'IPS (Jam ke-4)', start: '09:10', end: '09:50', teacher: 'B. Desi', classroom: 'R. 7C' },
    // 09:50 - 10:10 Istirahat 20 menit
    { id: 'sel-3', day: 'Selasa', subject: 'IPS (Jam ke-5)', start: '10:10', end: '10:50', teacher: 'B. Desi', classroom: 'R. 7C' },
    { id: 'sel-4', day: 'Selasa', subject: 'Matematika (Jam ke-6–7)', start: '10:50', end: '12:10', teacher: 'P. Mulyadi', classroom: 'R. 7C' },
    { id: 'sel-5', day: 'Selasa', subject: 'Sholat Dhuhur Berjamaah', start: '12:10', end: '12:50', teacher: 'Pembina Rohis / Guru', classroom: 'Musholla' },
    { id: 'sel-6', day: 'Selasa', subject: 'Bahasa Indonesia (Jam ke-8–10)', start: '12:50', end: '14:20', teacher: 'B. Naila', classroom: 'R. 7C' },

    // --- RABU ---
    { id: 'rab-0', day: 'Rabu', subject: 'Pembiasaan Karakter: Literasi', start: '06:30', end: '07:10', teacher: 'Wali Kelas / Guru', classroom: 'R. 7C' },
    { id: 'rab-1', day: 'Rabu', subject: 'IPA (Jam ke-1–2)', start: '07:10', end: '08:30', teacher: 'B. Nia', classroom: 'R. 7C / Lab IPA' },
    { id: 'rab-2', day: 'Rabu', subject: 'TIK / Informatika (Jam ke-3–4)', start: '08:30', end: '09:50', teacher: 'B. Linda', classroom: 'Lab Komputer / R. 7C' },
    // 09:50 - 10:10 Istirahat 20 menit
    { id: 'rab-3', day: 'Rabu', subject: 'Bahasa Inggris (Jam ke-5–6)', start: '10:10', end: '11:30', teacher: 'B. Amel', classroom: 'R. 7C' },
    { id: 'rab-4', day: 'Rabu', subject: 'TIK / Informatika (Jam ke-7)', start: '11:30', end: '12:10', teacher: 'B. Linda', classroom: 'Lab Komputer / R. 7C' },
    { id: 'rab-5', day: 'Rabu', subject: 'Sholat Dhuhur & Ngaji Bareng', start: '12:10', end: '12:50', teacher: 'Pembina Rohis / Guru', classroom: 'Musholla' },
    { id: 'rab-6', day: 'Rabu', subject: 'Matematika (Jam ke-8–9)', start: '12:50', end: '14:10', teacher: 'P. Mulyadi', classroom: 'R. 7C' },

    // --- KAMIS ---
    { id: 'kam-0', day: 'Kamis', subject: 'Pembiasaan Karakter: Sholat Dhuha', start: '06:30', end: '07:10', teacher: 'Pembina Rohis / Guru', classroom: 'Musholla' },
    { id: 'kam-1', day: 'Kamis', subject: 'Bahasa Indonesia (Jam ke-1–3)', start: '07:10', end: '09:10', teacher: 'B. Naila', classroom: 'R. 7C' },
    { id: 'kam-2', day: 'Kamis', subject: 'IPS (Jam ke-4)', start: '09:10', end: '09:50', teacher: 'B. Desi', classroom: 'R. 7C' },
    // 09:50 - 10:10 Istirahat 20 menit
    { id: 'kam-3', day: 'Kamis', subject: 'IPS (Jam ke-5)', start: '10:10', end: '10:50', teacher: 'B. Desi', classroom: 'R. 7C' },
    { id: 'kam-4', day: 'Kamis', subject: 'Bahasa Jawa (Jam ke-6–7)', start: '10:50', end: '12:10', teacher: 'B. Mei', classroom: 'R. 7C' },
    { id: 'kam-5', day: 'Kamis', subject: 'Sholat Dhuhur & Ngaji Bareng', start: '12:10', end: '12:50', teacher: 'Pembina Rohis / Guru', classroom: 'Musholla' },
    { id: 'kam-6', day: 'Kamis', subject: 'Bahasa Inggris (Jam ke-8–9)', start: '12:50', end: '14:10', teacher: 'B. Amel', classroom: 'R. 7C' },

    // --- JUMAT ---
    { id: 'jum-0', day: 'Jumat', subject: "Pembiasaan Jum'at Berseri", start: '06:30', end: '07:30', teacher: 'Seluruh Guru', classroom: 'Lapangan / R. 7C' },
    { id: 'jum-1', day: 'Jumat', subject: 'Koding (Jam ke-1–2)', start: '07:30', end: '08:40', teacher: 'B. Linda', classroom: 'Lab Komputer / R. 7C' },
    { id: 'jum-2', day: 'Jumat', subject: 'Matematika (Jam ke-3)', start: '08:40', end: '09:15', teacher: 'P. Mulyadi', classroom: 'R. 7C' },
    { id: 'jum-3', day: 'Jumat', subject: 'IPA (Jam ke-4)', start: '09:15', end: '09:50', teacher: 'B. Nia', classroom: 'R. 7C / Lab IPA' },
    // 09:50 - 10:10 Istirahat 20 menit
    { id: 'jum-4', day: 'Jumat', subject: 'IPA (Jam ke-5–6)', start: '10:10', end: '11:20', teacher: 'B. Nia', classroom: 'R. 7C / Lab IPA' }
  ],

  // ==========================================================================
  // 9. DAFTAR SISWA UNTUK RODA PUTAR / SPIN WHEEL (students)
  // ==========================================================================
  students: [
    { id: 'siswa-01', name: 'Moh. Rizal', active: true },
    { id: 'siswa-02', name: 'Chessta Dzakiya S.W', active: true },
    { id: 'siswa-03', name: 'Aqila Haya', active: true },
    { id: 'siswa-04', name: 'M. Iqbal Zaafaroni', active: true },
    { id: 'siswa-05', name: 'Syifa Tabina Ardyan', active: true },
    { id: 'siswa-06', name: 'Alvin Nur Dzaky', active: true },
    { id: 'siswa-07', name: 'Achmad Dzaki Alfarizi', active: true },
    { id: 'siswa-08', name: 'Afgan Pratama I.', active: true },
    { id: 'siswa-09', name: 'Afilda Bidayatul R.', active: true },
    { id: 'siswa-10', name: 'Asyifatu Haifa R.', active: true },
    { id: 'siswa-11', name: 'Athar Rizky Y.', active: true },
    { id: 'siswa-12', name: 'Elfara Rahmadita D.', active: true },
    { id: 'siswa-13', name: 'Ergie Putra Nugraha', active: true },
    { id: 'siswa-14', name: 'Gavenio Khalendra', active: true },
    { id: 'siswa-15', name: 'Kennedi Jo Pratama', active: true },
    { id: 'siswa-16', name: 'Kinanti Almeera W.', active: true },
    { id: 'siswa-17', name: 'Maulidiyah Indri Z.', active: true },
    { id: 'siswa-18', name: 'M.Haikal Farabe', active: true },
    { id: 'siswa-19', name: 'M. Daffa Ibnu Hafidz', active: true },
    { id: 'siswa-20', name: 'M. Fiqih Amirudin', active: true },
    { id: 'siswa-21', name: 'M. Wildan Rizki R.', active: true },
    { id: 'siswa-22', name: 'Nailal Mufarrihah', active: true },
    { id: 'siswa-23', name: 'Puput Aprilia M.', active: true },
    { id: 'siswa-24', name: 'Raffasya A.A', active: true },
    { id: 'siswa-25', name: 'Rb. M. Rifko Firdausi', active: true },
    { id: 'siswa-26', name: 'Samudra Grahdian M.', active: true },
    { id: 'siswa-27', name: 'Sarafatul Aulia', active: true },
    { id: 'siswa-28', name: 'Syaquina Azzahra I.', active: true },
    { id: 'siswa-29', name: 'Zahfran Sakha M. P.', active: true }
  ],

  // ==========================================================================
  // 10. GALERI FOTO "PIRINGAN MOMEN" (albums & galleryPosts)
  // Cukup taruh fotomu di `assets/photos/` lalu tulis nama filenya di `file`.
  // ==========================================================================
  albums: [
    { id: 'album-kegiatan', name: 'Kegiatan Kelas' },
    { id: 'album-lomba', name: 'Lomba Sekolah' }
  ],

  galleryPosts: [
    {
      id: 'momen-01',
      file: 'momen-01.jpg', // merujuk ke ./assets/photos/momen-01.jpg
      album: 'fotbar',
      event: 'Hari Pahlawan 2026(Perempuan)',
      month: '2026-11',
      caption: 'Potret perempuan pahlawan di Hari Pahlawan 2026.',
      uploader: 'Farsky',
      date: '2026-11-10',
      tags: ['kelas', 'fotbar']
    },
    {
      id: 'momen-02',
      file: 'momen-02.png', // merujuk ke ./assets/photos/momen-02.png
      album: 'fotbar',
      event: 'Hari pahlawan 2026(Laki-laki)',
      month: '2026-11',
      caption: 'Potret laki-laki pahlawan di Hari Pahlawan 2026.',
      uploader: 'Farsky',
      date: '2026-11-10',
      tags: ['kelas', 'fotbar']
    },
    {
      id: 'momen-03',
      file: 'momen-03.png', // merujuk ke ./assets/photos/momen-03.png
      album: 'fotbar',
      event: 'Maulid nabi',
      month: '2026-08',
      caption: 'Suasana peringatan Maulid Nabi di sekolah.',
      uploader: 'Farsky',
      date: '2026-08-25',
      tags: ['kelas', 'fotbar']
    },
    {
      id: 'momen-04',
      file: 'momen-04.png', // merujuk ke ./assets/photos/momen-04.png
      album: 'fotbar',
      event: 'Fotbar',
      month: '2026-08',
      caption: 'gae ngetes tok.',
      uploader: 'Farsky',
      date: '2026-10-15',
      tags: ['kelas', 'fotbar']
    }
  ],

  // ==========================================================================
  // 11. BONUS: ULANG TAHUN & JADWAL PIKET (birthdays & piket)
  // Format tanggal ulang tahun: "MM-DD" (bulan-tanggal, tanpa tahun lahir).
  // ==========================================================================
  birthdays: [
    { id: 'bday-01', name: 'Siswa Contoh 01', dayMonth: '11-25' },
    { id: 'bday-02', name: 'Siswa Contoh 02', dayMonth: '12-04' }
  ],

  piket: [
    { day: 'Senin', members: ['Kinan', 'Qila', 'Rifko', 'Kenzo', 'Fiqih', 'Asyifa'] },
    { day: 'Selasa', members: ['Fara', 'Syaquina', 'Samudra', 'Ergi', 'Zafran', 'Daffa'] },
    { day: 'Rabu', members: ['Chessta', 'Afilda', 'Rizal', 'Afgan', 'Athar', 'Alvin'] },
    { day: 'Kamis', members: ['Puput', 'Nailal', 'Syifa', 'Iqbal', 'Wildan', 'Gave'] },
    { day: 'Jumat', members: ['Maulid', 'Haikal', 'Ahmad', 'Raffa', 'Aulia'] }
  ]
};
