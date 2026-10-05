# Meetopia: PRD dan Rencana Pengerjaan

Kantor virtual 2D berbasis browser dengan karakter kartun yang "hidup". Tampilannya seperti Discord, tetapi setiap grup punya ruangan 2D-nya sendiri. Proyek pribadi, gratis, untuk kantor, kelompok, dan komunitas (paling banyak beberapa puluh pengguna).

**Istilah:** "grup" setara dengan server di Discord. Di dokumen ini kata "organisasi" berarti grup yang sama.

Versi dokumen: 5 Oktober 2026. Status centang diperbarui saat implementasi MVP (M0–M8); diuji dengan unit test dan tes end-to-end. Nama "Meetopia" adalah nama kerja (lihat bagian 14 soal nama yang sudah dipakai pihak lain).

---

## 0. Cara memakai dokumen ini (untuk Claude Code)

- Kerjakan **berurutan per milestone** di bagian 5. Jangan lompat ke fitur game sebelum milestone M0 sampai M8 selesai.
- Setiap milestone punya daftar tugas dan kriteria "selesai bila". Centang tugas setelah benar-benar jalan dan diuji.
- Satu orang pengembang, pemula untuk real-time dan WebRTC. Pilih solusi yang paling sederhana dan jelaskan alasan pilihan di pesan commit atau README.
- Jika ada keputusan yang belum final (bagian 14), tanyakan ke pemilik proyek sebelum membangun hal yang bergantung padanya.
- Jangan menaruh secret (kunci API, connection string) di repo. Pakai variabel lingkungan dan sediakan `.env.example`.

---

## 1. Ringkasan produk

Tampilannya seperti Discord: daftar grup di sisi kiri, kanal teks, dan area utama. Bedanya, setiap grup punya ruangan 2D sendiri tempat anggotanya hadir sebagai avatar kartun di satu peta kantor. Audio mengikuti jarak antar-avatar. Pengguna bisa berbagi layar, menulis catatan, mengobrol, dan (di fase berikutnya) menjalani kehidupan karakter: lapar, haus, energi, gaji koin, belanja baju, dekorasi ruangan, dan minigame kerja sampingan.

**Fitur inti yang harus "berjalan" lebih dulu:**

1. Mic (audio berdasarkan jarak)
2. Berbagi layar
3. Catatan (pribadi dan bersama)

Mekanik game dikerjakan setelah tiga fitur ini stabil.

**Bukan tujuan:** webinar untuk ratusan orang, pengganti suite dokumen, aplikasi mobile native, penyedia alamat kantor legal, uang sungguhan (semua koin adalah koin virtual).

---

## 2. Keputusan teknis (per Oktober 2026)

| Bagian | Keputusan | Catatan |
| --- | --- | --- |
| Klien | TypeScript, React, kanvas 2D | Rekomendasi: Phaser (tilemap dan tabrakan bawaan); alternatif: PixiJS |
| Hosting klien dan API | Vercel | Paket gratis punya batas; cek syarat terbaru |
| Server real-time | WebSocket di Vercel Functions (public beta sejak 22 Juni 2026) | Lakukan spike di M2; cadangan di bagian 7 |
| Database | Neon (PostgreSQL serverless) | Paket gratis: 100 CU-jam compute dan 1 GB per proyek |
| Cache, pub/sub, kehadiran | Redis terkelola | Penyedia belum dipilih (bagian 14) |
| Audio, video, berbagi layar | Layanan WebRTC terkelola | Penyedia belum dipilih; mesh buatan sendiri sebagai alternatif belajar |
| Penyimpanan file | Penyimpanan objek kompatibel S3 | Untuk rekaman dan aset, bukan di database |
| Gaya visual | Kartun, aset dibuat sendiri | Tidak meniru produk atau karakter lain |
| Bahasa UI | Indonesia dan Inggris | Lewat berkas terjemahan, tanpa teks tertanam |

**Skala:** sekitar 10 sampai 15 pengguna bersamaan per ruang, beberapa puluh pengguna total. Tidak perlu mengoptimalkan untuk skala besar.

---

## 3. Aturan yang tidak boleh dilanggar

1. **Jangan menulis posisi atau kehadiran ke Neon.** Aktivitas terus-menerus menjaga database tetap bangun dan menghabiskan jatah compute gratis. Simpan di Redis. Pesan chat ditulis ke Neon per kelompok (batch).
2. **Koneksi WebSocket di Vercel bisa ditutup** saat fungsi mencapai durasi maksimum (contoh Colyseus di Vercel memakai 300 detik, batas paket Hobby). Klien wajib sambung ulang otomatis dan memulihkan posisi dan status.
3. **Status ruang tidak boleh hanya di memori fungsi.** Satu koneksi terikat ke satu instance fungsi, jadi pemain di ruangan yang sama bisa berada di instance berbeda. Sinkronkan lewat Redis pub/sub.
4. **Hak akses ditegakkan di server** pada setiap pesan real-time dan panggilan API, bukan hanya di UI.
5. **Koin hanya virtual:** tidak bisa dibeli dengan uang asli dan tidak bisa diuangkan. Saham di minigame adalah simulasi dengan harga fiktif.
6. **Efek kebutuhan karakter (lapar, haus, energi) ringan, punya batas minimum, dan bisa dimatikan** oleh admin dan pengguna. Tidak boleh mengunci chat atau berbagi layar.
7. **Tidak ada pelacakan layar atau keystroke.** Status "jauh dari layar" hanya berdasarkan aktivitas dalam aplikasi.
8. Mikrofon dan kamera mati secara default saat masuk.
9. Rekaman (bila ada) butuh izin dan penanda yang terlihat semua peserta.

---

## 4. Prioritas

- **P0:** wajib di MVP (milestone M0 sampai M8).
- **P1:** fase kedua (bagian 5, Fase 2).
- **P2:** fase ketiga.
- **P3:** lanjutan, belum dijadwalkan.

---

## 5. Rencana pengerjaan

Jadwal tidak dipatok per bulan. Urutan dan kriteria selesai yang tetap.

### Fase 1: MVP (P0)

#### M0: Fondasi proyek

- [x] Repo, TypeScript, lint, format, struktur folder (klien, API, server real-time, shared types).
- [ ] Deploy kosong ke Vercel dari Git, dengan variabel lingkungan dan `.env.example`. *(belum: perlu akun Vercel pemilik proyek; lihat README bagian Deploy)*
- [x] Sistem terjemahan (Indonesia dan Inggris) dari awal.

**Selesai bila:** halaman kosong tampil di URL Vercel dan teks UI datang dari berkas terjemahan.

#### M1: Peta dan gerak avatar (tanpa jaringan)

- [x] Peta template 2D (lobi, area kerja, ruang rapat, lounge) dari tilemap.
- [x] Avatar kartun bergerak dengan ketuk layar (tap atau klik) ke titik tujuan, tanpa kontrol keyboard WASD.
- [x] Pencarian jalur otomatis yang menghindari dinding dan objek.
- [x] Objek interaktif dasar: saat avatar berada dalam jangkauan, atau objek diketuk, muncul petunjuk berisi nama objek dan tombol aksi (FR-74).
- [ ] Peta dimuat kurang dari 3 detik pada 4G. *(belum diukur; peta digambar prosedural tanpa unduhan aset)*

**Selesai bila:** satu pengguna mengetuk titik di peta dan avatar berjalan ke sana tanpa menembus dinding, petunjuk objek muncul saat didekati atau diketuk, minimal 30 FPS di laptop kelas menengah, dan bekerja di layar sentuh.

#### M2: Spike WebSocket di Vercel dan sinkron posisi

- [ ] Endpoint WebSocket di Vercel Function (Next.js memakai `experimental_upgradeWebSocket()` dari `@vercel/functions`; framework dengan WebSocket native seperti Express atau Hono tidak butuh API khusus). *(sementara: server `ws` mandiri/di proses yang sama — cadangan bagian 7; spike Vercel belum dilakukan)*
- [x] Redis pub/sub untuk menyebarkan posisi antar-instance.
- [x] Dua browser saling melihat avatar bergerak.
- [x] Sambung ulang otomatis dan pemulihan posisi saat koneksi terputus.
- [ ] Catat hasil spike: stabilitas, durasi putus, latensi. Jika tidak layak, pindah ke cadangan (bagian 7). *(alat ukur durasi putus tersedia di klien; hasil belum dicatat)*

**Selesai bila:** dua sampai empat browser saling melihat posisi dengan jeda di bawah 150 ms dan pulih sendiri setelah koneksi diputus.

#### M3: Akun, grup, kerangka tampilan, dan avatar dasar

- [x] Daftar dan masuk dengan email dan kata sandi, verifikasi email, reset kata sandi (FR-01).
- [x] Buat grup (kantor atau komunitas) yang otomatis punya satu ruangan 2D dan satu kanal teks "umum" (FR-72, FR-73); undang lewat tautan yang bisa dicabut dan punya masa berlaku (FR-02).
- [x] Kerangka tampilan ala Discord: daftar grup di kiri, daftar kanal dan ruangan grup, area utama, panel anggota di kanan; satu pengguna bisa bergabung ke banyak grup (FR-70, FR-71).
- [x] Peran: pemilik, admin, anggota, tamu, ditegakkan di server (FR-03).
- [x] Saat daftar: buat nama dan avatar dasar (tubuh, wajah, rambut, warna), langsung bisa masuk tanpa membeli apa pun (FR-11, FR-59).
- [x] Skema Neon: pengguna, grup, kanal, keanggotaan, peta.

**Selesai bila:** admin membuat grup, membagikan tautan, anggota baru bergabung dan muncul di ruangan grup dalam kurang dari 2 menit, dan pengguna bisa berpindah antar grup tanpa memuat ulang halaman.

#### M4: Chat dan kehadiran

- [x] Chat teks: kanal teks grup, percakapan sekitar, dan pesan langsung (FR-25, FR-73). Pesan tampil dalam 500 ms.
- [x] Status: aktif, sibuk, sedang rapat, jauh dari layar; otomatis berubah setelah 5 menit tanpa aktivitas (FR-30).
- [x] Penulisan pesan ke Neon per batch.

**Selesai bila:** pesan sampai ke penerima yang benar dan riwayat tersimpan.

#### M5: Catatan (inti)

- [x] Catatan pribadi: teks sederhana per akun, tersimpan otomatis, hanya pemilik yang bisa membaca (FR-66).
- [x] Catatan bersama per ruangan: semua anggota ruangan bisa membaca; diedit bergantian (tulisan terakhir yang disimpan), tanpa penyuntingan bersamaan (FR-67).

**Selesai bila:** catatan pribadi tidak terbaca orang lain dan catatan bersama tersimpan dan terlihat semua anggota ruangan.

#### M6: Mic dan audio berdasarkan jarak (inti)

- [ ] Pilih penyedia WebRTC terkelola dan cek paket gratisnya (bagian 14). *(sementara: mesh buatan sendiri + STUN publik, lihat README)*
- [x] Endpoint API yang menerbitkan token akses ke layanan WebRTC, dengan pemeriksaan peran.
- [x] Spatial audio: volume mengikuti jarak, hilang di luar radius; radius dan kurva volume dapat dikonfigurasi per peta (FR-20).
- [x] Pemilihan perangkat, tombol bisu yang selalu terlihat, status mikrofon terlihat orang lain (FR-22).
- [x] Layar pengecekan perangkat saat bergabung dengan indikator suara.
- [x] Penanganan: izin mikrofon ditolak, perangkat tidak ditemukan, koneksi putus lalu tersambung.

**Selesai bila:** dua sampai empat orang mendengar satu sama lain dengan volume yang mengikuti jarak, latensi di bawah 300 ms.

#### M7: Berbagi layar (inti)

- [x] Berbagi layar ke percakapan sekitar; satu penyaji aktif per percakapan; berhenti dengan satu klik (FR-24).
- [x] Video aktif otomatis untuk peserta terdekat, maksimal 8 video dan 16 audio per percakapan (FR-21).

**Selesai bila:** satu orang berbagi layar dan peserta di sekitarnya melihatnya; berhenti dengan satu klik.

#### M8: Ruang privat dan "ketuk"

- [x] Ruang privat: audio terisolasi dari area sekitar (FR-23).
- [x] "Ketuk" sebelum masuk ruang privat atau menghampiri orang berstatus sibuk; penerima menerima atau menolak (FR-31).
- [x] Layar utama MVP selesai: peta, panel anggota, chat, bar kontrol, pengaturan profil dan avatar, undangan anggota, pengaturan organisasi.

**Selesai bila:** semua kebutuhan P0 di bagian 6 lulus kriteria penerimaan. MVP siap dipakai teman.

### Fase 2: Dunia hidup (P1)

Kerjakan setelah M0 sampai M8 stabil. Urutan yang disarankan:

1. **Karakter hidup:** bar energi, lapar, haus; efek ringan bila kosong; istirahat di kursi, sofa, atau ruang istirahat (FR-50, FR-52).
2. **Kantin dan mesin penjual otomatis** dengan item dan efek berbeda (FR-51, FR-55).
3. **Gaji koin per jam aktif** dengan batas harian dan anti-idle (FR-53).
4. **Toko pakaian dan aksesori** plus lemari (FR-60, FR-61); toko perabot (FR-54).
5. **Dekorasi tarik-letakkan, ganti latar, meja pribadi** (FR-56, FR-57, FR-58) dan editor peta (FR-13).
6. **Kerja sampingan minigame:** simulasi saham virtual (FR-62, FR-63), pengaturan admin untuk menyalakan atau mematikan minigame (FR-65).
7. Objek interaktif dan tempel catatan di peta (FR-14, FR-68), login Google Workspace dan Lark (FR-04), rekaman sesi (FR-26), tamu eksternal, konsol admin (FR-40), daftar anggota dan teleport (FR-32).

### Fase 3 (P2) dan lanjutan (P3)

- P2: absensi dan cuti (FR-42), analitik tim (FR-43), banyak peta per organisasi, kapasitas ruang lebih besar, API dan webhook, minigame lain (FR-64), siaran pengumuman (FR-27).
- P3: SSO SAML, aplikasi desktop dan mobile native, transkripsi dan ringkasan AI, marketplace aset peta.
- Ditunda: paket berbayar dan penagihan (FR-41).

---

## 6. Kebutuhan fungsional

### Akun dan grup

| ID | Kebutuhan | Kriteria penerimaan | Prioritas |
| --- | --- | --- | --- |
| FR-01 | Daftar dan masuk dengan email dan kata sandi | Verifikasi email; reset kata sandi lewat email | P0 |
| FR-02 | Buat grup dan undang anggota lewat tautan atau email | Tautan undangan bisa dicabut dan punya masa berlaku | P0 |
| FR-03 | Peran: pemilik, admin, anggota, tamu | Hak akses ditegakkan di server, bukan hanya di UI | P0 |
| FR-04 | Login Google Workspace dan Lark | Anggota masuk tanpa membuat kata sandi baru | P1 |

### Grup dan tampilan ala Discord

| ID | Kebutuhan | Kriteria penerimaan | Prioritas |
| --- | --- | --- | --- |
| FR-70 | Kerangka tampilan ala Discord: daftar grup di sisi kiri, daftar kanal dan ruangan grup terpilih, area utama, panel anggota di kanan | Pindah grup tanpa memuat ulang halaman; tata letak menyesuaikan lebar layar | P0 |
| FR-71 | Satu pengguna bisa bergabung ke banyak grup | Daftar grup tampil di sisi kiri; berpindah grup memutus audio dari ruangan sebelumnya; indikator pesan belum dibaca (P1) | P0 |
| FR-72 | Setiap grup punya ruangan 2D sendiri yang dibuat otomatis saat grup dibuat | Peta dasar dari template; hanya anggota grup yang bisa masuk | P0 |
| FR-73 | Kanal teks per grup | MVP: satu kanal "umum" otomatis; pesan hanya terlihat anggota grup; admin bisa membuat dan menghapus kanal tambahan (P1) | P0 |

### Peta, avatar, dan gerak

| ID | Kebutuhan | Kriteria penerimaan | Prioritas |
| --- | --- | --- | --- |
| FR-10 | Peta kantor 2D dari template (lobi, area kerja, ruang rapat, lounge) | Peta dimuat dalam 3 detik pada koneksi 4G | P0 |
| FR-11 | Avatar dasar (nama, warna, tubuh, wajah, rambut) dibuat saat pendaftaran | Perubahan avatar terlihat oleh semua orang dalam 1 detik | P0 |
| FR-12 | Gerak dengan ketuk layar: ketuk titik tujuan dan avatar berjalan ke sana (tanpa WASD) | Berfungsi di layar sentuh dan mouse; jalur menghindari dinding dan objek; posisi tersinkron antar-klien | P0 |
| FR-13 | Editor peta: tempel tile, dinding, objek, ruang privat | Peta tersimpan versi; admin bisa mengembalikan versi sebelumnya | P1 |
| FR-14 | Objek interaktif: tautan, papan tulis, dokumen tertanam | Klik objek membuka tautan atau panel tanpa meninggalkan ruangan | P1 |
| FR-74 | Notifikasi pada objek yang bisa diinteraksi | Saat avatar dalam jangkauan atau objek diketuk, muncul petunjuk berisi nama objek dan tombol aksi (misalnya duduk, beli, buka catatan); hasil aksi muncul sebagai notifikasi singkat | P0 |

### Komunikasi

| ID | Kebutuhan | Kriteria penerimaan | Prioritas |
| --- | --- | --- | --- |
| FR-20 | Spatial audio: volume mengikuti jarak, hilang di luar radius | Radius dan kurva volume dapat dikonfigurasi per peta | P0 |
| FR-21 | Video aktif otomatis untuk peserta terdekat | Maksimal 8 video dan 16 audio per percakapan (konfigurasi awal) | P0 |
| FR-22 | Mikrofon, kamera, dan perangkat keluaran bisa dipilih dan dimatikan | Tombol bisu selalu terlihat; status mikrofon terlihat oleh orang lain | P0 |
| FR-23 | Ruang privat: audio terisolasi dari area sekitar | Orang di luar ruang tidak mendengar, walau avatar berdekatan | P0 |
| FR-24 | Berbagi layar ke percakapan sekitar | Satu penyaji aktif per percakapan; berhenti dengan satu klik | P0 |
| FR-25 | Chat teks: kanal teks grup, percakapan sekitar, dan pesan langsung | Pesan tampil dalam 500 ms; riwayat tersimpan 30 hari | P0 |
| FR-26 | Rekaman sesi | Maksimal 80 menit; penanda rekaman terlihat semua peserta; izin dari peserta | P1 |
| FR-27 | Siaran ke seluruh ruangan (mode pengumuman) | Hanya admin atau pembicara yang diizinkan | P2 |

### Kehadiran

| ID | Kebutuhan | Kriteria penerimaan | Prioritas |
| --- | --- | --- | --- |
| FR-30 | Status: aktif, sibuk, sedang rapat, jauh dari layar | Berubah otomatis setelah 5 menit tanpa aktivitas dan bisa diatur manual | P0 |
| FR-31 | "Ketuk" sebelum masuk ruang privat atau menghampiri orang berstatus sibuk | Penerima bisa menerima atau menolak | P0 |
| FR-32 | Daftar anggota dan lompat ke lokasi rekan | Hanya jika rekan tidak berstatus sibuk atau mengizinkan | P1 |

### Admin

| ID | Kebutuhan | Kriteria penerimaan | Prioritas |
| --- | --- | --- | --- |
| FR-40 | Konsol admin: anggota, peran, peta, kebijakan rekaman | Perubahan peran berlaku dalam 5 detik | P1 |
| FR-41 | Paket berbayar dan tagihan | Ditunda: aplikasi gratis penuh | Ditunda |
| FR-42 | Absensi masuk dan keluar, serta integrasi cuti | Data tersinkron ke sistem HR yang terhubung | P2 |
| FR-43 | Analitik tim: jam hadir, interaksi antar-tim | Disajikan agregat; opsi sembunyi nama perorangan | P2 |

### Catatan (inti)

| ID | Kebutuhan | Kriteria penerimaan | Prioritas |
| --- | --- | --- | --- |
| FR-66 | Catatan pribadi: teks sederhana per akun | Tersimpan otomatis; hanya pemilik yang bisa membaca | P0 |
| FR-67 | Catatan bersama per ruangan | Semua anggota ruangan bisa membaca; diedit bergantian (tulisan terakhir yang disimpan), tanpa penyuntingan bersamaan | P0 |
| FR-68 | Tempel catatan sebagai objek di peta | Klik objek membuka catatan; posisi bisa dipindah | P1 |

"Catatan" berarti catatan teks, bukan editor dokumen yang bisa diedit bersamaan secara real-time.

### Karakter hidup, ekonomi, dan dekorasi

| ID | Kebutuhan | Kriteria penerimaan | Prioritas |
| --- | --- | --- | --- |
| FR-50 | Tiga bar kebutuhan: energi, lapar, haus | Turun pelan selama online; kecepatan bisa diatur admin; bila kosong avatar bergerak lebih lambat, suara orang sekitar mengecil (usulan: minimal 50% volume), dan layar sedikit buram; chat dan berbagi layar tetap jalan; semua efek bisa dimatikan | P1 |
| FR-51 | Makan dan minum item dari kantin atau mesin penjual otomatis | Mengisi bar lapar dan haus; ada animasi dan efek suara | P1 |
| FR-52 | Istirahat: duduk di kursi atau sofa, tidur di ruang istirahat | Energi pulih lebih cepat di perabot istirahat; avatar beranimasi | P1 |
| FR-53 | Gaji per jam online dalam koin virtual | Koin bertambah per jam aktif (ada aktivitas dalam aplikasi); batas harian; tidak bertambah saat idle atau terdeteksi bot | P1 |
| FR-54 | Toko perabot dalam aplikasi, dibeli dengan koin | Item masuk inventaris; saldo koin tidak bisa negatif | P1 |
| FR-55 | Kantin dan mesin penjual otomatis di peta: beli makanan dan minuman dengan koin | Tiap item punya efek berbeda pada energi, lapar, dan haus; diambil dari mesin atau tiba di meja | P1 |
| FR-56 | Ganti latar atau tema ruangan (kantor modern, kafe, taman, malam) | Perubahan terlihat semua orang di ruangan itu dalam 1 detik | P1 |
| FR-57 | Dekorasi tarik-dan-letakkan: meja, kursi, tanaman, dan lain-lain | Bisa dipindah, diputar, disimpan; hanya pemilik area atau admin yang boleh mengubah area bersama | P1 |
| FR-58 | Meja pribadi per anggota yang bisa didekorasi sendiri | Tata letak tersimpan dan tampil setiap masuk | P1 |

Kantin punya menu lengkap tetapi avatar harus mendekat dan menunggu sebentar. Mesin penjual otomatis instan, tetapi pilihannya terbatas dan harganya lebih mahal.

**Contoh item dan efeknya (usulan, skala bar 0 sampai 100, disetel ulang saat uji):**

| Item | Jenis | Energi | Lapar | Haus |
| --- | --- | --- | --- | --- |
| Air mineral | Minuman | 0 | 0 | +30 |
| Teh dingin | Minuman | +5 | 0 | +25 |
| Kopi | Minuman | +20 | 0 | +10 |
| Minuman energi | Minuman | +35 | 0 | +5 |
| Keripik | Camilan | +5 | +15 | -10 |
| Roti isi | Camilan | +10 | +25 | 0 |
| Nasi ayam | Makanan berat | +30 | +60 | -5 |

### Kustomisasi karakter dan kerja sampingan

| ID | Kebutuhan | Kriteria penerimaan | Prioritas |
| --- | --- | --- | --- |
| FR-59 | Pembuatan nama dan avatar dasar saat pendaftaran | Pilih nama, tubuh, wajah, rambut, dan warna; langsung bisa masuk tanpa membeli apa pun | P0 |
| FR-60 | Toko pakaian dan aksesori: baju, celana, tas, topi, aksesori lain | Tiap item punya slot di avatar dan harga koin; pratinjau sebelum membeli | P1 |
| FR-61 | Lemari: pasang, lepas, dan simpan beberapa set pakaian | Perubahan terlihat semua orang dalam 1 detik | P1 |
| FR-62 | Kerja sampingan berupa minigame yang menghasilkan koin | Batas koin per hari; hasil minigame tidak menghalangi fitur kerja | P1 |
| FR-63 | Minigame simulasi saham: beli dan jual saham virtual untuk belajar | Harga dari simulasi, bukan pasar nyata; koin virtual saja | P1 |
| FR-64 | Minigame lain (usulan: mengantar pesanan, menyortir barang, teka-teki) | Durasi singkat dan bisa dijeda | P2 |
| FR-65 | Pengaturan admin: nyalakan atau matikan minigame dan batas harian | Berlaku bagi seluruh anggota organisasi | P1 |

---

## 7. Arsitektur

```
Klien (browser)
  peta dan avatar di kanvas 2D, antarmuka web
  audio, video, layar lewat layanan WebRTC
        |
        v
Vercel: CDN, API, dan WebSocket
        |
   +----+-----------------+------------------+
   |                      |                  |
Auth + grup    Server real-time    Chat + notifikasi
(login, peran,       (posisi avatar,     (pesan, riwayat)
 tautan)              kehadiran, ruang)
   |                      |                  |
   v                      v                  v
Neon (PostgreSQL)      Redis          Penyimpanan objek
akun, organisasi,   kehadiran, sesi,  aset peta, avatar,
peta, pesan         pub/sub           rekaman

Akses WebRTC: API menerbitkan token ke layanan WebRTC terkelola;
media audio, video, dan layar mengalir lewat layanan itu, bukan lewat Vercel.
```

**Cadangan bila WebSocket beta di Vercel bermasalah:** layanan real-time terpisah (misalnya Cloudflare Workers dengan Durable Objects), sementara klien dan API tetap di Vercel.

**Catatan Neon:** 100 CU-jam setara sekitar 400 jam compute kecil, kurang dari satu bulan penuh. Bila jatah gratis habis, database berhenti sampai periode berikutnya (data tidak hilang), jadi pantau pemakaian. Koneksi dari fungsi serverless memakai connection pooling. Batas 1 GB: rekaman dan aset ke penyimpanan objek, riwayat chat dibatasi 30 hari.

---

## 8. Model data utama

| Entitas | Atribut utama |
| --- | --- |
| Pengguna | id, email, nama, avatar, bahasa |
| Grup | id, nama, pemilik, kebijakan rekaman, ruangan 2D (peta) |
| Kanal | id, grup, nama, jenis (teks) |
| Keanggotaan | pengguna, grup, peran, status |
| Peta (ruangan grup) | id, grup, versi, data tile dan objek, radius audio |
| Ruang privat | id, peta, batas area, aturan akses |
| Kehadiran (Redis) | pengguna, peta, posisi terakhir, status, waktu aktif terakhir |
| Pesan | id, tujuan (kanal grup, percakapan sekitar, langsung), pengirim, isi, waktu |
| Catatan | id, pemilik atau ruangan, isi, waktu ubah |
| Rekaman | id, grup, peserta, durasi, lokasi file, kedaluwarsa |
| Koin dan inventaris | pengguna, saldo koin, item dimiliki, pakaian terpasang |

---

## 9. Kebutuhan non-fungsional

| Area | Target |
| --- | --- |
| Latensi audio | Di bawah 300 ms ujung ke ujung |
| Sinkronisasi posisi | Di bawah 150 ms antar-klien pada koneksi normal |
| Kapasitas ruang | Sekitar 10 sampai 15 pengguna bersamaan per ruang; total beberapa puluh pengguna |
| Performa klien | 30 FPS pada laptop kelas menengah (RAM 8 GB, tanpa GPU khusus) |
| Waktu muat | Peta tampil dalam 3 detik pada 4G |
| Ketersediaan | Tanpa target formal (proyek pribadi) |
| Ketahanan jaringan | Sambung ulang otomatis; audio turun kualitas, bukan putus |
| Browser | Chrome, Edge, Safari, dan Firefox dua versi terakhir |
| Aksesibilitas | Navigasi keyboard penuh, teks alternatif, pilihan kontras tinggi |
| Bahasa | Indonesia dan Inggris sejak MVP |

Angka-angka ini adalah usulan awal, bukan hasil pengukuran.

---

## 10. Prinsip UX/UI

**Tata letak ala Discord (usulan):**

```
+--------+-----------------+--------------------------------+-----------+
| Grup   | Nama grup       |                                | Anggota   |
| (ikon) |  Kanal teks     |   Ruangan 2D grup              |  online   |
|   A    |   # umum        |   (peta, avatar, objek)        |  Rani     |
|   B    |   # catatan     |                                |  Dito     |
|   +    |  Ruangan        +--------------------------------+  ...      |
|        |   [Masuk]       |  Chat kanal yang dipilih       |           |
+--------+-----------------+--------------------------------+-----------+
```

Kiri: daftar grup yang diikuti dan tombol tambah. Tengah-kiri: kanal teks dan ruangan 2D milik grup terpilih. Tengah: ruangan 2D dan chat. Kanan: daftar anggota dan statusnya. Di layar kecil, panel samping disembunyikan dan dibuka lewat tombol.

- **Kendali di tangan pengguna:** mikrofon dan kamera mati default; status mikrofon besar dan jelas.
- **Kehadiran tanpa pengawasan:** tidak ada pelacakan layar atau keystroke.
- **Aturan jarak yang terlihat:** lingkaran radius di sekitar avatar saat bergerak.
- **Beban visual rendah:** gaya kartun buatan sendiri, palet terbatas, aset dari sprite sheet.
- **Ramah layar sentuh:** gerak lewat ketuk layar menjadi cara utama, sehingga bisa dipakai di ponsel; panel samping dibuka lewat tombol.
- **Petunjuk objek:** objek yang bisa diinteraksi (kursi, mesin penjual, catatan, papan) memunculkan petunjuk dengan nama dan aksi saat didekati atau diketuk, dan notifikasi singkat setelah aksi dijalankan.
- **Onboarding singkat:** layar pengecekan perangkat, tiga petunjuk interaktif, satu ruangan sambutan.
- **Karakter hidup:** bar energi, lapar, haus, dan saldo koin di sudut layar, dengan mode fokus yang menyembunyikannya. Furnitur dipindah dengan tarik-dan-letakkan dengan pratinjau posisi sebelum disimpan.

**Layar MVP:** masuk dan daftar, pengecekan perangkat, peta kantor (panel anggota, chat, bar kontrol), profil dan avatar, undangan anggota, pengaturan organisasi.

---

## 11. Keamanan dan privasi (ringkas)

- Semua lalu lintas lewat TLS; media WebRTC terenkripsi.
- Kata sandi memakai hash modern (argon2 atau bcrypt).
- Otorisasi berbasis peran di server untuk setiap pesan real-time dan panggilan API.
- Tautan undangan dan tamu: kedaluwarsa, bisa dicabut, dibatasi ke ruangan tertentu.
- Pembatasan laju dan perlindungan dari spam chat.
- Pengguna bisa mengekspor dan menghapus datanya.
- Bila dipakai publik: tinjau UU Pelindungan Data Pribadi (UU 27/2022) dan kewajiban penyelenggara sistem elektronik; kebijakan usia minimum.

---

## 12. Risiko dan mitigasi

| Risiko | Mitigasi |
| --- | --- |
| Pengembang tunggal kewalahan | Lingkup MVP ketat; fase dan gerbang; fitur game ditunda |
| WebSocket Vercel masih beta | Spike di M2; sambung ulang otomatis; status di Redis; cadangan layanan real-time terpisah |
| Jatah gratis Neon habis | Posisi dan kehadiran di Redis; batch tulis pesan; pantau pemakaian |
| Batas paket gratis layanan WebRTC terlampaui | Batas peserta per ruang; pantau pemakaian; mesh buatan sendiri untuk grup kecil |
| Gaji koin disalahgunakan (aplikasi dibiarkan menyala atau bot) | Batas harian; koin hanya untuk jam aktif; koin tidak bisa dibeli atau diuangkan |
| Bar lapar dan haus terasa memaksa atau mengawasi | Efek ringan dengan batas minimum; bisa dimatikan; tidak dilaporkan ke siapa pun |
| Minigame saham dianggap judi atau nasihat keuangan | Hanya simulasi; keterangan jelas bahwa ini permainan; tanpa uang asli |
| Efek makanan tidak seimbang | Atur efek tiap item; uji dan setel ulang |
| Beban sinkronisasi dekorasi | Kirim selisih kecil, bukan seluruh peta; batasi objek per ruang |
| Pelanggaran hak cipta aset | Aset buatan sendiri; tidak meniru produk atau karakter lain |

---

## 13. Pendanaan

Aplikasi gratis. Biaya server dan bandwidth ditanggung pemilik proyek dengan paket gratis Vercel, Neon, Redis, dan layanan WebRTC. Batasi biaya dengan batas teknis: sekitar 15 pengguna per ruang, video hanya untuk peserta terdekat, dan pantau pemakaian layanan WebRTC. Sumber dana tambahan (opsional): sponsor atau merek di kantin virtual, iklan non-intrusif di dalam peta, donasi. Tidak ada paket berbayar.

---

## 14. Belum diputuskan

- [ ] **Nama final.** "Meetopia" adalah nama kerja. Per Oktober 2026 nama ini sudah dipakai beberapa pihak lain: aplikasi sosial Android untuk bertemu orang baru (Google Play), proyek video chat dan speed dating di GitHub, proyek aplikasi konferensi video di GitHub, dan startup alat rapat (meetopia.io). Untuk proyek pribadi ini bukan penghalang, tetapi cek ulang sebelum dirilis publik atau mendaftarkan domain.
- [ ] "Notif" objek diartikan sebagai petunjuk di dekat objek ditambah notifikasi singkat setelah aksi. Sesuai, atau maksudnya notifikasi lain (misalnya notifikasi push)?
- [ ] Apakah pengguna bebas membuat grup sendiri atau hanya diundang? (asumsi dokumen ini: bebas membuat)
- [ ] Satu grup satu ruangan 2D di MVP; banyak ruangan per grup ditunda ke fase 3 (P2). Setuju?
- [ ] Penyedia layanan WebRTC terkelola dan paket gratisnya.
- [ ] Penyedia Redis terkelola dan paket gratisnya.
- [ ] Library autentikasi (pilih saat M3).
- [ ] Phaser atau PixiJS (rekomendasi: Phaser).
- [ ] Apakah WebSocket beta di Vercel cukup stabil, atau perlu cadangan terpisah (diputuskan setelah spike M2).
- [ ] Kewajiban data pengguna di Indonesia bila dipakai publik.

---

## 15. Sumber

- Vercel: WebSockets di Vercel Functions, https://vercel.com/docs/functions/websockets
- Vercel KB: Do Vercel Functions support WebSocket connections?, https://vercel.com/kb/guide/do-vercel-serverless-functions-support-websocket-connections
- Contoh Colyseus di Vercel (batas durasi koneksi), https://github.com/endel/colyseus-vercel
- Neon: batas dan kuota paket gratis, https://neon.com/faqs/free-plan-limits-and-quotas
