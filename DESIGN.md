# DESIGN.md: Meetopia

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
