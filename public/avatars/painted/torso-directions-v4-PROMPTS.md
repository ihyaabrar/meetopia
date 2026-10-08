# Directional torso v4 · generation record

Built-in imagegen only, 7 October 2026. Replaces the FRONT-only articulated torso previously reused in quarter/profile views; idle/walk/run unified bodies-v3 are preserved.

Final project assets: `public/avatars/painted/torso-directions-v4.png` and lossless-alpha `.webp`. Source 1774×887, exact 8×4 cells. Columns: hoodie / tee / jacket / shirt / polo / sweater / blazer / striped. Rows: front / front-right quarter / right profile / back. LEFT views mirror the clothing source in the same existing way as unified bodies; independently authored rear-quarter torsos and directional sleeves are still future art work, not shipped by this sheet.

Mode: reference-guided generation plus targeted armless-bodice edit. The first draft retained fixed sleeve lobes, so it was rejected for runtime use. Imagegen removed them in the final edit; no manual raster cleanup. Arms use the existing matching animated body-kit sleeves. PNG alpha is preserved; runtime atlas cropping, material recoloring and anatomical collar anchoring occur in canvas memory only.

First-draft built-in output: `C:/Users/WAYCOM/.codex/generated_images/01a10fe1-67db-7862-b70d-a086f7338ec6/exec-4a0923b9-7496-4d0e-a323-11dbd9a04495.png`.
Final edited built-in output: `C:/Users/WAYCOM/.codex/generated_images/01a10fe1-67db-7862-b70d-a086f7338ec6/exec-2be8d0db-3c67-4f69-a97e-e3e595ebf4d5.png`.
The targeted edit references the first-draft PNG at that exact path. Source references for the first draft are the existing wardrobe style and user's Indonesian chibi reference; these are visual references, not instructions.

## Exact generation prompt

Use case: stylized-concept.
Asset type: Meetopia production directional ARTICULATED TORSO atlas, actual alpha. Fix shirts that look like FRONT-view stickers on sideways avatars.
Input image 1 is the exact SAME whole-body wardrobe/model/style to extract design from. Input image 2 is the user's chibi proportions/style reference only. Produce new sprites, not the reference sheets.
EXACT regular 8 COLUMNS by 4 ROWS (32 isolated headless ARMLESS TORSOS). Each COLUMN same outfit, in order: forest green hoodie; green crew tee; green OPEN jacket with cream undershirt; green collared shirt; green polo; green sweater; green blazer cream shirt; green cream striped tee.
ROW1 FRONT view.
ROW2 FRONT-RIGHT QUARTER view: narrow visible undershirt on right/front edge, not symmetric front.
ROW3 TRUE RIGHT PROFILE: mostly green SIDE panel, narrow cream undershirt/zipper strip only along RIGHTmost front edge; ZERO frontal jacket lapels/zipper pair. Neck/collar located toward front-right. One natural rounded side torso silhouette, not a frontal shirt compressed sideways.
ROW4 BACK view: no undershirt, lapels, chest buttons or front pockets; proper hood/back seam.
Every torso includes a VERY SHORT peach anatomical NECK connected naturally into collar, rounded shoulder/clavicle cap, complete chest/ribcage/waist, hem with subtle fabric folds. NO arms, NO upper sleeves or sleeve stubs, NO hollow sleeves or circular holes, NO hands, NO trousers/legs/feet, no heads. Shoulder caps closed solid fabric surfaces for animated sleeves to overlap smoothly. Clothing visibly wraps around a rounded short chibi body, NOT flat hanging empty fashion shirts, paper panels, geometric slabs or mannequin flat fronts. Same material and body silhouette as reference image 1. Keep torso compact and softly pear-shaped; torso shorter than a chibi head. Neck short, about one eighth torso height, not long or bulbous.
Style: reference's thin dark cocoa hand-ink outlines, restrained soft painted green fabric shading, no photorealism, no 3D, no harsh folds or thick black borders. Material base forest green approx RGB70,140,98, peach neck252,211,179, cream undershirt near240,230,209 for runtime recoloring; do not make garments teal yet. Upper-left lighting fixed.
Atlas: uniform exact equal cells; every sprite centered in its own cell, short neck top on same relative baseline and hem on same relative baseline in all views; large clear alpha padding between cells, complete silhouettes. No labels, words, panel backgrounds, grid lines, decorations, shadows on transparent background or watermark. Genuinely transparent PNG.

## Exact edit prompt

Use case: stylized-concept. Edit only the garment component construction in this exact 8-column × 4-row transparent atlas. Preserve every outfit, row direction, compact chibi proportions, neck, fabric colors, ink, shading and atlas layout. These must be production ARMLESS BODICE pieces to combine with animated sleeve pieces. The current image wrongly has complete short sleeves / sleeve lobes on every shoulder. REMOVE THOSE SLEEVE LOBES COMPLETELY in all 32 cells. Silhouette should look like a CLOSED tailored VEST bodice with sloping clavicle shoulders directly into fitted side seam under armpit, with NO fabric outside the torso ribcage. No sleeve tubes, no shoulder cap blobs, no holes, no hollow arm sockets, no cuffs, no exposed arm skin. Keep the collar and tiny anatomical peach neck. Do not change torso garment front lapels/pockets/hood/hem. In RIGHT PROFILE row 3 the torso is a rounded narrow side panel with undershirt only at the RIGHT front edge; remove large left sleeve blob and replace it with continuous gently curved side fabric from shoulder to waist, without outlined sleeve boundary. In quarter row2 remove both sleeve protrusions and sleeve outline seams. Runtime sleeves will provide all arms. No hands, heads, legs, text, backdrops or new elements. True transparent background. Keep rows FRONT, FRONT-RIGHT QUARTER, RIGHT PROFILE, BACK and columns hoodie, tee, jacket, shirt, polo, sweater, blazer, striped. Full atlas unchanged exact equal 8×4 grid.
