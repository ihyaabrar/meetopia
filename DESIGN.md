# DESIGN.md: Meetopia

## Revisi acuan visual — 6 Oktober 2026

Arahan terbaru pemilik menggunakan tujuh gambar Meetopia yang dilampirkan: showcase pemilihan map, editor avatar, dan lima denah dunia. Bagian ini menggantikan keputusan warna arang dan tata letak Discord di bawah jika bertentangan.

- UI ink-teal `#09151c`, panel `#11232b`, garis `#253c43`, teks `#f2f7f5`, dan mint `#00cf92`. Mint dipakai untuk aksi utama, pilihan aktif, dan kehadiran; isi map tetap hangat.
- Ruang utama bersifat spatial-first: rail tipis, header global, denah luas, dock melayang; kanal, chat, dan anggota dibuka sesuai kebutuhan. Pencarian area dan tombol fit-map benar-benar mengendalikan navigasi.
- Lima denah baru: kantor, rumah, gaming house, studio kreatif, rooftop tropis. Setiap ruang mempunyai perabot, zona audio, pintu, dan jalur yang sesuai denah. Screenshot acuan tidak dipakai sebagai latar karena UI dan avatar di dalamnya sudah tercetak.
- Koreksi umpan balik pemilik: furnitur canvas-native terlalu sederhana dan pucat. Lima dunia kini memakai aset ilustrasi raster lokal `public/maps/illustrated/`, dibuat dengan imagegen bawaan menggunakan denah renderer sebagai panduan geometri dan gambar pemilik sebagai acuan gaya. Kayu keemasan, kursi berlapis, tanaman rimbun, tekstur serta bayangan mengikuti kualitas ilustrasi acuan; bukan screenshot UI yang ditempel.
- Artwork hanya menggambar lingkungan. Label terjemahan, avatar, mic, pintu terkunci, efek dan interaksi tetap dinamis. Galeri, auth, landing dan ruang utama memakai aset sama; perabot/lampu native tidak digambar ulang di atasnya. Penghalangan visual di belakang furnitur raster tidak memakai sprite depth-sort; collision/jalur tetap berasal dari grid. Native renderer dipertahankan untuk aset gagal dimuat atau denah yang sudah diedit dan tidak cocok dengan geometri template resmi.
- Editor avatar mengikuti lembar acuan terbaru: delapan tab bagian, subtab atasan/bawahan/sepatu, thumbnail renderer asli, serta pemisahan koleksi rambut pria/wanita/universal. Gender adalah titik awal, bukan pembatas bagian.
- Pratinjau mendukung delapan arah, pose berjalan/duduk/melambai/berbicara/mengetik/membaca/kopi, dan simulasi kondisi yang tidak mengubah kebutuhan sebenarnya. Presence jaringan masih memakai empat arah yang kompatibel dengan versi lama; diagonal adalah tampilan editor, bukan delapan frame sprite yang diimpor.
- Rambut, kemeja/polo/sweater/blazer/garis, rok/shorts/kargo, alis, aksen wajah, dan props digambar secara modular. Hijab, kupluk, kacamata hitam, dan ransel ditambah; kacamata serta headphone bisa menjadi lapisan sekunder. Lembar konsep pengguna bukan atlas transparan seragam, sehingga dipakai sebagai referensi, bukan diklaim sebagai spritesheet siap runtime.
- Kondisi lapar/haus/lelah/mengantuk hanya mengikuti LifeState milik diri sendiri ketika efek diaktifkan; tidak disiarkan sebagai Presence ke orang lain. Bicara mengikuti mic nyata, melambai mengikuti emote, duduk mengikuti state duduk. Aktivitas editor lainnya tetap simulasi kosmetik, tidak menyatakan pekerjaan nyata pengguna.
- Avatar lama tetap kompatibel lewat sanitizer; bagian baru tersimpan dalam profil dan digunakan dalam presence real-time. Revisi template dinaikkan agar workspace lama memperoleh denah baru sambil mempertahankan konfigurasi audio.
- Galeri mempunyai pencarian, filter, pilihan map, detail area, dan state kosong. Kontrol pencahayaan diberi label sebagai simulasi pratinjau, bukan pengaturan yang sudah tersimpan.
- Bahasa Indonesia/Inggris, mode terang, kontras tinggi, dan reduced-motion tetap tersedia. Tidak menampilkan angka kehadiran palsu: panel auth diberi label pratinjau.

Verifikasi: `npm run typecheck`, `npm test`, `npm run lint`, `npm run build`; browser QA `node scripts/check-reference-ui.mjs`. Untuk QA terisolasi gunakan `PGLITE_DIR` ke direktori khusus di `.data/`, bukan database pengguna; `CHROMIUM_PATH` dapat menunjuk browser lokal. Screenshot QA berada di `.data/reference-ui/`.

### Fokus frontend, UX, dan aset branding

- Konsep logo dua pintu tetap dipertahankan, dengan mint/paper/ink yang konsisten antara komponen, favicon, dan ekspor SVG. Paket `public/brand/` menyediakan varian gelap, terang, monokrom, serta board panduan. Logo tetap vector-native, bukan bitmap generatif.
- Ikon label area mengikuti fungsi ruang (monitor, sofa, kopi, rapat, controller, dll.) dari sumber path yang sama dengan frontend. Tidak lagi memakai kotak generik di semua area.
- Di ponsel, sudut dan simulasi pose avatar diringkas dalam kontrol yang bisa dibuka. Pratinjau tetap terlihat, sementara pilihan bagian lebih cepat dijangkau.
- Pratinjau map mempertahankan rasio denah saat aset dimuat untuk mengurangi layout shift. Galeri map mendukung panah/Home/End dan roving focus pada radio.
- Hero berhenti saat di luar viewport atau tab tidak aktif. Reduced-motion membekukan karakter, kamera, dan efek; aset ilustrasi tetap digambar kembali setelah selesai dimuat.

## Riwayat arahan — 5 Oktober 2026

Arah desain dari pemilik proyek (dijawab 5 Oktober 2026). Agen hanya menuliskan jawaban ini; keputusan teknis yang diturunkan darinya ada di bagian "Turunan" dan selalu bisa diubah pemilik.

## Arahan pemilik

- **Kesan:** hangat dan santai.
- **Warna dasar UI:** gelap, seperti Discord.
- **Peran hijau logo:** hanya aksen (tombol utama, status online, mic menyala, item terpilih). Tidak dipakai di semua elemen.
- **Acuan:** Discord (struktur dan kepadatan informasi). Diminta eksplisit oleh pemilik, jadi bukan pelanggaran R-30; identitas tetap milik Meetopia (warna arang hangat + hijau logo, bukan ungu Discord).
- **Logo:** konsep 7 (dua daun pintu), dipilih pemilik.

## Turunan (alasan satu baris per keputusan, R-31)

- **Design Read:** ruang kerja tim yang sudah login (kantor virtual) untuk tim kecil dan komunitas, bahasa visual gelap-hangat ala Discord, dial **ENERGY 2 / RHYTHM 1 / MOTION 1**.
  - ENERGY 2: santai tapi tetap alat kerja; energi datang dari peta 2D, bukan dari UI.
  - RHYTHM 1: aplikasi, bukan halaman pemasaran; panel yang seragam memudahkan orientasi.
  - MOTION 1: UI hanya transisi hover dan buka/tutup dialog. Animasi peta (jalan, emote) adalah isi produk, bukan dekorasi.
- **Netral (arang hangat):** abu-arang dengan sedikit cokelat, supaya gelapnya terasa hangat, bukan dingin seperti biru-abu.
- **Teks:** putih krem `#ede8e1` di atas arang, lebih lembut daripada putih murni untuk sesi panjang.
- **Aksen tunggal:** hijau logo. Di latar gelap dipakai versi `#2f7d45` untuk tombol (kontras teks putih lolos AA) dan `#6cc283` untuk ikon/status.
- **Merah:** hanya untuk bahaya (hapus, keluar) dan mic mati. Kuning/ungu hanya untuk titik status (sibuk/rapat/jauh), karena status itu nyata.
- **Huruf:** Outfit, karena bentuknya geometris-membulat seperti wordmark di logo konsep 7.
- **Sudut:** 8px kontrol, 12px panel, 16px dialog. Pil hanya untuk chip pilihan avatar.
- **Bayangan:** hanya untuk lapisan yang melayang di atas konten (dialog, popover, dock, toast).
- **Motif identitas:** pintu dari logo (rail, layar memuat, kartu ruangan) dan tunas daun di avatar bawaan.
- **Tema:** gelap bawaan (pilihan pemilik) + tema terang yang bisa dipilih di Profil (R-21, R-34).
- **Dunia 2D:** lantai/dinding netral hangat; hijau di peta hanya untuk tanaman, logo, dan indikator suara (radius, garis koneksi), karena itu satu-satunya informasi "audio".
