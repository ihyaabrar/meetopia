# Meetopia 3D — riset, rancangan, dan backlog menyeluruh

Tanggal riset: 10 Oktober 2026. Status: **proposal sebelum implementasi**, bukan laporan fitur 3D yang sudah selesai.

Update 11 Oktober 2026: master prosedural 3D terisolasi sudah mulai diimplementasikan di `/3d-lab`. Lihat [status master dan batas implementasi](MEETOPIA-3D-MASTER.md). Audit dan backlog di bawah tetap merekam baseline saat riset; jangan menganggap seluruh migrasi sudah selesai.

Permintaan: mengubah keseluruhan UI Meetopia menjadi pengalaman kantor virtual 3D memakai Three.js, dengan karakter sesuai referensi chibi pengguna. Referensi dipilih dari GitHub berdasarkan lingkungan kantor, karakter, interaksi, dan kolaborasi; bukan kemiripan sidebar Discord.

## 1. Kesimpulan dan batas riset

Rekomendasi: **Meetopia tetap menjadi aplikasi sendiri**, dengan Next.js/React yang ada, renderer Three.js melalui React Three Fiber, karakter chibi rigged GLB, furnitur modular 3D, dan panel HTML yang didesain ulang. Akun, workspace, data tim, hak akses, dan layanan realtime tidak dibuang hanya untuk mengganti tampilan.

Semua model interaktif harus benar-benar memiliki volume, ukuran, pivot, collider, dan titik interaksi. PNG referensi adalah acuan bentuk/warna, bukan meja/kursi yang dipasang sebagai bidang gambar di dunia 3D. Foto, poster, ikon emote, dan skyline jauh boleh memakai tekstur/billboard sesuai kebutuhan.

Riset memeriksa README, lisensi, metadata GitHub API, dokumentasi resmi, struktur beberapa repo, dan source Meetopia. Demo eksternal belum dijalankan; belum ada benchmark GPU, uji beban, ataupun sertifikasi kualitas animasi repo referensi. `pushed_at` di bawah adalah aktivitas push yang teramati, bukan bukti maintenance, keamanan, atau kualitas produksi. Source publik tidak otomatis bebas digunakan; lisensi kode dan aset diperiksa terpisah.

Asumsi kerja: browser desktop sebagai target utama, ponsel tetap didukung, satu lantai per dunia pada rilis awal, avatar chibi 3D khusus Meetopia, dan lima tema yang sudah diminta. Kapasitas peserta, perangkat minimum, biaya aset, dan media server belum diputuskan pengguna.

## 2. Referensi GitHub yang paling relevan

| Referensi | Yang dapat dipelajari | Batas penting | Lisensi dan push teramati |
| --- | --- | --- | --- |
| [DeskRPG](https://github.com/dandacompany/deskrpg) | Kantor miniatur Three.js, lima lingkungan, karakter GLB utuh, duduk di meja, kamera meeting dan dinding penghalang yang memudar | Produk berpusat pada agen AI meskipun mendukung beberapa pengguna. Referensi ruang dan interaksi; jangan langsung menjadikannya basis SaaS Meetopia | Sustainable Use License; 7 Okt 2026 |
| [Hermes3D](https://github.com/iamlukethedev/Hermes3D) | Organisasi fitur office, builder, preview avatar, renderer 3D terpisah dari data aplikasi | Visualisasi agen AI; dokumen arsitektur menyebut koordinasi multi-user/multi-tenant sebagai non-goal. Bukan pengganti meeting manusia | MIT; 29 Agu 2026 |
| [ai-office](https://github.com/Gaurav2693/ai-office) | Komposisi kantor isometrik, workstation, pantry, lounge, monitor hidup, aktivitas karakter dan perubahan waktu | README menyebut visualisasi frontend lokal, bukan layanan multiplayer manusia. Bentuk voxel bukan target avatar chibi Meetopia | MIT; 31 Mar 2026 |
| [Hubs](https://github.com/Hubs-Foundation/hubs) | Kolaborasi manusia dalam ruang 3D pada desktop/mobile/VR; batas client, room, presence dan backend | Stack A-Frame dan infrastruktur tersendiri; tidak cocok dipasang utuh ke Next.js Meetopia | MPL-2.0; 23 Agu 2026 |
| [Spoke](https://github.com/Hubs-Foundation/Spoke) | Pola editor lingkungan 3D, penempatan aset dan authoring scene | Referensi editor, bukan aplikasi kantor lengkap. Kewajiban lisensi diperiksa per berkas bila mengambil kode | Campuran MPL-2.0 dan MIT; 23 Agu 2026 |
| [threejs-webrtc](https://github.com/AidanNelson/threejs-webrtc) | Template pemisahan rendering, multiplayer Socket.IO dan signaling WebRTC audio/video | Template teknis, bukan UI kantor matang atau bukti kapasitas meeting tertentu | MIT; 6 Apr 2026 |
| [wooglies](https://github.com/jure/wooglies) | Snapshot interpolation, posisi suara, integrasi stream WebRTC dengan Web Audio, kamera karakter | Eksperimen yang secara eksplisit bukan aplikasi production-ready; aset/shader punya pengecualian lisensi | Kode MIT, shader terpisah; 28 Feb 2021 |
| [YORB2020](https://github.com/AidanNelson/YORB2020) | Gagasan ruang bersama untuk bekerja berdekatan dan bertemu, bukan dashboard chat | Repo lama; README meminta menghubungi pemilik untuk penggunaan. Referensi konsep, tidak mengambil kode/aset tanpa izin | Lisensi belum ditetapkan; 7 Sep 2023 |

Data push/arsip diperiksa melalui endpoint GitHub `https://api.github.com/repos/{owner}/{repo}` untuk setiap baris. Tidak ada baris di atas yang ditandai archived saat pemeriksaan, tetapi repo lama tetap diperlakukan sebagai referensi historis.

Catatan lisensi DeskRPG: [teks lisensinya](https://github.com/dandacompany/deskrpg/blob/master/LICENSE.md) membatasi penggunaan pada bisnis internal/nonkomersial/pribadi dan menyebut pengecualian penyedia infrastruktur yang tidak sama dengan menjalankan managed service. Karena model bisnis Meetopia belum diputuskan, **tidak mengimpor kode atau aset DeskRPG** merupakan pilihan kerja awal. Ini pencatatan risiko, bukan pendapat hukum.

[Arsitektur Hermes3D](https://github.com/iamlukethedev/Hermes3D/blob/main/ARCHITECTURE.md) dan [package.json-nya](https://github.com/iamlukethedev/Hermes3D/blob/main/package.json) mendukung relevansinya sebagai studi integrasi Next.js/React/Three.js. [Lisensi Spoke](https://github.com/Hubs-Foundation/Spoke/blob/master/LICENSE) secara eksplisit memisahkan kode turunan editor Three.js dari bagian MPL.

### Referensi karakter dan fondasi teknis

| Referensi | Kegunaan untuk Meetopia | Keputusan |
| --- | --- | --- |
| [ecctrl](https://github.com/pmndrs/ecctrl) | Controller karakter R3F/Rapier, kamera dan state locomotion | Kandidat eksperimen controller; bukan penyedia karakter atau 44 animasi kantor. Bandingkan dengan controller kinematic sederhana sebelum dipilih |
| [three-vrm](https://github.com/pixiv/three-vrm) | Menampilkan format avatar VRM dengan Three.js | Opsional untuk impor avatar kelak. Bukan generator chibi; lisensi library MIT tidak memberikan hak atas setiap model VRM |
| [three-pathfinding](https://github.com/donmccurdy/three-pathfinding) | Navigasi berbasis navmesh | Kandidat click-to-move jika editor menghasilkan navmesh; server tetap memvalidasi pergerakan |
| [React Three Fiber](https://github.com/pmndrs/react-three-fiber) | Integrasi scene Three.js ke React | Fondasi yang direkomendasikan; [dokumentasi resmi](https://r3f.docs.pmnd.rs/getting-started/introduction) memasangkan R3F 9 dengan React 19 |
| [React Three Rapier](https://github.com/pmndrs/react-three-rapier) | Collider dan physics terintegrasi R3F | Batasi pada kebutuhan nyata, bukan simulasi setiap barang. Controller dan pose duduk tidak boleh sekaligus mengendalikan root |
| [glTF-Blender-IO](https://github.com/KhronosGroup/glTF-Blender-IO) | Jalur impor/ekspor glTF Blender | Model sumber Blender dan keluaran GLB yang bisa diaudit |
| [glTF Transform](https://github.com/donmccurdy/glTF-Transform) | Pemeriksaan dan optimasi aset glTF | Pipeline aset; perubahan kompresi wajib diuji terhadap skinning/morph/animation |
| [LiveKit](https://github.com/livekit/livekit) | Kandidat SFU WebRTC jika kapasitas media perlu meningkat | Evaluasi terpisah dari renderer. Tidak otomatis mengganti backend atau memasang layanan berbayar |

Untuk blockout: [Kenney Furniture Kit](https://kenney.nl/assets/furniture-kit) dan [Quaternius Universal Base Characters](https://quaternius.com/packs/universalbasecharacters.html) mencantumkan CC0. Pilih paket/versi yang benar dan simpan lisensinya. Bentuk akhir karakter tetap perlu diadaptasi ke referensi chibi pengguna. [Universal Animation Library 2](https://quaternius.com/packs/universalanimationlibrary2.html) adalah kandidat retargeting gerakan umum, bukan jaminan semua gerakan kantor tersedia; halaman paket membedakan versi gratis dan Source, sehingga jangan mengasumsikan seluruh isi/source gratis.

### Kandidat yang sengaja tidak dijadikan fondasi

- [SkyOffice](https://github.com/kevinshen56714/SkyOffice): kantor 2D, bukan jawaban migrasi karakter/ruang 3D.
- [Vircadia Web](https://github.com/vircadia/vircadia-web): README menyatakan deprecated dan menunjuk [Vircadia World](https://github.com/vircadia/vircadia-world); platform besar ini bukan pilihan awal untuk migrasi renderer Meetopia.
- [v-office](https://github.com/fardin0045/v-office): halaman publik yang diperiksa berisi README dan `.gitignore`, sehingga klaim fiturnya tidak dianggap bukti source implementasi lengkap.
- [r3f-sims-online](https://github.com/wass08/r3f-sims-online): berguna sebagai demo karakter/multiplayer, tetapi lisensi tidak ditemukan pada metadata/README yang diperiksa; tidak mengambil kode/aset tanpa pemeriksaan lanjutan.
- [LiveKit spatial-audio](https://github.com/livekit-examples/spatial-audio): demo audio resmi dengan dunia **2D**. Relevan untuk stereo/volume berdasarkan posisi, bukan referensi visual kantor 3D.

Tidak ada satu repo yang telah diverifikasi memenuhi seluruh kebutuhan Meetopia: UI lengkap, chibi yang sama dengan referensi, wardrobe modular, 44 aksi, lima dunia, interaksi furnitur, privacy, dan media berskala. Rekomendasi merupakan sintesis desain sendiri, bukan klaim ada template siap pakai untuk semuanya.

## 3. Audit Meetopia saat ini dan implikasi migrasi

Audit graphify menggunakan graf yang sudah ada untuk menemukan hubungan, lalu memeriksa source aktual. Graf tidak dianggap lebih mutakhir daripada source. Tidak ada kode aplikasi yang diubah selama riset.

| Bagian sekarang | Bukti lokal | Tindakan yang direncanakan |
| --- | --- | --- |
| Next.js 16, React 19, TypeScript; belum ada dependency Three.js/R3F | `package.json` | Pertahankan framework; pin dependency 3D yang peer-dependency-nya cocok setelah spike |
| Renderer Canvas 2D dan depth-sorting bitmap | `src/client/scene.ts`, `src/client/art/world.ts` | Tambahkan renderer 3D baru, tidak menambal bitmap menjadi bidang 3D |
| Panggung, input dan kamera berhubungan dengan room state | `src/components/app/RoomStage.tsx` | Pisahkan input, scene, kamera dan adapter realtime |
| Lima template: office/home/gaming/studio/rooftop | `src/shared/templates.ts` | Pertahankan identitas dunia; bangun lima scene 3D berbeda |
| 36 jenis objek, grid TILE=32, posisi dan ukuran 2D | `src/shared/map.ts` | Asset catalog 3D, meter, yaw, sockets dan collider; migrasi map eksplisit |
| Pilihan avatar, delapan arah dan 44 aksi logis | `src/shared/avatar.ts`, `src/shared/avatar-animation.ts` | Pertahankan ID pilihan; buat model/skinning/clip 3D dengan mapping kompatibilitas |
| Kursi dan meja memiliki helper attachment bersama | `src/shared/seats.ts`, `src/shared/workstation.ts` | Ganti offset gambar dengan kontrak seat/desk socket fisik; pertahankan validasi kepemilikan seat |
| Presence dan move memakai x/y, dir, moving, seatId, avatarAction | `src/shared/protocol.ts`, `src/client/roomClient.ts` | Adapter 2D→lantai X/Z terlebih dahulu; protokol v2 hanya setelah kontrak final |
| Realtime, antrean, roles, locks dan penyimpanan | `src/realtime/hub.ts`, `src/server/`, `src/shared/roles.ts` | Dipertahankan; perubahan perlu regression test agar 3D tidak melemahkan izin |
| Peer connections media langsung | `src/client/media.ts` | Pisahkan transport media dari visual. Uji mesh; evaluasi SFU jika target pengguna mengharuskan |
| Batas saat ini 16 audio peer/8 video peer, privacy zona dan busy | `src/shared/proximity.ts` | Batas konfigurasi bukan bukti kapasitas. Pertahankan aturan privacy server; ukur CPU/uplink sebelum menetapkan kapasitas |
| Landing/auth/avatar/gallery, chat/notes/members, agenda/task/resource/file, settings/editor | `src/app/`, `src/components/`, `src/components/app/` | Redesign semua layar dan state; jangan kehilangan fungsi yang sudah ada |
| Aset ilustrasi, standar ukuran dan catatan batas produksi | `docs/ASSET-STANDARD.md`, `docs/UI-ROLLOUT.md` | Dipertahankan sebagai arsip/reference 2D; buat standar aset 3D tersendiri |

Catatan rollout menyebut 285 objek terpisah pada lima dunia. Itu jumlah instance pada rollout terdokumentasi, **bukan** 285 model unik dan bukan hasil benchmark 3D. Angka unit test pada catatan lama tidak dianggap hasil test baru; riset ini tidak menjalankan atau menyatakan build 3D lulus.

Preflight aset: scan berkas repo yang tidak diabaikan belum menemukan `.glb`, `.gltf`, `.blend` atau `.fbx`. Blender belum terdeteksi melalui PATH/lokasi instalasi umum yang diperiksa; ini tidak membuktikan tidak ada instalasi portabel di lokasi lain. Art PNG yang dikirim pengguna tidak dapat langsung menjadi rig, mesh baju, atau clip animasi 3D. Tahap A harus menetapkan alat authoring/export, model sumber berlisensi, akses artist/custom modeling, dan penyimpanan source sebelum menjanjikan produksi seluruh aset.

## 4. Arah UI/UX dan identitas visual

Nama konsep: **Meetopia — kantor kecil yang terasa dihuni**.

- Dunia chibi 3D stylized, proporsi konsisten, kayu hangat, tekstur bersih, tanaman ekspresif, pencahayaan lembut dan warna yang tidak pucat.
- Mint/emerald sebagai aksen brand dan aksi utama. Setiap dunia mempunyai palet pendukung, silhouette furnitur, material dan pencahayaan sendiri; bukan satu map yang hanya diganti hue.
- Kamera awal ortografik/diorama, yaw sekitar 45° dan elevasi awal 35–45° untuk diuji; posisi itu pilihan kamera, bukan barang digambar ulang untuk tiap sudut. Orbit dibatasi agar ruangan terbaca, dengan tombol reset dan preset area.
- Mode meeting mendekat ke meja dan menampilkan speaker/screen share; tidak memaksa semua orang memakai first-person atau headset.
- Canvas menjadi ruang utama. Header berisi workspace/area dan pencarian; dock bawah berisi mic, camera, screen share, status, gesture dan keluar. Roster/chat/board menjadi panel kontekstual, bukan dua sidebar permanen yang mengambil ruang seperti Discord.
- Form, chat, teks panjang, agenda, tabel file dan pengaturan tetap HTML/CSS yang accessible. Memakai 3D untuk semua input akan menambah kesulitan baca/keyboard tanpa membantu kerja tim.
- Satu pintu utama per aksi: mengubah avatar dari studio avatar; menata ruang dari editor; membuka agenda dari panel kerja. Objek fisik menjadi shortcut kontekstual, bukan form kedua yang berbeda perilaku.
- Bahasa Indonesia/Inggris, empty/error/loading states, focus keyboard, reduced motion, text zoom, safe area mobile, dan ukuran target sentuh merupakan bagian desain awal.
- Logo: pertahankan recognizability dua pintu Meetopia. Eksplorasi lockup/spacing/wordmark yang lebih rapi, favicon, mono, light/dark, signage dan versi emblem 3D. Logo navigasi tetap SVG tajam; tidak wajib diubah menjadi render 3D kecil yang buram.
- Hindari glow di semua panel, glassmorphism berlebihan, kartu identik untuk seluruh konten, dekorasi yang menghalangi klik, teks promosi di area kerja, dan panel besar yang menutup avatar sendiri.

### Daftar lengkap permukaan UI

Semua baris merupakan pekerjaan rencana. State lintas layar pada bagian berikut juga wajib, bukan hanya happy path.

| Area | Layar/panel yang dirancang |
| --- | --- |
| Publik | Landing desktop/mobile; penjelasan office 3D; preview lima dunia; preview karakter; CTA masuk/daftar; fallback hero statis agar auth tidak menunggu WebGL |
| Auth | Login; register; password reveal; validasi; lupa password; reset password; verifikasi email; kirim ulang; logout/session expired; invite sebelum/sesudah login; redirect kembali ke tujuan |
| Onboarding | Nama tampilan; pilih preset avatar; studio lengkap; create workspace; join dengan invite; pilih dunia; cek mic/camera/speaker; izin perangkat; tutorial bergerak dan duduk yang bisa dilewati |
| Beranda workspace | Daftar workspace; search/filter; favorit/terakhir dibuka bila disepakati; online roster; ringkasan agenda; create/join; kosong tanpa workspace |
| App 3D | Header; canvas; area labels; nameplates; target movement; tooltip aksi; dock media; camera controls; minimap; room selector; status koneksi; peringatan izin; leave confirmation |
| Kolaborasi | Nearby chat; channel chat; DM; unread/mention; anggota/search; profile card; shared notes; private notes; agenda; tugas; resource links; upload/download file; form CRUD dan conflict states |
| Meeting | Masuk/keluar zona meeting; lock/PIN/knock; undangan/accept/reject; waiting/denied; roster dan active speaker; raise hand; screen share; fullscreen readable share; audio/video perangkat; per-peer volume |
| Studio avatar | Preview 360°; dasar pria/wanita/netral sebagai preset terpisah; tubuh; kepala; rambut; wajah; atasan/bawahan/sepatu; aksesoris; material; pose test; randomize/reset; simpan/batal; unsaved changes |
| Dunia | Galeri lima dunia; detail; search/filter; ambience; ukuran ruang; style furnishing; loading preview; normal/hover/selected; konfirmasi perubahan map; perlindungan custom layout |
| Editor 3D | Katalog; search/kategori; preview placement; move/rotate; snapping; align meja-kursi; inspector ukuran/yaw; duplicate/delete; undo/redo; collider/seat/nav overlay; validation; draft/save/conflict; role readonly |
| Akun | Profil; avatar; password; appearance; language; accessibility; device/media; notification; volume/sounds; status; ekspor data; danger zone yang sudah didukung |
| Admin workspace | Identitas; dunia dan appearance; editor; audio zones; fitur life bila diaktifkan; channel; member/roles; invite/revoke; transfer owner; leave/kick/delete confirmations |
| QA | Asset lab 3D; turntable; rig/bone/socket/collider overlay; animasi; seat fixtures; preview avatar/furniture semua arah; FPS/memory/asset reports; bukan menu pengguna biasa |

State wajib di setiap permukaan relevan: default, hover, keyboard focus, active/selected, disabled/permission denied, submitting, success, validation error, server error, empty, partial loading, reconnecting, conflict, session expired, asset missing dan fallback. Semua dialog punya fokus awal, focus trap, Escape, return focus, dan label accessible.

## 5. Lima dunia dengan identitas sendiri

| Dunia | Tata ruang dan identitas | Perabot/penggunaan khas |
| --- | --- | --- |
| Kantor | Oak hangat, emerald, off-white, partition kaca, area terbuka + ruang rapat privat | Workstation, reception, printer, whiteboard, meeting table, pantry, lounge |
| Rumah | Maple, linen, sage, lampu hangat, komposisi ruang tinggal yang akrab | Living room, study, dining/kitchen, kamar, teras/taman; workstation home bukan clone office |
| Gaming House | Walnut gelap, charcoal, aksen cyan/ungu terbatas pada perangkat | Gaming desk/chair, console lounge, streaming booth, snack bar, arcade/foosball; model game tidak mengklaim minigame sudah dibuat |
| Studio Kreatif | Plywood, terracotta, olive, aksen warna pada kursi/material | Collaborative worktable, idea board, content set, camera/softbox/greenscreen, storage, review corner |
| Rooftop Tropis | Cedar/teak, batu, daun hijau pekat, sunset amber, skyline jauh | Working spot, discussion table, bar/stool, pergola, parasol, BBQ, viewpoint; railing/collision aman |

Untuk setiap dunia: model arsitektur, nav/collision, spawn dan exit, zona audio, seat slots, interaction manifest, lighting preset, sound ambience opsional, thumbnail, mobile quality preset, tiga ukuran ruang yang sungguh mengubah layout, dan screenshot acceptance. Ukuran small/medium/large tidak boleh hanya memperbesar semua model/karakter.

Style warm/modern/industrial/tropical menggunakan material variants untuk perubahan permukaan dan model variants jika konstruksi furniturnya berbeda. Tidak harus menggandakan setiap appliance empat kali; manifest menyatakan objek mana yang mempunyai model berbeda. Semua pilihan UI harus mencerminkan aset yang benar-benar tersedia.

## 6. Kontrak ukuran, sumbu, sudut, dan kontak — sebelum produksi aset

Angka berikut **target kalibrasi awal untuk karakter stylized**, bukan standar ergonomi manusia atau ukuran final yang telah diuji.

| Parameter | Kontrak awal |
| --- | --- |
| Unit dunia | 1 unit = 1 meter; Y ke atas; bidang lantai X/Z |
| Model forward | +Z pada bind pose; runtime yaw dalam radian; inspector derajat |
| Arah yaw | 0° = +Z; +90° = +X; 180° = −Z; −90° = −X. Bila lantai legacy bertambah ke bawah: down→0°, right→90°, up→180°, left→−90° |
| Root/pivot avatar | Root di tengah telapak pada lantai, pelvis bone terpisah; bukan pusat bounding box kepala |
| Tinggi avatar | Master sekitar 1,40 m; body small/round/tall dikalibrasi sekitar 1,25/1,40/1,55 m |
| Proporsi chibi | Master sekitar 2,6–2,9 kepala; leher pendek yang terlihat sewajarnya, tanpa celah kepala/badan. Angka akhir disetujui dari turntable |
| Meja kerja | Sekitar 1,60–1,80 × 0,70–0,80 × 0,70–0,74 m; clearance lutut dan lengan ditentukan melalui pose nyata |
| Kursi | Seat height awal sekitar 0,42–0,46 m; seat width 0,46–0,52 m. Stool memakai socket/pola duduk lain, bukan kursi kantor yang ditinggikan sembarang |
| Lorong | Awal 1,0–1,2 m bersih; radius controller/clearance diuji dengan dua avatar dan akses ke seat |
| Penempatan | Snap grid awal 0,25 m. Rotasi 90° dulu untuk kompatibilitas map lama; sudut 15°/bebas baru aktif setelah collider/nav/server mendukungnya |
| Skala aset | Apply transform saat ekspor; model target scale 1. Jangan mengecilkan kepala, meja, dan kursi secara independen untuk memperbaiki satu screenshot |
| Sockets | `seat_pelvis`, `seat_forward`, `approach`, `exit`, `foot_L/R`, `hand_L/R`, `gaze`, `screen`, `prop`, `interact` sesuai kebutuhan aset |
| Occlusion | Depth buffer 3D untuk benda/anggota tubuh; wall/roof fade selektif untuk keterbacaan, bukan avatar selalu digambar di atas meja |
| Pencahayaan | Satu arah sun/key konsisten dalam dunia, fill terukur, contact shadow; night/sunset tidak mengubah hue baju diam-diam |

Semua parent-child transform memakai matrix/world transform yang sama untuk visual, seat dan target. Avatar mengikuti orientasi seat/workstation, **bukan menghadap kamera**. Posisi monitor menghadap operator. Hand target keyboard ada di permukaan keyboard, gaze menuju screen, pelvis menyentuh cushion, kaki mempunyai tujuan yang masuk akal. Rotation meja turut merotasi sockets/collider/placement props.

Blender Z-up diekspor lewat exporter lalu diperiksa sebagai Y-up runtime. Jangan menambahkan rotasi koreksi kedua secara global. Nama bone, rest pose, orientation, ukuran, UV/material dan socket schema ditetapkan di master asset contract.

## 7. Avatar 3D: aset dan sistem yang harus dibuat

### Aset anatomi/wardrobe

| Keluarga | Inventory yang dipertahankan/dibuat | Cara produksi |
| --- | --- | --- |
| Dasar | Pria, wanita, netral; body round/tall/small | Satu keluarga skeleton kompatibel; gender sebagai preset, bukan pembatas baju/rambut |
| Kepala | round, oval, soft, wide | Mesh/morph dengan neck seam konsisten, bukan kepala plane |
| Rambut | short, sidepart, undercut, bob, long, wavy, curly, spiky, bun, ponytail, braids, sprout; bald tanpa mesh | Hair volume 360°, attachment head, variasi silhouette dan material |
| Mata | oval, dot, happy, sleepy, wide, closed | Mesh/texture/morph yang tetap melekat pada wajah saat kepala bergerak |
| Alis | soft, straight, arched, angled | Pilihan dasar + ekspresi yang tidak saling menimpa |
| Mulut | smile, open, tiny, straight, frown, laugh, tongue | Morph/shapes, blink dan speech layer terpisah; bukan mulut mengambang |
| Ekspresi | 17 ID wajah yang ada | normal/happy/calm/wink/surprised/sleepy/sad/angry/shy/confused/cool/excited/tired/hungry/thirsty/focus/bored |
| Aksen | none, blush, freckles, heart, star | Decal/material wajah atau bentuk kecil, mengikuti head mesh |
| Atasan | hoodie, tee, jacket, shirt, polo, sweater, blazer, striped | **Skinned clothing mengikuti skeleton yang sama**, volume kerah/bahu/lengan; fitting untuk tiga body shapes |
| Bawahan | trousers, shorts, cargo, skirt | Hip/knee weights dan clearance ketika duduk; skirt butuh pose correction |
| Sepatu | sneakers, boots, canvas | Volume 3D, foot attachment, plant constraint; bukan telapak digeser sendiri |
| Aksesoris | glasses, cap, beanie, headphones, bow, earrings, mask, sunglasses, hijab, backpack | Sockets sesuai anatomi; aturan stacking hijab/rambut/topi/headphone/eyewear dan varian kompatibel |
| Bahan/warna | Skin 6, hair 7, top 8, pants 4 palette saat ini; accessory color | Material parameter/masks; tidak membuat file model baru untuk setiap kombinasi warna |
| Props tersimpan | coffee, phone, book, laptop, none | Mapping ke model prop + attachment/action; pertahankan ID profil |

Keluarga master tidak berarti kombinasi semua gender/body mempunyai geometri yang sama persis. Fitting/morph dan skin weights harus menjaga bentuknya. Bagian tubuh di bawah pakaian di-mask secara terkontrol untuk menghindari clipping, tanpa membuat leher kosong saat badan menekuk.

### Rig/runtime

- [ ] Root, pelvis, spine/chest, neck/head, shoulder/upper arm/forearm/hand, thigh/shin/foot/toe dan eye/jaw bila dibutuhkan.
- [ ] Rest pose dan bone naming tunggal; retarget mapping versi; per-avatar skeleton clone supaya gerak satu pengguna tidak menggerakkan pengguna lain. [SkeletonUtils](https://github.com/mrdoob/three.js/blob/dev/examples/jsm/utils/SkeletonUtils.js) adalah referensi helper cloning/retargeting, bukan jaminan rig berbeda otomatis cocok.
- [ ] Skinning clothing pada skeleton master; correction untuk siku/bahu/pinggul/leher dan skirt saat duduk. Tidak menyusun badan dari potongan PNG yang dirotasi.
- [ ] Facial controller dengan ownership: blink, expression, gaze dan mouth tidak menulis morph yang sama tanpa blending rule.
- [ ] Movement blend idle↔walk↔run; heading smooth, footstep timing dan foot plant.
- [ ] Seat solver dengan hip alignment, foot targets, hand IK untuk keyboard/prop dan gaze. IK dirancang, bukan dianggap otomatis tersedia dari GLTFLoader/ecctrl.
- [ ] State/action graph dengan transition, loop/one-shot, cancel, priority, cooldown dan fallback jika clip belum tersedia.
- [ ] Locomotion in-place dikendalikan posisi authoritative; jangan memakai root motion kedua yang membuat karakter meninggalkan seat/server position.
- [ ] Saat duduk, motor locomotion dilepas/dinonaktifkan sesuai state; tidak ada physics dan seat solver yang saling menarik avatar.
- [ ] Avatar preview, roster, profile, asset lab dan world memakai loader/material/config mapping yang sama; thumbnail dihasilkan dari model tersebut.
- [ ] LOD/animation update rate untuk rekan jauh, disposal saat keluar dunia, cache geometry/texture, material per-avatar jika warnanya berbeda.

## 8. Seluruh 44 aksi dan transisi tambahan

Dalam 3D, delapan arah adalah **rotasi karakter**, bukan delapan sprite sheet. Satu clip bisa dipakai pada banyak outfit yang satu skeleton; perubahan tubuh tetap membutuhkan fitting/retarget/contact check.

| Grup | Seluruh ID aksi | Kebutuhan |
| --- | --- | --- |
| Movement — 9 | idle, walk, run, jump, sit, sit-floor, sit-sofa, stretch, wait | Foot contact, loop locomotion, landing, pelvis/chair/floor contact |
| Work — 11 | type, read, write, present, raise-hand, phone, coffee, video-call, brainstorm, think, focus | Keyboard/book/pen/phone/cup targets; pose standing vs seated; screen/board gaze |
| Social — 11 | wave, clap, thumbs-up, facepalm, chat, handshake, high-five, fist-bump, talk, laugh, dance | Gesture layers; paired consent dan timing server; dua-character spacing/hand contact |
| Condition — 13 | hungry, very-hungry, thirsty, very-thirsty, tired, very-tired, sleepy, sleep, sick, dizzy, nauseous, bored, confused | Kombinasi wajah + body pose + FX; pilihan kosmetik tidak otomatis membocorkan private needs |

Clip teknis tambahan: turn-left/right, walk start/stop, jump-start/air/land, approach-seat, turn-to-seat, sit-down, seated-idle, stand-up, seated-turn/look, desk-type-start/loop/end, sofa-sit transition, pick-up/put-down, knock, dan reach-interact. Dapat berupa clip atau procedural layer yang teruji; jumlah file akhir bukan sekadar 44 karena transisi dan paired roles memiliki kebutuhan sendiri.

Prioritas prototipe: idle, walk, run, sit-down, seated-idle, stand-up, type, wave, raise-hand, talk + blink. Ini **bukan menghapus aksi lain**: parity 44 aksi tetap syarat rollout final. Aksi yang belum memiliki implementasi tidak boleh diberi label selesai atau diganti pose identik tanpa penjelasan.

[AnimationMixer](https://threejs.org/docs/pages/AnimationMixer.html) menjadi referensi playback clip per karakter. Clip umum dari library perlu retargeting, re-export dan uji pada proporsi chibi; mengetik, duduk workstation dan paired gestures kemungkinan memerlukan authoring khusus.

## 9. Seluruh furnitur dan aset lingkungan

### 36 jenis katalog saat ini — setiap jenis masuk manifest 3D

| Kelompok | ID | Model/varian yang diperlukan | Interaksi atau state visual |
| --- | --- | --- | --- |
| Work | desk | Desk utuh, clearance kaki; office/home/gaming/studio variants relevan | Workstation sockets; barang atas meja terpisah |
| Work | chair | Office chair; meeting chair; stool sebagai variant/ID baru bila disepakati | Seat/occupied/approach/exit; rotasi sesuai operator |
| Work | table | Meeting, coffee, dining, collaborative dan outdoor variants | Multi-seat targets dan tabletop props |
| Work | whiteboard | Frame, board, stand/wall mounting | Shared notes/presentation shortcut; real drawing hanya jika memang diimplementasikan |
| Work | noticeboard | Cork/magnetic board dan pin props | Info/agenda shortcut sesuai produk |
| Work | bookshelf | Shelf, buku modular | Read/resource shortcut; dekor terpisah |
| Work | welcome | Reception desk/signage/emblem | Tips/onboarding/workspace info |
| Work | printer | Casing, output tray, paper | Idle/in-use visuals; print workflow tidak otomatis menjadi fitur baru |
| Lounge | sofa | Two/three-seat dan corner variant bila dipilih | Slot duduk individual, backrest occlusion |
| Lounge | beanbag | Bentuk lounge/gaming | Pose duduk rendah khusus, bukan pose kursi kantor |
| Lounge | bed | Bedframe, mattress, pillow, blanket | Slot/pose sesuai fitur lama; sleep jika disepakati |
| Lounge | rug | Thin mesh/decal, office/home/outdoor material | Nonblocking, tidak z-fighting dengan floor |
| Pantry | counter | Kitchen island/counter/bar sections | Brew/cook/serve targets sesuai surface |
| Pantry | fridge | Cabinet/body/door | Idle/open visual; action UI sesuai state produk |
| Pantry | coffee | Coffee machine dan cup socket | Brew action; cup tampil sinkron, tidak kopi otomatis tanpa aksi |
| Pantry | cooler | Water dispenser/bottle | Drink action/held bottle |
| Pantry | vending | Body, glass, items/button panel | Buy UI dan selected/disabled/transaction states |
| Pantry | bbq | Grill/body/lid | Cook/serve; smoke FX opsional terukur |
| Gaming | gamingDesk | Gaming workstation model berbeda dari desk office | Monitor/keyboard/controller, operator-facing correct |
| Gaming | arcade | Cabinet/control panel/screen | Menu/interact; minigame aktual adalah scope terpisah |
| Gaming | foosball | Table, rods, mini players | Interact/menu; tidak menampilkan skor fiktif |
| Studio | camera | Tripod camera/content camera | Placement/gaze target; foto/recording tidak dianggap otomatis tersedia |
| Studio | softbox | Stand, light head, diffuser | Lighting/decor, on/off jika dibangun |
| Studio | greenscreen | Frame dan screen | Content area dekor; compositing bukan fitur otomatis |
| Studio | cabinet | Drawer/storage/supply cabinet | Decorative/open visual atau resource UI yang ditentukan |
| Studio | art | Frame, canvas/easel/small sculpture variants | Decor/detail; texture karya terpisah dari model frame |
| Electronics | tv | Screen, casing, stand/mount | Watch/share screen; HTML fullscreen fallback. Media embed yang tak menyediakan raw video tidak dipaksa menjadi VideoTexture |
| Electronics | speaker | Office speaker/boombox/outdoor variant | Music/play/stop/volume; audio area tetap authoritative |
| Bathroom | sink | Basin, faucet, vanity | Decor; action tambahan harus disepakati |
| Bathroom | bath | Bath/shower set sesuai layout | Decor; jangan menambah simulasi intim yang tidak diminta |
| Outdoor | plant | Small/medium/large plant meshes | Instancing jika cocok; collision pot, bukan daun penuh |
| Outdoor | palm | Indoor/outdoor palm variants | Foliage/LOD, bukan collider setiap helai |
| Outdoor | lamp | Desk/floor/pendant/wall/outdoor variants | Emissive/on-off/lighting preset |
| Outdoor | parasol | Pole/canopy/base | Shade dan camera fade jika menutupi orang; navigasi tiang |
| Outdoor | pergola | Modular posts/beams/vines | Walkable under structure, collision posts, selective roof fade |
| Outdoor | firepit | Bowl/base/flame | Ambient visual/audio; akses aman dan reduced-motion alternative |

`ObjectKind` tetap menjadi mapping kompatibilitas. Banyak varian satu kind berarti jumlah model final lebih besar dari 36; warna/material variants tidak dihitung sebagai model baru. Jangan menjanjikan angka file GLB final sebelum master dan variasi konstruksi dikunci.

### Arsitektur modular

- [ ] Floor modules: oak, walnut, tile, carpet, terrazzo/concrete, gaming floor, cedar deck, grass/garden, threshold.
- [ ] Wall modules: straight, corner, T-junction, endcap, half wall, glass partition, trim/skirting.
- [ ] Window/frame/blind; door/frame/handle dengan open/closed states; threshold dan privacy room entrance.
- [ ] Roof/ceiling yang cutaway/fade; bukan plafon solid yang selalu menutupi semua orang.
- [ ] Railing, terrace edge, steps/ramp bila masuk scope, planter border, pergola attachment.
- [ ] Background skyline/sky/sunset yang ringan; decorative distant buildings tidak menjadi collision geometry.
- [ ] Signage area, reception emblem, room indicator, clock, wall posters; logo tetap milik Meetopia.
- [ ] Collision proxies, walkable area/navmesh, seat approach/exit zones, spawn markers dan audio-zone metadata.

### Props workstation/held items — model terpisah

- [ ] Monitor + stand; keyboard; mouse; mousepad; laptop dengan hinge/open/closed; tablet; phone.
- [ ] Book open/closed; notebook; clipboard; pen; marker; sticky note; papers/document pile; mini-whiteboard.
- [ ] Mug; bottle; headphones; microphone; handheld camera; controller; small desk plant.
- [ ] Consumables sesuai ID lama: water, icedTea, coffee, energyDrink, chips, sandwich, chickenRice. Burger/bento pada referensi memerlukan keputusan item baru, bukan diam-diam mengganti ID.
- [ ] Placed/held/in-use attachment; hand side; per-prop grip pose; object-pick/put-down bila dibangun; tidak ada prop floating ketika tangan kosong.

### FX, audio dan aset UI

- [ ] FX keluarga referensi: sleep, sweat, dizzy, thirst, food, hunger, heart, question, exclamation, idea, bell, cough, sneeze, battery, cloud, anger, music, chat, focus, clock.
- [ ] Speaking indicator; muted indicator; movement target; interaction highlight; selected furniture; seat occupied; private/locked room; loading/reconnect indicator.
- [ ] Audio: footstep per surface, chair contact, interaction confirm, door/knock, notification, meeting chime, coffee/ambient music. Volume defaults/reduced sounds dan larangan autoplay sebelum gesture.
- [ ] Brand: SVG mark/wordmark, mono/light/dark/favicon, UI icon set, loading/empty/error artworks, office signage 3D, five map thumbnails, furniture catalog thumbnails, avatar portraits dan wardrobe previews.
- [ ] Thumbnail memakai render model aktual dengan camera/light preset; jangan membuat thumbnail generatif yang berbeda dari aset pengguna di world.

## 10. Interaksi fisik dan networking

| Skenario | Urutan yang harus benar |
| --- | --- |
| Duduk workstation | Klik/E → pilih seat kosong → server reserve/claim → jalan ke approach → turn ke seat → sit-down → pelvis socket → gaze screen → hand keyboard bila type |
| Duduk di belakang meja | Seat yaw mengikuti workstation; badan/kepala tampil belakang bila kamera di depan meja. Monitor rear, sandaran dan anggota tubuh tersortir oleh kedalaman 3D |
| Berdiri | Stop kerja/prop → stand-up → exit bebas → release seat. Jika jalur exit terhalang editor, validasi/recovery harus ada |
| Dua pengguna satu seat | Hanya satu claim diterima; klien kalah mendapat pesan, memilih slot lain; reconnect/timeout tidak membuat dua avatar bertumpuk |
| Sofa/beanbag/bar | Pose dan socket spesifik; jumlah slot ditentukan manifest, bukan menebak panjang bounding box model |
| Meja berpindah/berputar | Sockets/collider/nav dan attached props berubah bersama; editor menolak perubahan berbahaya saat ditempati atau memindahkan occupants lewat prosedur terkontrol |
| Props kerja | Attach ke hand/socket sesuai action; transisi pickup/drop; keyboard typing tidak sekaligus memunculkan laptop kedua dari pose |
| Paired gesture | Invite → consent → reserved interaction positions → approach/align → shared start time → contact animation → cleanup/cancel. Tidak menarik rekan ke pose tanpa persetujuan |
| Ruang privat | Zona/lock/PIN/knock tetap dijaga server. Mematikan volume di browser saja bukan perlindungan privacy |
| Video/screen share | Satu track/audio route per peer; tidak ada echo dari audio HTML dan spatial node sekaligus; stop sharing/disconnect membersihkan texture/tracks |
| Camera occlusion | Fade hanya wall/ceiling/decor yang menghalangi; furniture tetap memiliki occlusion realistis. Nama/indikator tidak menutupi kepala sendiri saat zoom dekat |

Audio posisi mengikuti avatar pendengar, bukan lokasi kamera orbit. Saat mode meeting, aturan full-volume private room tetap berlaku. Ganti orientasi kamera tidak boleh mengubah privacy atau radius dengar.

Pada fase awal, mesh media lama dipertahankan untuk eksperimen dengan kapasitas yang diukur. Jika target meeting besar atau uplink/device berat, bandingkan SFU LiveKit/self-host vs layanan lain dari kebutuhan/biaya. SFU tidak otomatis melindungi zona privat: membership/subscription permissions wajib ditegakkan server, termasuk ketika pengguna berpindah zona. Jangan memasang vendor hanya karena visual menjadi 3D.

## 11. Arsitektur frontend dan data yang disarankan

Struktur di bawah adalah **usulan**, belum ada file/runtime baru yang dipasang.

```text
Existing API / database / roles ── Existing RoomClient + authoritative realtime
                                              │
                                    SpatialStateAdapter
                                    /                  \
                          DOM app shell              R3F Canvas
                          auth, chat, boards          World / Avatar / Furniture
                          roster, settings            Camera / Input / Interactions
                                                      Physics / Navigation / Audio
                                              │
                                    Shared asset + interaction manifests
```

Modul usulan:

- `src/features/world3d/`: WorldCanvas, WorldScene, RoomArchitecture, Furniture, WorldLighting, CameraRig, InputController, Navigation, InteractionController, SpatialAudio, MediaSurface, Labels.
- `src/features/avatar3d/`: AvatarModel, AvatarMaterials, AvatarRig, AvatarAnimator, AvatarExpression, AvatarIK, AvatarSockets, AvatarStudio dan ThumbnailRenderer.
- `src/shared/spatial/`: unit/axis conversion, model catalog schema, seat/interaction schema, footprint/nav schema dan legacy adapters yang bisa diuji server/client.
- `public/models/`: versioned avatar/furniture/architecture GLB; texture/animation manifests; tidak ditumpuk seluruh dunia menjadi satu GLB raksasa.
- `asset-sources/` atau lokasi sumber khusus yang disepakati: `.blend`, textures, rights/licenses, export presets. Kebijakan source besar/Git LFS/storage diputuskan sebelum produksi; jangan mengulang pola source penting hanya hidup di folder ignored satu mesin.

Kebijakan teknis:

1. Mount Canvas di client-only boundary; halaman auth dan isi panel tidak bergantung GPU. Loading/error boundary dan fallback accessible.
2. Pin Three/R3F/Drei/Rapier versi kompatibel di lockfile; cek satu salinan Three, contoh rilis stabil dan browser target. Angka dependency repo demo bukan otomatis versi Meetopia.
3. Per-frame movement/animation memakai scene refs/mixer, bukan setState seluruh AppShell setiap frame.
4. Geometri/texture boleh shared; skeleton, mixer, morph state, recolored material dan audio graph mempunyai ownership yang jelas per instance.
5. Shared static instances untuk tanaman/kursi dekor yang cocok; animated/skinned/custom-colored people tidak dianggap otomatis bisa memakai instancing statis.
6. Server menjadi sumber kebenaran identity, map revision, role, seat, object state, privacy dan action permission. Klien memprediksi/merender dan rekonsiliasi.
7. World geometry/nav/collision berasal dari manifest/revision yang sama. Collider browser untuk feel tidak boleh mengizinkan berjalan ke area yang server anggap solid.
8. Caching immutable asset hash/version; cleanup GPU/resources, resize, context-lost/restored dan cancel load saat pindah workspace.
9. Base color/emissive dan non-color maps diberi color-space yang tepat; exposure/tone mapping konsisten antara studio/thumbnail/world. Jangan menambahkan gamma correction dua kali.
10. Post-processing/shadows secukupnya; detail/emissive monitor bukan alasan semua lampu menghasilkan dynamic shadow.

[GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html) mendokumentasikan jalur glTF dan decoder opsional. [Panduan performa R3F](https://r3f.docs.pmnd.rs/advanced/scaling-performance) membahas reuse, caching, instancing, LOD, loading bertahap dan adaptive quality. Pilihan implementasi di atas adalah proposal Meetopia, bukan klaim semua optimalisasi tersedia otomatis.

### Manifest wajib setiap aset

ID/version/hash; source model dan lisensi; GLB/texture URLs; unit/axis; bounding dimensions; pivot; material variants; skeleton/rest-pose version jika skinned; collider sederhana; footprint/nav blocking; seat slots dan yaw; approach/exit sockets; hand/gaze/prop/interact sockets; action IDs; LOD; clip names/duration/loop/root-motion policy; allowed attachment combinations; thumbnail preset; byte/triangle/material/draw-call report; QA status.

Static furniture tidak membutuhkan file front/back/left/right. Satu model diputar secara geometris dan dilihat oleh kamera. Perbedaan operator/monitor depan-belakang adalah hasil penempatan/orientasi nyata.

## 12. Migrasi data dan kompatibilitas

- [ ] Dokumentasikan semantik `version` lama; pisahkan `schemaVersion`, `layoutRevision` dan `assetVersion` agar schema upgrade tidak disamakan dengan optimistic update.
- [ ] Adapter awal: legacy `x/y` lantai diproyeksikan ke `X/Z`, `dir` ke yaw. Satu lantai tetap bisa memakai posisi planar authoritative tanpa mengirim seluruh posisi bone ke server.
- [ ] Kalibrasi konversi awal 1 tile ≈ 0,5 m hanya untuk blockout. Desk lama 4×1 tile menjadi 2×0,5 m, sedangkan desk 3D idealnya lebih dalam: **layout/footprint perlu ditinjau**, bukan konversi skala buta.
- [ ] Draft map 3D menyimpan object ID stable, asset reference, transform, footprint/collider, sockets, zones, spawn dan appearance. Jangan overwrite map legacy/custom tanpa preview dan konfirmasi admin.
- [ ] Bila yaw bebas/multi-elevation dibutuhkan, buat protocol version handshake dan payload v2 tervalidasi; legacy client mempunyai behavior compatibility/rejection yang jelas.
- [ ] Layout yang sudah diedit pengguna tidak ikut template auto-upgrade secara destruktif. Sediakan dry-run report collision/reachability/seat changes dan rollback snapshot.
- [ ] Mapping setiap AvatarConfig ID ke model/material 3D; unknown ID mendapat fallback yang terlihat dan tercatat, bukan mengganti seluruh avatar menjadi default.
- [ ] Perubahan preset gender/body tidak diam-diam menghapus eyewear/headphone/hijab/outfit pilihan pengguna.
- [ ] Migrasikan seatId/slot stability, saved position, last workspace, zone locks, settings, notes, files dan invite flows melalui acceptance tests.
- [ ] Renderer 2D sebagai mode rollback sementara yang eksplisit; kebutuhan GPU rendah dapat memakai room list/meeting view. Jangan menyatakan 3D final jika default pengguna masih 2D tanpa alasan.
- [ ] Gunakan setting rollout/config internal yang sederhana; deployment dan vendor changes perlu keputusan terpisah, bukan bagian riset ini.

## 13. Target performa, pengujian, dan syarat selesai

Target di bawah bersifat **budget awal**, belum dibuktikan dan dapat direvisi dari perangkat/kapasitas yang dipilih.

| Area | Target awal / cara mengukur |
| --- | --- |
| Desktop | 60 FPS target pada laptop integrated GPU yang ditetapkan; laporkan p95 frame time dan simulasi + render + video, bukan FPS scene kosong |
| Mobile | 30 FPS target pada perangkat Android/iOS uji; DPR dan shadows adaptif, thermal test ≥15 menit |
| Peserta | Uji 1/5/10/20 avatar; audio/video diukur tersendiri. 20 merupakan skenario evaluasi, bukan kapasitas yang dijanjikan |
| Asset download | Critical spawn bundle target ≤3 MB terkompresi; world lengkap awal ≤12 MB jika memungkinkan. Per-lobby/per-theme lazy loading; ukuran source tidak disamakan ukuran unduhan |
| First usable | Target spawn bisa dikontrol ≤5 detik pada profil jaringan yang disepakati; UI auth/shell tidak menunggu model. Laporkan first frame dan complete art terpisah |
| Geometry | Avatar LOD0 awal 8–15k triangles; furniture umum 0,5–5k; dekor kecil lebih rendah. Angka produksi direvisi dari frame/memory budgets |
| Draw calls | Awal ≤200 mobile/≤400 desktop pada scene target; bukan batas universal Three.js. Ukur dengan avatar, efek dan media nyata |
| Texture | 512/1K untuk kebanyakan aset; 2K hanya jika terlihat perlu; KTX2/Meshopt/Draco dipilih melalui benchmark transfer/decode/visual |
| Long session | Tidak ada GPU/audio/track leaks setelah 20 perpindahan dunia/avatar dan reconnect; test memory/cleanup ≥30 menit |

Checklist acceptance menyeluruh:

- [ ] Turntable semua body/outfit/head/hair/accessory penting; angle depan/belakang/samping/diagonal dan overhead. Tidak ada seam kepala melayang, leher panjang, lengan tempelan atau baju clipping.
- [ ] Semua locomotion heading, start/stop/turn, jump dan landing; foot plant dan root sync.
- [ ] Duduk/berdiri/type pada empat arah workstation, kamera orbit, tiga body shapes, outfit long-sleeve/skirt, sofa/beanbag/stool. Kepala/bahu/pelvis/tangan/monitor terlihat masuk akal.
- [ ] Test screenshot close-up dan map scale; automated skeleton/continuity checks tidak menggantikan persetujuan visual pengguna.
- [ ] Reachability semua zona, spawn/exit/door, semua seat slots pada lima dunia × tiga ukuran; editor tidak membuat pocket tak terjangkau.
- [ ] Collision, rotated footprint, placement, undo/redo, saved draft, optimistic conflict, occupied-seat edits dan custom map migrations.
- [ ] Dua+ pengguna: simultaneous seat claim, locks/PIN/knock, paired invite accept/reject/cancel, shared object state, reconnect dan expired leases.
- [ ] Audio privacy diuji di server/transport, bukan hanya volume browser; busy, private zone, muted users dan unauthorized subscription.
- [ ] Screen share stop/disconnect, device switch, denied camera/mic, no speaker, browser autoplay, echo/duplicate audio dan fullscreen share readability.
- [ ] Semua CRUD chat/notes/agenda/task/resource/file; permissions tamu/member/admin/owner; member kicked/group deleted/owner transfer.
- [ ] Avatar lama, pilihan warna, map custom dan data tersimpan tetap konsisten sesudah migration/rollback.
- [ ] Keyboard-only, focus dialogs, screen reader alternatives, reduced motion, color contrast, nameplate overlap, long names dan 200% text zoom.
- [ ] Desktop 1440/1100/768 dan mobile 390/360; landscape; touch/keyboard/camera gesture tidak saling mengambil input form.
- [ ] Chrome/Edge/Firefox desktop dan Safari iOS pada versi/perangkat yang disepakati; GPU unsupported/context loss/asset missing/slow network fallback.
- [ ] Performance cold/warm loading + active media, no uncaught errors, device/network report dan source licenses lengkap.

## 14. Urutan pekerjaan dan titik persetujuan agar tidak bolak-balik

| Tahap | Deliverable | Syarat masuk tahap berikutnya |
| --- | --- | --- |
| A — keputusan desain | Style board chibi 3D, logo/UI direction, kamera, unit/axis/sockets, target device/capacity, asset rights | Arah visual dan kontrak dasar disetujui; tidak langsung memproduksi lima map |
| B — master vertical slice | Satu avatar, outfit utama, meja, kursi, monitor, keyboard, lantai/dinding; jalan→duduk→mengetik→berdiri | Pengguna menerima bentuk/proporsi dari depan/belakang/samping dan orbit; kontak benar; benchmark awal layak |
| C — fondasi runtime | Loader/manifests, rig/animation, input/camera, nav/collider, room-state adapter, seat authority, audio adapter, fallback | Test dua pengguna dan izin/seat/reconnect lulus; ownership resources jelas |
| D — UI menyeluruh | Landing/auth/onboarding/avatar studio/home/app shell/meeting/chat/boards/settings/editor | Tidak ada fungsi lama hilang; UI desktop/mobile accessible dan tidak terasa clone Discord |
| E — avatar dan catalog | Semua pilihan profile, seluruh 36 kind + variants/props/FX; 44 aksi + transitions/paired roles | Manifest, fitting, license, thumbnail dan visual QA lengkap per keluarga |
| F — lima dunia | Kantor, Rumah, Gaming House, Studio Kreatif, Rooftop; tiga ukuran/preset masing-masing | Setiap ruang punya desain sendiri, navigation/seat/audio valid dan tidak sekadar wallpaper |
| G — migrasi dan parity | Map/avatar compatibility, custom layout preview, rollback, feature parity | Existing user data dan permissions terjaga; semua flow lama ditest |
| H — release readiness | Browser/mobile/performance/media load/visual sign-off, docs dan staged rollout | Kapasitas yang diumumkan terukur; default 3D bekerja, fallback/rollback tersedia |

Tahap dapat memiliki pekerjaan paralel setelah kontrak master stabil, tetapi keluaran art final tidak diproduksi sebelum tahap B disetujui. UI wireframes dapat disiapkan sejak A; integrasi final bergantung runtime C. Tidak ada estimasi kalender yang dapat dipertanggungjawabkan sebelum akses aset 3D/artist, budget dan kapasitas diputuskan.

### Keputusan yang perlu dikunci pada tahap A

1. Gaya: rekomendasi chibi 3D smooth/stylized sesuai gambar pengguna; bukan voxel dan bukan semi-realistis manusia.
2. Kamera: diorama/ortografik sebagai default; third-person opsional kemudian; VR bukan scope awal.
3. Target perangkat: laptop tanpa dedicated GPU + ponsel; sebutkan perangkat uji nyata.
4. Target jumlah orang dan jumlah stream audio/video bersamaan; putuskan mesh vs SFU berdasarkan data tersebut.
5. Aset: custom Blender/artist vs paket berlisensi yang diadaptasi; biaya dan kepemilikan source `.blend`.
6. Berapa variasi konstruksi per furnitur/style; jangan mengganti model style dengan sekadar color grading.
7. Single floor awal vs multi-floor; rotasi editor 90° dahulu vs arbitrary yaw sejak rilis pertama.
8. Logo refinements vs rebrand penuh; default mempertahankan identitas dua pintu.
9. Life/consumables tetap fitur opsional; minigame, rekaman meeting dan AI agents bukan otomatis masuk scope karena ada di repo referensi.
10. Toolchain authoring: versi Blender/exporter, lokasi runtime, validator GLB, optimasi decoder, source asset storage dan dokumentasi build yang dapat direproduksi. Library Three.js saja tidak menggantikan pipeline pembuatan model.

Keputusan yang belum dijawab memakai rekomendasi konservatif di dokumen ini untuk rancangan, **bukan otorisasi membeli aset, menambah vendor, memindahkan data produksi, atau mengimplementasikan seluruh proposal**.

## 15. Definisi hasil akhir yang benar

Selesai berarti: seluruh UI telah diperbarui; lima ruang merupakan lingkungan 3D berbeda; avatar konsisten dari studio sampai world; pakaian mengikuti rig dan tidak tempelan; semua pilihan profil terpetakan; seluruh 44 aksi dan transisinya memiliki implementasi yang diuji; duduk/bekerja mengikuti arah furnitur; objek bisa diinteraksi lewat sumber data yang sama; data lama dan permissions terjaga; performa/perangkat/media sudah diukur; serta pengguna menyetujui visualnya.

Riset ini menghasilkan rancangan dan backlog. **Belum menghasilkan model GLB, animasi baru, renderer 3D, UI baru, migrasi data, atau deployment.** Langkah implementasi pertama yang direkomendasikan adalah master vertical slice pada tahap B setelah keputusan A, bukan langsung menulis ulang seluruh aplikasi atau menyalin repo kantor AI.
