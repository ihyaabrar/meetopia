<div align="center">

<img src="docs/assets/banner.png" alt="Meetopia: kantor virtual 2D di browser. Work, Talk, Together." width="100%">

<h1>
  <img src="docs/assets/logo.svg" alt="" width="40" align="top">
  Meetopia
</h1>

**Kantor virtual 2D di browser, dengan karakter kartun yang "hidup".**<br>
Tampilan ala Discord, tapi setiap workspace punya ruangan 2D sendiri: jalan-jalan, ngobrol dengan suara berdasarkan jarak, berbagi layar, dan menulis catatan bareng.

[**Coba demo →**](https://meetopia-two.vercel.app) &nbsp;·&nbsp; [Spesifikasi (PRD)](docs/PRD.md) &nbsp;·&nbsp; [Arah desain](DESIGN.md)

![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React-19-149eca?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178c6?logo=typescript&logoColor=white)
![WebRTC](https://img.shields.io/badge/WebRTC-mesh-333333?logo=webrtc&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon%20%7C%20PGlite-4169e1?logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-pub%2Fsub-dc382d?logo=redis&logoColor=white)
![Node](https://img.shields.io/badge/Node.js-%E2%89%A520-5fa04e?logo=nodedotjs&logoColor=white)
![Bahasa](https://img.shields.io/badge/UI-Indonesia%20%7C%20English-3f9a55)

<img src="docs/assets/demo.gif" alt="Halaman awal Meetopia: karakter berjalan di peta kantor, lengkap dengan emote dan balon chat" width="90%">

<sub>Halaman awal aplikasi: pratinjau hidup peta kantor. Versi video: <a href="docs/assets/demo.mp4">demo.mp4</a>.</sub>

</div>

---

## Daftar isi

- [Fitur](#fitur)
- [Tangkapan layar](#tangkapan-layar)
- [Mulai cepat](#mulai-cepat)
- [Perintah](#perintah)
- [Struktur proyek](#struktur-proyek)
- [Keputusan teknis](#keputusan-teknis-dan-alasannya)
- [Deploy](#deploy)
- [Identitas visual](#identitas-visual)
- [Peta jalan](#peta-jalan)

## Fitur

|                                |                                                                                                                                                                                                         |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 🚪 **Workspace & ruangan 2D**  | Buat workspace (Kantor, Rumah, atau Gaming house), undang lewat tautan atau kode 6 huruf. Peran pemilik, admin, anggota, tamu ditegakkan di server.                                                     |
| 🎧 **Suara berdasarkan jarak** | Volume mengikuti jarak antar-avatar dan hilang di luar radius. Ruang privat kedap suara, bisa dikunci PIN oleh "pemegang ruangan"; orang luar harus mengetuk.                                           |
| 🖥️ **Berbagi layar & video**   | Satu penyaji per percakapan, berhenti dengan satu klik. Video otomatis untuk orang terdekat (maks. 8 video, 16 audio).                                                                                  |
| 📝 **Catatan**                 | Catatan pribadi dan catatan bersama per ruangan, editor berbasis blok ala Notion (judul, ceklis, daftar, kutipan, kode, pintasan markdown, menu `/`).                                                   |
| 💬 **Chat**                    | Kanal teks, percakapan sekitar (balon di atas kepala), dan pesan langsung. Mention, notifikasi, bunyi, dan notifikasi browser.                                                                          |
| 🟢 **Kehadiran**               | Status aktif/sibuk/rapat/jauh (otomatis setelah 5 menit tanpa aktivitas di aplikasi, tanpa pelacakan layar), status kustom, ketuk sebelum mendekati orang sibuk, lompat ke rekan.                       |
| ☕ **Karakter hidup**          | Bar energi, makan, minum; duduk di sofa atau kasur untuk istirahat. Mesin penjual, mesin kopi, dispenser, kulkas, dan dapur dengan item berbeda. Gaji koin virtual per menit aktif dengan batas harian. |
| 🎵 **Hiburan**                 | Speaker dengan stasiun musik sintesis atau YouTube (suara mengecil saat menjauh), TV untuk nonton YouTube bareng, mesin arcade, emote.                                                                  |
| 🧑‍🎨 **Avatar chibi**            | Tubuh, wajah, rambut, dan warna dipilih saat daftar; animasi jalan, napas, dan kedip. Semua grafis digambar prosedural, tanpa aset pihak lain.                                                          |
| 🌗 **Nyaman dipakai**          | Tema gelap/terang/sistem, kontras tinggi, kurangi gerakan, jalan dengan ketuk/klik atau WASD, UI Indonesia & Inggris.                                                                                   |

## Tangkapan layar

<table>
  <tr>
    <td colspan="2"><img src="docs/assets/room.png" alt="Ruangan kantor dengan lima orang di lounge: label nama, status mic, balon chat, dan panel anggota"><br><sub><b>Ruangan.</b> Lima orang di lounge: garis putus-putus menunjukkan siapa yang bisa saling mendengar.</sub></td>
  </tr>
  <tr>
    <td width="50%"><img src="docs/assets/vending.png" alt="Panel mesin penjual otomatis dengan daftar minuman, efek, dan harga koin"><br><sub><b>Mesin penjual.</b> Tiap item punya efek berbeda; saldo dicek di server.</sub></td>
    <td width="50%"><img src="docs/assets/avatar-builder.png" alt="Pembuat avatar saat mendaftar: tubuh, warna baju, kulit, wajah, rambut"><br><sub><b>Pembuat avatar.</b> Langsung bisa masuk tanpa membeli apa pun.</sub></td>
  </tr>
  <tr>
    <td width="50%"><img src="docs/assets/needs.png" alt="Popover kondisi karakter: bar energi, makan, minum, gaji hari ini"><br><sub><b>Kondisi karakter.</b> Bar kebutuhan, gaji hari ini, dan sakelar efek.</sub></td>
    <td width="50%"><img src="docs/assets/settings-life.png" alt="Pengaturan workspace bagian Dunia hidup"><br><sub><b>Pengaturan admin.</b> Semua mekanik bisa dimatikan atau diatur per workspace.</sub></td>
  </tr>
</table>

## Mulai cepat

Butuh **Node.js 20+**. Tidak perlu database, Redis, atau akun pihak ketiga untuk mencoba.

```bash
git clone https://github.com/ihyaabrar/meetopia.git
cd meetopia
npm install
npm run dev          # http://localhost:3000
```

Tanpa `DATABASE_URL`, data disimpan di PostgreSQL dalam proses (PGlite) di folder `.data/`. Tanpa `REDIS_URL`, kehadiran dan pub/sub memakai memori. Tanpa `SMTP_URL`, email verifikasi/reset dicetak ke konsol dan tautannya juga muncul di UI (mode pengembangan saja).

Coba dengan dua jendela (misalnya satu jendela biasa dan satu jendela penyamaran): daftar, buat workspace, buat tautan undangan, buka di jendela kedua, lalu jalan-jalan dan nyalakan mikrofon.

Variabel lingkungan ada di [`.env.example`](.env.example). Jangan commit `.env`.

## Perintah

| Perintah                             | Kegunaan                                                                                                                                                                  |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`                        | Server pengembangan (Next.js + WebSocket di satu port)                                                                                                                    |
| `npm run build` / `npm start`        | Build dan jalankan mode produksi (self-host)                                                                                                                              |
| `npm run start:realtime`             | Server real-time saja (untuk deploy terpisah dari Vercel)                                                                                                                 |
| `npm run lint` / `npm run typecheck` | ESLint dan TypeScript                                                                                                                                                     |
| `npm test`                           | Unit test (Vitest): peta, jalur, aturan audio, peran, terjemahan, kebutuhan karakter & koin                                                                               |
| `npm run test:e2e`                   | Tes end-to-end (Playwright, dua browser): grup, undangan, sinkron posisi, chat, catatan, mic + WebRTC, sambung ulang, ruang privat, speaker, berbagi layar, mesin penjual |

Playwright memakai Chromium di `/opt/pw-browsers` secara bawaan; di mesin lain isi `CHROMIUM_PATH` dengan path Chromium/Chrome.

## Struktur proyek

```
server.ts                 Next.js + WebSocket di satu proses (lokal / self-host)
src/
  app/                    Halaman (landing, auth, undangan, /app) dan route API
  components/             UI: logo, avatar, kerangka ala Discord, panel, modal
    app/                  AppShell, RoomStage (peta), Chat, Anggota, Catatan, Toko, Pengaturan
  client/                 Kode browser: koneksi ruangan, WebRTC, musik, gambar peta & avatar
  realtime/               Server real-time (hub WebSocket, pub/sub, server mandiri)
  server/                 Database, Redis/memori, auth, email, kueri
  shared/                 Logika bersama klien-server: peta, jalur, jarak, peran, protokol, kebutuhan
  i18n/                   Sistem terjemahan + messages/id.json & en.json
tests/unit, tests/e2e     Vitest dan Playwright
docs/                     PRD dan aset README
```

## Keputusan teknis (dan alasannya)

PRD meminta solusi paling sederhana untuk pengembang tunggal yang baru mengenal real-time dan WebRTC. Beberapa hal di bagian 14 PRD belum diputuskan; pilihan di bawah dibuat agar aplikasi bisa jalan sekarang **tanpa akun pihak ketiga**, dan semuanya bisa diganti.

| Bagian     | Pilihan                                               | Alasan                                                                                                                                                                                                                                     |
| ---------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Framework  | Next.js 16 (App Router) + TypeScript + React 19       | Satu repo untuk UI dan API; cocok untuk Vercel                                                                                                                                                                                             |
| Kanvas 2D  | Canvas 2D bawaan browser + tilemap & A\* sendiri      | Peta kecil (44×28 tile) dan aset prosedural; tidak perlu Phaser/PixiJS. Logika peta ada di `src/shared` sehingga server juga bisa memvalidasi gerak                                                                                        |
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

### Dunia hidup (Fase 2, langkah 1–3)

Logika ada di `src/shared/life.ts` (murni, dipakai server dan klien); server menghitungnya di `src/realtime/hub.ts`.

- **Bar energi, makan, minum** turun pelan hanya selama online dan disimpan di Redis (`needs:<grup>:<pengguna>`), bukan Neon (aturan 1). Duduk memulihkan energi: kursi pelan, sofa/beanbag lebih cepat, kasur paling cepat.
- **Efek ringan** saat bar di bawah 15: jalan paling lambat 70%, suara orang lain paling pelan 50%, layar buram maksimal 1,5 px. Chat dan berbagi layar tidak pernah terkunci. Admin bisa mematikan efek per grup, pengguna per perangkat (aturan 6).
- **Tempat makan/minum** ditentukan jenis objek: mesin penjual (instan, lebih mahal), mesin kopi (menunggu 3 detik), dispenser & kulkas (air gratis), dapur (menu lengkap, lebih murah, menunggu). Harga, jarak, dan saldo diperiksa di server; saldo tidak bisa negatif (`CHECK (coins >= 0)` dan `UPDATE ... WHERE coins >= harga`).
- **Gaji koin**: 1 koin per menit aktif (bawaan 60/jam, batas 480/hari, keduanya bisa diatur admin). Tidak dihitung saat status "jauh dari layar". Koin terkumpul di memori dan dicairkan ke tabel `wallets` setiap ~10 koin, saat membeli, dan saat keluar, agar Neon tetap bisa tidur. Koin hanya virtual (aturan 5).
- Pengaturan per grup di **Pengaturan workspace → Dunia hidup** (kolom `groups.life`), berlaku langsung ke semua orang di ruangan lewat pub/sub.

### Speaker dan TV

- **Speaker** (`src/shared/music.ts`, `src/client/music.ts`): empat stasiun bawaan yang disintesis dengan Web Audio (Lo-fi santai, Ambient fokus, Piano sore, Kafe 8-bit), tautan audio langsung (https, mis. `.mp3`), atau video YouTube (hanya suaranya). Volume dihitung di tiap browser dari jarak ke speaker: penuh sampai 2,5 tile, hilang di 12 tile, teredam dinding dari area lain. Posisi lagu dihitung dari jam server, jadi semua orang mendengar bagian yang sama.
- **TV**: anggota di dekat TV bisa memutar video YouTube untuk ditonton bersama di popup yang bisa diperbesar.

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

Integrasi Marketplace Vercel (Neon, Upstash) mengisi env secara otomatis; nama `POSTGRES_URL` dan `KV_URL` juga diterima sebagai pengganti `DATABASE_URL` dan `REDIS_URL`. Pilih region Singapore untuk Neon, Upstash, dan **Settings → Functions → Function Region** agar latensi dari Indonesia rendah. Tabel database dibuat otomatis saat permintaan pertama. Server real-time berjalan di endpoint `/api/ws` memakai `experimental_upgradeWebSocket()` dari `@vercel/functions` (fitur beta Vercel). Koneksi ditutup Vercel setiap 300 detik (batas paket Hobby); klien menyambung ulang otomatis dan posisi dipulihkan dari Redis.

**Cadangan: server real-time terpisah.** Jalankan `npm run start:realtime` di host Node (Railway, Fly.io, Render) dengan `DATABASE_URL`, `REDIS_URL`, `AUTH_SECRET` yang sama, lalu isi `NEXT_PUBLIC_REALTIME_URL` di Vercel dengan alamatnya (mis. `wss://meetopia-rt.fly.dev`).

### Satu server Node

Railway, Render, Fly.io, atau VPS: `npm run build && npm start` dengan `DATABASE_URL`, `AUTH_SECRET`, `APP_URL`, dan opsional `REDIS_URL`/`SMTP_URL`. Next.js dan WebSocket (`/ws`) jalan di port yang sama.

## Identitas visual

<img src="docs/assets/logo.svg" alt="Logo Meetopia: dua daun pintu" width="64" align="right">

Logo memakai **konsep 7 (Minimalist)**: dua daun pintu (satu hijau terbuka, satu gelap tertutup dengan gagang) sebagai "pintu" ke ruang kerja virtual, dengan tagline _Work • Talk • Together_. Komponennya di `src/components/Logo.tsx`, favicon di `src/app/icon.svg`, versi berkas di [`docs/assets/logo.svg`](docs/assets/logo.svg).

Arah tampilan ada di [`DESIGN.md`](DESIGN.md): gelap-hangat ala Discord sebagai bawaan, hijau logo hanya sebagai aksen (tombol utama, status aktif, mic menyala, item terpilih), tema terang dan "ikuti sistem" bisa dipilih di Pengaturan, plus pilihan kontras tinggi. Huruf: Outfit.

Semua grafis in-game digambar prosedural di `src/client/art/` dan `src/client/scene.ts`: lantai bertekstur per area, dinding 3/4 dengan jendela, perabot (meja, sofa, rak, papan tulis, mesin penjual, speaker, TV, arcade, kasur, dapur), avatar chibi dengan animasi, cincin hijau saat seseorang berbicara, garis ke orang yang bisa kamu dengar, emote, dan balon chat.

## Peta jalan

Status rinci ada di [`docs/PRD.md`](docs/PRD.md).

- [x] **MVP (M0–M8):** akun, workspace, peta 2D, sinkron posisi, chat, kehadiran, catatan, suara berdasarkan jarak, berbagi layar, ruang privat & ketuk
- [x] **Fase 2, langkah 1–3:** bar kebutuhan, kantin & mesin penjual, gaji koin
- [ ] **Fase 2, langkah 4:** toko pakaian & aksesori, lemari, toko perabot
- [ ] **Fase 2, langkah 5–7:** dekorasi tarik-letakkan, editor peta, minigame saham, login Google/Lark, rekaman sesi
- [ ] **Fase 3:** absensi, analitik tim, banyak peta per workspace, API & webhook

Keputusan yang masih menunggu pemilik proyek ada di bagian 14 PRD. Pilihan sementara: workspace bebas dibuat siapa saja; satu workspace satu ruangan 2D; WebRTC mesh sendiri; penyedia Redis bebas.

---

<div align="center">
<sub>Proyek pribadi, gratis, untuk kantor, kelompok, dan komunitas kecil. Koin di dalam aplikasi hanya virtual.</sub>
</div>
