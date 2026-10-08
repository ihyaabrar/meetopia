# Workstation v2 · generation record

Built-in imagegen only, 7 October 2026. Four authored cardinal views, four independent components per sheet (empty desk, chair, monitor, keyboard). Sources retain actual alpha and original resolution. Encoding-only runtime WebP q90 / alpha100; no repainting, pixel editing, resizing or image rotation. Runtime extracts the inspected component regions in memory. Assets are versioned siblings; v1 sources remain.

Final sources are copied into `public/environment/`. Camera elevation 45° is an illustration target, NOT a measured/signed-off 3D projection. These are the warm oak master prototype; remaining furniture/model families need their own calibration.

## workstation-up-v2

Final project files: `workstation-up-v2.png`, `workstation-up-v2.webp`.
Original built-in output: `C:/Users/WAYCOM/.codex/generated_images/01a10fe1-67db-7862-b70d-a086f7338ec6/exec-c5757c4e-5518-4183-89f4-73fac5ce3eb8.png`.
Mode: generation followed by targeted edit.

### Exact generation prompt

Use case: stylized-concept.
Asset type: Meetopia reusable transparent workstation component kit, UP-facing seated avatar (operator sits SOUTH/below desk, looks NORTH/up; camera sees the avatar's back).
Input images: Image 1 is style/proportion reference ONLY: Indonesian chibi avatars. Image 2 is material reference ONLY: existing furniture, not its low camera. Do not draw either reference sheet or a character.
Primary request: Create a clean 2 by 2 atlas of FOUR separate isolated objects on genuinely transparent background. Exact quadrants with generous empty gutters: TOP LEFT an EMPTY warm oak desk; TOP RIGHT a forest green upholstered rolling office CHAIR seen from BEHIND; BOTTOM LEFT a standalone computer MONITOR whose screen faces SOUTH/toward the viewer, stand visible; BOTTOM RIGHT a separate KEYBOARD with mouse on its right. No labels.
Camera locked for EVERY object: orthographic projection, elevation exactly 45 degrees above horizontal, azimuth straight along north-south axis, zero roll. Edges parallel, no perspective vanishing points, NO isometric diagonal yaw. This is elevated 2D game furniture, not a front-elevation product catalog.
Desk model: rectangular oak top width four times its physical depth, low rounded corners, slim dark cocoa outlines, four short legs, right-hand drawer pedestal from operator viewpoint (viewer right in this UP view), open knee bay. NO objects on the desk. See top surface clearly at 45 degrees. Whole desk visible.
Chair model: generous chibi-scale seat, rounded square emerald cushion, oak back shell, black five-star wheelbase, compact armrests. Chair points AWAY from camera/up: show wooden rear back shell, top rim and seat glimpse, NOT front tufted cushion.
Monitor: one compact dark charcoal thin-bezel screen with soft teal desktop (no text/logos), readable front screen facing us; stand. Keyboard: charcoal rounded keys, viewed from above at same elevation, mouse on operator right.
Style/medium: warm hand-painted 2D illustration with clear dark brown ink outlines, softly shaded curved forms, tactile wood and fabric, simpler than photorealistic, consistent with chibi references. Rich saturated emerald and golden oak, not washed out.
Lighting: soft light from SCREEN UPPER LEFT for all objects, subtle contact shadows only, no large floor shadows.
Composition: exact equal square quadrants; each object's alpha silhouette fully inside its quadrant with 10% empty margin, no crossing or overlapping gutters. No floor, background, boxes, UI, typography, people, extra objects, watermark. True transparency.

### Exact edit prompt

Use case: precise-object-edit.
Asset type: transparent Meetopia workstation UP components.
Input image 1 is edit target. Modify ONLY the EMPTY DESK in its top-left region; leave chair, monitor and keyboard/mouse unchanged in style, scale, position, colors and shapes. Preserve genuine transparent background.
Make the desk a wider, shallower compact chibi work desk at the locked orthographic camera elevated 45 degrees: reduce tabletop front-to-back depth so its top surface is 1/5 as tall as its width in this projected image; shorten its legs/drawer pedestal so the entire desk's visible bounding box has width-to-height ratio 2.2:1. Keep the desktop width, oak color, front edge, right-hand drawer pedestal and open knee space. No yaw, no diagonal/isometric side face. Its four corners remain symmetric with horizontal long edges. No desk accessories. Do NOT alter the other three components or add anything, labels, background, shadow floor. Transparent pixels stay transparent.

## workstation-down-v2

Final project files: `workstation-down-v2.png`, `workstation-down-v2.webp`.
Original built-in output: `C:/Users/WAYCOM/.codex/generated_images/01a10fe1-67db-7862-b70d-a086f7338ec6/exec-bfa3bed4-cfe9-4f44-b6be-8e26185feace.png`.
Mode: reference-guided generation.

### Exact generation prompt

Use case: stylized-concept.
Asset type: Meetopia transparent workstation component kit DOWN (seated operator NORTH/above desk, looking SOUTH/down).
Input image 1 is the reference for exact objects, oak/emerald/charcoal materials, outline thickness and simplified painterly finish. Generate the SAME four components physically rotated 180 degrees around their vertical axis, NOT flip/mirror artwork. Light remains from screen upper-left.
Four separate isolated components in the same general atlas layout: EMPTY oak desk top-left; green rolling chair top-right; computer monitor bottom-left; keyboard and mouse bottom-right. Generous gutters, no component touching another, genuine transparency.
Locked camera: orthographic, elevated 45 degrees above horizontal, looking straight NORTH, zero yaw/roll, not diagonal/isometric or top-down. Desk: same wide shallow oak desk width four times physical depth, compact legs, image silhouette width to height about 2.5:1, EMPTY surface. In this DOWN rotation show CLOSED rear modesty panel facing viewer, no open knee bay and NO drawer fronts visible (drawer pedestal now on viewer LEFT). Top clearly visible. Chair: show upholstered GREEN FRONT cushion and seat facing viewer/SOUTH with arms and black wheelbase, NOT wooden rear shell. Monitor: show CHARCOAL REAR casing facing viewer, screen faces away/NORTH; no visible screen image; stand present. Keyboard: viewed from above same camera, mouse now on viewer LEFT because that is the operator's right; upper/right-side numeric keys must move to the opposite side consistently. Never mirror lighting.
Rich saturated warm golden oak, forest emerald cushions, dark cocoa outline, hand-painted soft material detail consistent with reference. No person, background, floor, vignette, text, labels, watermark, boxes, extra props. All four complete silhouettes visible; transparent background.

## workstation-right-v2

Final project files: `workstation-right-v2.png`, `workstation-right-v2.webp`.
Original built-in output: `C:/Users/WAYCOM/.codex/generated_images/01a10fe1-67db-7862-b70d-a086f7338ec6/exec-93f925cc-8bed-44ad-9a58-4ed05c72ea9e.png`.
Mode: generation followed by targeted edit.

### Exact generation prompt

Use case: stylized-concept.
Asset type: Meetopia workstation RIGHT, isolated components on genuine transparent background.
Input image 1 is the material/model/style reference, NOT the view to repeat. Generate those SAME components physically rotated 90 degrees to face EAST/right. Light remains screen upper-left. Do NOT mirror an existing image.
Four separate objects with generous transparent gutters, one in each quadrant: top-left EMPTY oak desk, top-right green rolling chair, bottom-left charcoal computer monitor, bottom-right keyboard with mouse. No character, floor, labels, lines, text, extra props.
Direction contract: operator sits WEST/left of desk and looks RIGHT/EAST. Thus chair FRONT/seat opening points RIGHT, its wooden backrest is on LEFT. Monitor DISPLAY points LEFT toward operator, so the viewer sees its thin LEFT side, not a frontal screen nor frontal rear; include stand. Keyboard long edge runs VERTICALLY north-south in this projected view, readable from LEFT by operator; mouse sits SOUTH/below keyboard (operator's right).
Camera: fixed orthographic elevated 45 degrees above horizontal, looking straight north, zero roll, NO diagonal/isometric yaw and NO perspective convergence. Desk long four-unit dimension runs NORTH-SOUTH (vertical on screen), its one-unit short depth runs EAST-WEST (horizontal). Draw a NARROW, LONG VERTICAL tabletop with parallel long edges; show tabletop from above and SOUTH end panel below, NOT a horizontal frontal desk. Operator/knee opening is on LEFT. Drawer pedestal at SOUTH end, operator right. Compact legs same physical height as reference desk. Preserve its warm golden oak, compact rounded corners, cocoa outlines and understated grain.
Chair is exact SAME emerald oak-shell compact five-wheel model, true RIGHT-FACING PROFILE under same elevated camera, seat clearly visible from above; no diagonal 3/4 front or rear view. Monitor side profile tall slim slab facing LEFT; keyboard+mouse laid out vertically, not horizontally.
Hand-painted 2D chibi-friendly, softly shaded but clean ink edges, rich saturated materials; match reference components. Whole silhouettes in own quadrants, no crossings. Preserve alpha.

### Exact edit prompt

Use case: precise-object-edit.
Input image 1 is the edit target, transparent RIGHT-facing Meetopia workstation component kit.
Change ONLY the desk in the TOP LEFT. Preserve the other three objects completely unchanged and keep genuine alpha.
The side-view desk is too wide for the master physical proportions. Reduce ONLY its horizontal physical depth: narrow the desk's entire visible width to about 55 percent of its current width while KEEPING its current height, north-south length, top position and bottom baseline. The long vertical tabletop must be about four times as long as its short horizontal depth, after the 45-degree camera projection it should be about 2.8 times as long as its width. Entire desk alpha bounds should be a tall narrow silhouette about 1 unit wide and 4.4 units high. Make all legs, drawer pedestal and short front edge narrower consistently; don't merely remove parts. Still an EMPTY golden oak desk with operator opening on LEFT and drawer fronts at SOUTH/bottom. Same upper-left light, brown ink and soft painted style. Same zero-yaw orthographic elevated camera, no diagonal edges or vanishing points. No other changes, labels, floor, shadows on background, text or people.

## workstation-left-v2

Final project files: `workstation-left-v2.png`, `workstation-left-v2.webp`.
Original built-in output: `C:/Users/WAYCOM/.codex/generated_images/01a10fe1-67db-7862-b70d-a086f7338ec6/exec-5260a568-387f-40cb-b7e4-44df01759536.png`.
Mode: reference-guided generation.

### Exact generation prompt

Use case: stylized-concept.
Asset type: Meetopia workstation LEFT component atlas, transparent.
Input image 1 is the exact RIGHT kit reference. Generate the SAME physical components after rotating them 180 degrees around their vertical axes; do NOT mirror the picture. Keep light coming from SCREEN UPPER LEFT. Preserve four-component layout, size and matching material style.
Operator sits EAST/right of desk and faces WEST/left. TOP LEFT: EMPTY narrow long oak desk with long axis NORTH-SOUTH/vertical on screen, open knee bay on RIGHT. Drawer pedestal is NORTH/top (operator's right); SOUTH/bottom end now has a plain closed oak panel/leg, not drawer fronts. Match reference narrow desk silhouette dimensions (about 200 wide by 600 high), clear elevated tabletop. TOP RIGHT: exactly same forest-emerald padded rolling chair in true LEFT-FACING PROFILE, green seat opens LEFT, wooden back is RIGHT, seat visible from above, black five-wheel base. BOTTOM LEFT: thin charcoal MONITOR seen from its opposite side, display faces RIGHT toward operator; opposite side of casing visible, stand intact. BOTTOM RIGHT: vertical KEYBOARD with mouse at NORTH/above it (operator's right), correctly rotated keys, not reference's mouse below.
Locked orthographic elevated 45-degree camera straight along north-south axis, zero roll; no three-quarter or isometric diagonal yaw, no vanishing points, no rotated PNG effect. Painted chibi-friendly illustration, rich oak, dark cocoa outlines, emerald fabric with subtle seams, upper-left highlights on all four items. Do not draw characters, floor, labels, text, boxes, diagrams or extra props. Generous transparent gutters and complete silhouettes. Genuine transparent alpha.
