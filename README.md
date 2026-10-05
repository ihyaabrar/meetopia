# Meetopia

**Work • Talk • Together**: kantor virtual 2D berbasis browser. Tampilannya seperti Discord (daftar grup di kiri, kanal, panel anggota), tetapi setiap grup punya ruangan 2D sendiri tempat anggotanya hadir sebagai avatar kartun. Suara mengikuti jarak, bisa berbagi layar, dan ada catatan pribadi maupun bersama.

Spesifikasi lengkap: [`docs/PRD.md`](docs/PRD.md) (dengan status centang per milestone).

## Menjalankan secara lokal

Butuh Node.js 20+. Tidak perlu database atau Redis untuk mencoba.

```bash
npm install
npm run dev          # http://localhost:3000
```

Tanpa `DATABASE_URL`, data disimpan di PostgreSQL lokal dalam proses (PGlite) di folder `.data/`. Tanpa `REDIS_URL`, kehadiran dan pub/sub memakai memori. Tanpa `SMTP_URL`, email verifikasi/reset dicetak ke konsol dan tautannya juga muncul di UI (mode pengembangan saja).

Coba dengan dua jendela (misalnya satu jendela biasa dan satu jendela penyamaran): daftar, buat grup, buat tautan undangan, buka di jendela kedua, lalu jalan-jalan dan nyalakan mikrofon.

| Perintah                             | Kegunaan                                                                                                                                   |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run dev`                        | Server pengembangan (Next.js + WebSocket di satu port)                                                                                     |
| `npm run build` / `npm start`        | Build dan jalankan mode produksi (self-host)                                                                                               |
| `npm run start:realtime`             | Server real-time saja (untuk deploy terpisah dari Vercel)                                                                                  |
| `npm run lint` / `npm run typecheck` | ESLint dan TypeScript                                                                                                                      |
| `npm test`                           | Unit test (Vitest): peta, pencarian jalur, aturan audio, peran, terjemahan                                                                 |
| `npm run test:e2e`                   | Tes end-to-end (Playwright, dua browser): grup, undangan, sinkron posisi, chat, catatan, mic + WebRTC, sambung ulang, ruang privat + ketuk |

Variabel lingkungan ada di [`.env.example`](.env.example). Jangan commit `.env`.

## Struktur

```
server.ts                 Next.js + WebSocket di satu proses (lokal / self-host)
src/
  app/                    Halaman (landing, auth, undangan, /app) dan route API
  components/             UI: logo, avatar, kerangka ala Discord, panel, modal
    app/                  AppShell, RoomStage (peta), Chat, Anggota, Catatan, Pengaturan
  client/                 Kode browser: koneksi ruangan, WebRTC, gambar peta & avatar
  realtime/               Server real-time (hub WebSocket, pub/sub, server mandiri)
  server/                 Database, Redis/memori, auth, email, kueri
  shared/                 Tipe & logika bersama klien-server: peta, jalur, jarak, peran, protokol
  i18n/                   Sistem terjemahan + messages/id.json & en.json
tests/unit, tests/e2e     Vitest dan Playwright
```

## Keputusan teknis (dan alasannya)

PRD meminta solusi paling sederhana untuk pengembang tunggal yang baru mengenal real-time dan WebRTC. Beberapa hal di bagian 14 PRD belum diputuskan; pilihan di bawah dibuat agar aplikasi bisa jalan sekarang **tanpa akun pihak ketiga**, dan semuanya bisa diganti.

| Bagian     | Pilihan                                               | Alasan                                                                                                                                                                                                                                     |
| ---------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Framework  | Next.js 16 (App Router) + TypeScript + React 19       | Satu repo untuk UI dan API; cocok untuk Vercel                                                                                                                                                                                             |
| Kanvas 2D  | Canvas 2D bawaan browser + tilemap & A* sendiri       | Peta kecil (44×28 tile) dan aset prosedural; tidak perlu Phaser/PixiJS. Logika peta ada di `src/shared` sehingga server juga bisa memvalidasi gerak                                                                                        |
| Real-time  | WebSocket (`ws`) + pub/sub                            | Status ruang di Redis, bukan di memori fungsi (aturan 3). Klien menyambung ulang otomatis dan memulihkan posisi (aturan 2)                                                                                                                 |
| Database   | PostgreSQL (Neon) lewat `pg`; PGlite untuk lokal      | SQL biasa, skema di `src/server/schema.ts` dibuat otomatis                                                                                                                                                                                 |
| Redis      | `ioredis` bila `REDIS_URL` ada; memori bila tidak     | Penyedia bisa apa saja yang mendukung protokol Redis (Upstash, Redis Cloud, dll.)                                                                                                                                                          |
| WebRTC     | Mesh buatan sendiri + STUN publik Google              | Tanpa penyedia & tanpa biaya; koneksi hanya ke orang di sekitar (maks. 16 audio, 8 video). Server hanya meneruskan sinyal antar-orang yang memang boleh saling mendengar. Ganti `src/client/media.ts` bila nanti memakai layanan terkelola |
| Auth       | Email + kata sandi (bcrypt), sesi cookie JWT (`jose`) | Sederhana, tanpa library auth besar. Reset kata sandi mencabut semua sesi lama                                                                                                                                                             |
| Email      | `nodemailer` via `SMTP_URL`                           | Konsol saat pengembangan                                                                                                                                                                                                                   |
| Terjemahan | JSON sendiri (`id`, `en`) + React context             | Semua teks UI dari berkas terjemahan; tes memastikan kedua bahasa lengkap                                                                                                                                                                  |

### Aturan PRD yang ditegakkan di kode

1. **Posisi & kehadiran tidak ditulis ke Neon**: hanya Redis/memori (`src/realtime/hub.ts`). Pesan chat ditulis per batch setiap 1 detik; riwayat dipangkas setelah 30 hari.
2. **Sambung ulang otomatis** dengan backoff; posisi terakhir disimpan di Redis dan dipulihkan.
3. **Status ruang lewat pub/sub** (`room:<groupId>`); tiap instance hanya menulis kehadiran pengguna yang soketnya ia pegang.
4. **Hak akses di server** untuk setiap API dan pesan WebSocket (`src/shared/roles.ts`, `src/server/api.ts`). Masuk ruang privat yang sedang dipakai ditolak di server sampai ketukan diterima.
5. **Tidak ada pelacakan layar/keystroke**: "jauh dari layar" hanya dari aktivitas di dalam aplikasi (sinyal "masih di sini" paling sering tiap 30 detik, tanpa isi).
6. **Mikrofon dan kamera mati saat masuk.**

## Deploy

### Vercel (disarankan)

Vercel tidak menyimpan file dan tiap koneksi bisa jatuh ke instance berbeda, jadi tiga layanan gratis ini **wajib** diisi. Tanpa itu, daftar akun gagal dengan pesan "Database belum diatur" atau "AUTH_SECRET belum diisi".

1. **Neon** (database): buat proyek di neon.tech, salin _connection string_ (pilih yang _pooled_, berakhiran `?sslmode=require`).
2. **Upstash** (Redis): buat database Redis di upstash.com, salin URL yang diawali `rediss://`.
3. **AUTH_SECRET**: teks acak minimal 32 karakter, misalnya hasil `openssl rand -base64 32`.
4. Di Vercel: **Project → Settings → Environment Variables**, isi:

   | Nama                  | Isi                                                                     |
   | --------------------- | ----------------------------------------------------------------------- |
   | `DATABASE_URL`        | connection string Neon                                                  |
   | `REDIS_URL`           | URL Upstash (`rediss://...`)                                            |
   | `AUTH_SECRET`         | teks acak tadi                                                          |
   | `APP_URL`             | alamat situsmu, mis. `https://meetopia.vercel.app`                      |
   | `SMTP_URL` (opsional) | untuk email verifikasi/reset; tanpa ini link hanya muncul di log Vercel |

5. **Deployments → Redeploy** (env baru hanya terbaca setelah deploy ulang).
6. Buka `https://alamatmu/api/health`. Semua harus `true`/`"ok"`; kalau ada yang `false`, itulah env yang belum benar.

Integrasi Marketplace Vercel (Neon, Upstash) mengisi env secara otomatis; nama `POSTGRES_URL` dan `KV_URL` juga diterima sebagai pengganti `DATABASE_URL` dan `REDIS_URL`. Pilih region Singapore untuk Neon, Upstash, dan **Settings → Functions → Function Region** agar latensi dari Indonesia rendah. Tabel database dibuat otomatis saat permintaan pertama. Server real-time berjalan di endpoint `/api/ws` memakai `experimental_upgradeWebSocket()` dari `@vercel/functions` (fitur beta Vercel). Koneksi ditutup Vercel setiap 300 detik (batas paket Hobby); klien menyambung ulang otomatis dan posisi dipulihkan dari Redis. Endpoint ini belum bisa diuji di luar Vercel; kalau ternyata bermasalah, pakai cadangan di bawah.

**Cadangan: server real-time terpisah.** Jalankan `npm run start:realtime` di host Node (Railway, Fly.io, Render) dengan `DATABASE_URL`, `REDIS_URL`, `AUTH_SECRET` yang sama, lalu isi `NEXT_PUBLIC_REALTIME_URL` di Vercel dengan alamatnya (mis. `wss://meetopia-rt.fly.dev`).

### Satu server Node

Railway, Render, Fly.io, atau VPS: `npm run build && npm start` dengan `DATABASE_URL`, `AUTH_SECRET`, `APP_URL`, dan opsional `REDIS_URL`/`SMTP_URL`. Next.js dan WebSocket (`/ws`) jalan di port yang sama.

## Identitas visual

Logo memakai **konsep 7 (Minimalist)**: dua daun pintu (satu hijau terbuka, satu gelap tertutup dengan gagang) sebagai "pintu" ke ruang kerja virtual, dengan tagline _Work • Talk • Together_. Komponennya di `src/components/Logo.tsx`, favicon di `src/app/icon.svg`.

Arah tampilan ada di [`DESIGN.md`](DESIGN.md) (diisi dari jawaban pemilik proyek): gelap-hangat ala Discord sebagai bawaan, hijau logo hanya sebagai aksen (tombol utama, status aktif, mic menyala, item terpilih), tema terang dan "ikuti sistem" bisa dipilih di Profil, plus pilihan kontras tinggi. UI diperiksa dengan aturan [antislop](https://github.com/miqdadbadjuber/anti-slop): tanpa gradien/glow/blur dekoratif, tanpa emoji sebagai ikon, tanpa em dash, kontras teks lolos WCAG AA, target sentuh 44px.

### Grafis in-game

Semua aset digambar prosedural (tanpa gambar pihak lain), di `src/client/art/` dan `src/client/scene.ts`:

- **Dunia:** lantai bertekstur per area (papan kayu, karpet ruang rapat, ubin batu lobi), dinding 3/4 dengan jendela dan cahaya matahari, bayangan di kaki dinding, lukisan dinding, label area.
- **Perabot:** meja dengan monitor, kursi kantor, sofa, bean bag, rak buku, papan tulis, mesin penjual, mesin kopi, dispenser, TV, lampu, tanaman (3 jenis), meja resepsionis berlogo. Perabot tinggi diurutkan kedalamannya bersama avatar, jadi avatar bisa berjalan di belakangnya.
- **Avatar:** gaya chibi dengan hoodie, animasi jalan, napas dan kedip, tampak depan/samping/belakang.
- **Efek:** cincin hijau saat seseorang berbicara (dari level suara WebRTC), garis putus-putus ke orang yang bisa kamu dengar, lingkaran radius suara saat berjalan, riak klik, debu langkah, cahaya lampu/layar, sorotan saat berada di ruang privat (area lain diredupkan), emote 👋🎉 dan balon chat "Sekitar" di atas kepala, label nama yang tidak saling bertumpuk.
- **HUD:** chip area saat ini dan jumlah orang di dekatmu, peta mini (klik untuk berjalan), dock kontrol, popup petunjuk objek.

Grup lama ikut mendapat dekorasi baru otomatis (`templateRev` di data peta), pengaturan audionya tetap.

## Belum diputuskan (perlu jawaban pemilik proyek)

Lihat bagian 14 PRD. Pilihan sementara: grup bebas dibuat siapa saja; satu grup satu ruangan 2D; "notif objek" = petunjuk di dekat objek + notifikasi singkat setelah aksi; WebRTC mesh sendiri; Redis penyedia bebas.
