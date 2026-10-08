# Meetopia · asset inventory & calibration

7 October 2026. Status is per asset family, not a claim that all reference art has been implemented. Existing avatar IDs, profile choices and edited layouts remain stable.

## Master contract

- Logical grid: **32 world pixels per tile**. Camera zoom scales the entire scene, not individual furniture.
- Avatar map scale: **1.5**, shared `avatar-metrics.ts`. Seated root is the foot anchor; pelvis is root−7 rig units. World seat contact is `seatPose.y × 32 − 2.5` (foot offset8 minus pelvis10.5).
- Elevation target: orthographic **45° above the ground**, fixed scene yaw, upper-left light. Generated illustrations are NOT certified exact 3D projections. A measured 3D/blockout pipeline would be needed to certify physical angles.
- `facing` means the operator's gaze, not the visible front of a monitor. Rotating an object changes heading + ground footprint; never rotate its rendered PNG. New master left/right furniture views are separately authored, not mirrored.
- Example footprints: desk4×1 → side1×4; chair1×1; sofa4×1; table5×2; bed3×3; bookshelf2×1. Existing object dimensions remain authoritative; these are catalog/master targets, not a silent migration of saved maps.
- Art pivot, visible alpha bounds and collision footprint are separate values. Furniture images preserve source aspect ratio. Clothing is fitted to the selected chibi body, with anatomical neck/shoulder/hip attachments.

| Operator | Chair relative to desk | Monitor surface | Avatar view | Master ground size |
| --- | --- | --- | --- | --- |
| up | south | screen toward south | back | 4×1 |
| right | west | screen toward west | right profile | 1×4 |
| down | north | screen toward north | front | 4×1 |
| left | east | screen toward east | left profile | 1×4 |

Chair/desk attachment requires touching cardinal edges and positive overlap, never a diagonal corner. An explicit chair facing away is not attached. Shared helpers are used by rendering, editor and server seating.

Render order: floor/walls/rugs → object shadows → depth-sorted furniture/avatar → contextual upper-body pass above desktop → clipped chair-back foreground → lighting/labels/FX. Monitor casing must occlude hands when seen from behind; keyboard typing suppresses the rig's separate laptop. Sideways sitting bends thighs toward the desk rather than dropping both legs vertically.

## Delivered prototype / current assets

| Family | Current assets | Status |
| --- | --- | --- |
| Avatar | heads-v1, headwear-v1, rear-heads-v1, clothing-v1, sleeves-v1, body-kit-v2, bodies-v3, **torso-directions-v4** | Painted sources + articulated rig. v4 fixes front-only torso reuse; eight outfits × four authored torso views. Rear diagonals use rear torso + existing rear-quarter heads. Not a full eight-view animation pack. |
| Master workstation | workstation-up/down/right/left-v2 | Four sheets, independent empty desk/chair/monitor/keyboard; runtime contact + depth metadata. Warm oak prototype. Public isolated `/asset-lab` uses the application Scene renderer. |
| General environment | furniture-core-v1, decor-v1, extra-v1 | 36 independent catalog kinds. Existing atlas illustrations need direction/scale/model refinement after the master. |
| Props / floor | avatar-props-v1, floor-textures-v1 | Separate hand items and reusable floor materials; more directional/in-use art remains. |
| Five worlds | office, home, gaming, studio, rooftop | Runtime floor/wall layouts + independent objects. Old full-map illustrations are retained references, not interaction wallpaper. |
| Brand / UI | two-door SVG mark dark/light/mono, wordmark, board mark, Outfit typography, SVG icons | Existing geometry preserved; same avatar/map renderer supplies UI previews. |

Source alpha PNGs are retained; environment WebP uses q90/alpha100, avatar WebP is lossless because collar/face/material detection depends on exact pixels. New v4 torso WebP is770,240 bytes; four workstation WebPs total486,876 bytes. Do not confuse a loading/performance measurement with approval of a download-speed target.

## Complete production inventory / still to refine or create

### Avatar anatomy and wardrobe

- Three base gender choices (male/female/neutral), three body silhouettes, four head shapes.
- Twelve visible hairstyles + bald, six eyes, four brows, seven mouths, four facial accents + none.
- Eight tops: hoodie, tee, jacket, shirt, polo, sweater, blazer, striped. Four bottoms: trousers, shorts, cargo, skirt. Three shoes: sneakers, boots, canvas.
- Ten accessories: glasses, cap, beanie, headphones, bow, earrings, mask, sunglasses, hijab, backpack. Independent eyewear/headphone options retain existing behavior.
- Materials: skin/hair/clothing/pants/accessory color masks; no duplicate sprites per color.
- Next art: independently drawn rear-quarter torso/sleeve/leg variants, locomotion and seating frames matching every clothing family, sit↔stand contact transitions. v4's armless bodice prevents static sleeve caps stacking on moving arms.

### 44 actions

Movement9: idle/walk/run/jump/sit/sit-floor/sit-sofa/stretch/wait.

Work11: type/read/write/present/raise-hand/phone/coffee/video-call/brainstorm/think/focus.

Social11: wave/clap/thumbs-up/facepalm/chat/handshake/high-five/fist-bump/talk/laugh/dance.

Conditions13: hungry/very-hungry/thirsty/very-thirsty/tired/very-tired/sleepy/sleep/sick/dizzy/nauseous/bored/confused.

Current 6/8-frame looping rig actions are functional. **44 fully authored × eight-direction frame packs are not delivered.** Contact-aware typing is applied to the master plain desk. Expand to other surfaces and video-call/read gestures only after separate hand/prop/occlusion checks.

### 36 furniture catalog kinds

| Group | IDs |
| --- | --- |
| Work8 | desk, chair, table, whiteboard, noticeboard, bookshelf, welcome, printer |
| Lounge4 | sofa, beanbag, bed, rug |
| Pantry6 | counter, fridge, coffee, cooler, vending, bbq |
| Gaming3 | gamingDesk, arcade, foosball |
| Studio5 | camera, softbox, greenscreen, cabinet, art |
| Electronics2 | tv, speaker |
| Bathroom2 | sink, bath |
| Outdoor6 | plant, palm, lamp, parasol, pergola, firepit |

Required where relevant: front/back/left/right art, empty/occupied/in-use variants, collision footprint, seat slots, contact anchors, foreground masks, shadows and hover/selected/disabled UI states. Separate warm/modern/industrial/tropical model kits are planned; current global material palettes are color grading, not four rebuilt model families. Minigames are separate product work, not asset delivery.

### Props, architecture, effects, previews

- Desk components: monitor front/rear/side, keyboard, mouse, open/closed/rear laptop, cup, notebook and small plant; all independently placed, never permanently painted into the desktop.
- Held items: phone, tablet, book open/closed, notebook, clipboard, pen/marker, sticky note, mug, bottle, controller, headphones, camera, papers, mini whiteboard. Use placed/held/in-use states and directional hand anchors as needed.
- Consumables follow existing IDs water/icedTea/coffee/energyDrink/chips/sandwich/chickenRice. Burger/bento require explicit compatible item assets, not substituted IDs.
- Environment: oak/walnut/tile/carpet/terrazzo/gaming/cedar/grass textures; wall straight/corner/T/end, windows, door open/closed/threshold, railing/stairs. Separate skyline/plants/lights where applicable; interactive objects remain independent.
- Painted status FX: sleep/sweat/dizzy/thirst/food/hunger/heart/question/exclamation/idea/bell/cough/sneeze/battery/cloud/anger/music/chat/focus/clock. Existing OS emoji in some status bubbles still need replacement.
- UI/brand: same SVG identity, navigation/media/editor icon set, five live-map thumbnails, catalog sprite crops and profile head crops, matching onboarding hero and loading/empty/error artwork. Controls stay semantic HTML/CSS, not raster screenshots.

## Delivery metadata and acceptance

Every new asset records id/version/direction, source bounds, pivot, footprint, neck/seat/hand anchors, material masks, foreground mask, and frame size/count/fps/loop if animated. Keep exact built-in imagegen prompts and source paths in the family generation records.

Acceptance: inspect map zoom1 and zoom2, all relevant body/outfit/direction combinations, collar and sleeve continuity, seated pelvis/knee contact, keyboard wrist/eye line, correct front/back monitor, stable baseline, no source-cell debris/cropping, reachable interactions, thumbnail consistency and mobile layout. Automated silhouette continuity is necessary but **does not certify material seams or exact camera angles**. Do not mass-produce other families before this prototype's visual proportions are accepted.

QA scripts: `check-avatar-torso.mjs` (2,304 articulated renders), `check-workstation-master.mjs` (48 static cases + four animated typing snapshots), `check-asset-lab-ui.mjs` (desktop/mobile controls), existing avatar-stage/layered-world checks. These run isolated headless contexts; they do not inspect or modify the user's signed-in browser session.

Generation records: `public/environment/workstation-v2-PROMPTS.md`, `public/avatars/painted/torso-directions-v4-PROMPTS.md`, original environment `PROMPTS.md`. Further production order: calibrated master → directional wardrobe/locomotion/contact frames → remaining furniture families → props/consumables/FX → UI thumbnails/brand cleanup → visual/multiplayer/performance acceptance.
