# Meetopia visual & interaction rollout

Scope approved 7 October 2026: preserve existing avatar/profile edits; finish the outstanding UI work, and separate environment wallpaper from interactive furniture.

- [x] Layered environment: floor/walls/rugs in the base layer, independent illustrated furniture and props. Five worlds, 285 independent objects, 36 catalog kinds.
- [x] Shared seat anchors, four chair directions, server-validated sitting, chair/desk occlusion, sofa slots and atomic seat ownership.
- [x] Avatar anatomy/accessory regression at actual production scale; saved profile consistency. User's existing avatar fixes preserved.
- [x] Direction-aware held props and all 44 rig action previews, reduced-motion support. Back-held items render behind the torso; presentation board is no longer duplicated.
- [x] Map ambience, material palette and real room-size geometry persisted and previewed accurately. Theme replacement preserves saved size; edited layouts are protected from automatic upgrades.
- [x] Furniture editor: add, drag/move, four orientations, footprint rotation, delete, undo, validation and live collision updates. Keyboard and X/Y controls included.
- [x] Consensual paired social gestures with shared server timing: handshake, high five and fist bump.
- [x] Workspace agenda, tasks, resource links and file panels with persistence, search, empty/error states, role checks and cross-user updates. Upload body/MIME/size/quota validation included.
- [x] Five-map navigation/collision geometry: every zone and sofa slot reachable in 15 world/size combinations; independent depth-rendering screenshots reviewed.
- [x] Asset loading/performance checks and current architecture documentation. Environment sources retained with alpha, q90 runtime WebP ~1.62 MiB; repeated world/props loads share a decoding request.
- [x] Final responsive editor/board and keyboard smoke run. Save controls stay below the preview, not over it; status/buttons have separate mobile rows. Screenshot review completed.
- [x] Realtime connection regression: welcome includes the current avatar, command handlers are ready before welcome, and bounded asynchronous processing preserves stand/move/sit/invite order. Late initialization responses cannot overwrite editor drafts.

Completion requires tests and screenshot review; animation continuity tests alone are not visual approval. Hand-drawn bitmap atlases remain separate from the customizable avatar rig: they are not a complete authored 44-action × 8-direction sprite pack.

## Verification

- TypeScript and lint passed; **199 unit tests in 17 files** passed, including simultaneous seat lease claims, lease expiry/renewal and asynchronous command ordering/error recovery.
- `check-layered-world.mjs`: five worlds, 285 separate furniture sprites, four seated directions.
- `check-avatar-stage.mjs`: 104 attached heads, 1,664 movement frames, 52 proportion checks, 24 body/direction cases; reference/name-label fixtures reviewed.
- `check-avatar-ui.mjs`: all 44 cosmetic actions, visible short neck, reduced motion, live diagonal direction, peer action sync and private-needs isolation passed.
- Final production build passed after all source changes, including the mobile footer and connection/editor race fixes. Browser testing is isolated/headless: not an inspection of the user's signed-in browser session.
- `check-workspace-features.mjs` passed twice after the initialization-race fix: two QA users test occupied seating, three accepted paired gestures, persisted map appearance, optimistic conflicts, profile retention, board CRUD/file download, editor save/keyboard editing, theme/size preservation, mobile footer non-overlap and focus containment.
- Cold production measurement at 1.6 Mbps, 150 ms latency: canvas visible ~4.48 s; complete avatar/environment artwork ~49.63 s, **9.20 MB** downloaded. Unthrottled warm-cache run: canvas ~5.04 s, art load events ~4.79 s on the test machine. Report: `.data/layered-world/performance.json`. These are diagnostics, not a passed three-second target. Asset events occur before canvas draw/QA observation; timings are not all interchangeable.

## Remaining art/product work — do not label finished

- [ ] Reduce cold-download cost without damaging avatar recolor/neck masks (lossless avatar atlases dominate); loading/splitting strategy needs further work.
- [ ] Fully authored 44-action × 8-direction frame packs with matching directional sleeves/legs for every clothing family. Current actions are animated with the customizable rig; they are functional, not fully redrawn frame sheets.
- [ ] Separate modern/industrial/tropical model kits. Current material palette changes color grading, not furniture construction/design.
- [ ] Real minigames for gaming desks/arcade/foosball if desired. Previous randomly generated “scores” were removed; no game result is fabricated. These were existing placeholders, not implemented games in this UI pass.

Entry points: Map → Ruangan for gallery/appearance/size, Map → Editor furnitur for objects; left rail Agenda/Tugas/File for boards. On mobile open “Buka menu” first. Original PNGs and exact built-in imagegen prompts: `public/environment/PROMPTS.md`.

## Follow-up master workstation and directional torso — 7 October 2026

- Warm oak master desk/chair/monitor/keyboard now has four separately authored furniture directions with a shared operator-facing contract, independent props, preserved image aspect ratios and cardinal-edge seating inference. Desk rotations swap ground dimensions; legacy saved layouts are not silently rotated.
- Contact anchors align seated pelvis with cushion and contextual typing hands with the keyboard. Depth passes keep upper bodies above side desktops and chair backrests in front; monitor rear casing remains in front of typing hands when facing down.
- User's “shirt looks pasted on” screenshot traced to the FRONT-only body-kit torso being used for all non-rear articulated poses. New `torso-directions-v4` supplies front/quarter/profile/rear bodices for all eight outfits; fixed sleeve lobes were removed using imagegen before integration. Each view's actual neck center/collar controls placement. Unified daily bodies-v3, saved profile choices and original sources remain unchanged.
- New `/asset-lab` is a noindex isolated comparison page using the production Scene renderer, with body/gender/outfit/pose/zoom/contact-guide/animation controls. It does not update any user's profile or map.
- Follow-up checks: **213 unit tests in18 files**, TypeScript and scoped lint passed; avatar-stage retained104 connected heads +1,664 locomotion frames; avatar-torso checked2,304 articulated renders (8outfits ×3bodies ×8headings ×4actions ×3times); workstation48 static draws + four dynamic typing snapshots; layered-world five maps/285 objects/four seating directions; asset-lab UI1100/390px controls/no overflow/no browser errors. Images were inspected separately; silhouette tests alone are not visual sign-off.
- These assets are an illustrated prototype, not a certified45° 3D projection or completion of all furniture/action packs. See `docs/ASSET-STANDARD.md` for full inventory, angle/scale contracts and remaining work. Prompts: `public/environment/workstation-v2-PROMPTS.md` and `public/avatars/painted/torso-directions-v4-PROMPTS.md`.
- Final follow-up `npm run lint` and optimized production build passed, including `/asset-lab`. The default localhost development server was restored after the build.

## Perbaikan bug 8 Oktober 2026

- **Realtime:** antrean pesan per koneksi kini menggabungkan pesan gerak yang masih menunggu (hanya posisi terbaru yang diproses), jadi Redis yang lambat (Upstash dari Vercel) tidak membuat posisi tertinggal beberapa detik atau antrean penuh. Urutan terhadap perintah lain (duduk, ajakan) tetap terjaga.
- **Keamanan:** `?next=` setelah login/daftar hanya menerima path situs ini (`//evil.com` ditolak), lihat `src/shared/redirect.ts`.
- **Bahasa:** editor furnitur, pesan validasi tata ruang, ajakan gestur bersama, dan pesan kursi kini lewat berkas terjemahan; sebelumnya pengguna berbahasa Inggris melihat teks Indonesia. Kursi yang terlalu jauh tidak lagi memakai pesan "Terlalu jauh dari speaker".
- **Panel anggota** (layar ≥ 1100 px) di samping peta, bukan menutupinya; objek di sisi kanan peta tetap bisa diketuk.
- **Editor furnitur:** barang baru diletakkan di tempat kosong terdekat dari tengah map, bukan di pojok kiri atas.
- **Agenda/Tugas/File:** tombol Tambahkan tidak lagi berupa blok setinggi form; tombol pilih file bergaya aplikasi; tombol tutup tetap di kanan atas di ponsel.
- **Aset:** PNG sumber lingkungan dan torso dipindah ke `.data/asset-originals/` (tidak di-commit); yang dikirim ke browser hanya WebP. `scripts/optimize-environment.mjs` membaca sumber dari sana.


## Pemeriksaan mandiri 8 Oktober 2026 (lanjutan)

- **Log produksi (Vercel, 7 hari):** satu-satunya baris berlevel error adalah peringatan `pg` tentang `sslmode=require`. `pgConnectionString()` di `src/server/env.ts` kini menulis `sslmode=verify-full` secara eksplisit (perilaku sama: sertifikat tetap diverifikasi, tidak melemah saat pg v9) sehingga peringatan tidak muncul lagi.
- **Muat ulang cepat tidak lagi memindahkan avatar ke titik muncul.** Posisi terakhir baru ditulis setelah masa tenggang 3 detik, jadi muat ulang di dalam masa itu dulu berakhir di spawn dan bisa menumpuk di atas rekan. Hub kini memakai presence yang masih tercatat (instance mana pun). Titik muncul baru juga mempertimbangkan tinggi avatar + label nama (rekan tepat di atas/bawah harus berjarak ≥ 3 tile).
- **Laci navigasi seluler:** tombol Chat/Catatan/Anggota/Map di rail menutup laci (sebelumnya panel terbuka di belakang laci); Escape menutup laci.
- **Dikeluarkan / grup dihapus saat di dalam ruangan:** koneksi ruangan lama dilepas dan `?g=` dibersihkan; header tidak lagi menampilkan pencarian area dan tombol chat ruangan lama, judul menjadi "Beranda".
- **Anggota & peran** diurutkan pemilik → admin → anggota → tamu, lalu nama.
- **Bahasa:** label rail Agenda/Tugas/File dan grup gestur bersama lewat berkas terjemahan.
- Diperiksa tanpa galat konsol/HTTP: catatan bersama dua arah, catatan pribadi, pengaturan akun & workspace (semua tab), notifikasi, papan, ubah peran (langsung terlihat oleh rekan), keluarkan anggota, keluar grup, hapus grup saat rekan di dalam, halaman publik & ruangan di 390 px tanpa scroll horizontal.
- `scripts/check-reference-ui.mjs` disesuaikan dengan UI sekarang (pratinjau avatar diputar dengan "Putar ke kanan", tombol "Pose & kondisi", pencarian galeri map di Map → Ruangan karena dialog buat workspace memakai pemilih ringkas). Kedelapan skrip `scripts/check-*.mjs` lulus, juga 217 tes unit, TypeScript, dan lint.
