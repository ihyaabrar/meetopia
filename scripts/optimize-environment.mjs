// Encoding-only optimization: no raster retouching, resizing or alpha changes.
import sharp from "sharp";
import { stat } from "node:fs/promises";
const names = [
  "furniture-core-v1",
  "furniture-decor-v1",
  "furniture-extra-v1",
  "avatar-props-v1",
  "floor-textures-v1",
  "workstation-up-v2",
  "workstation-down-v2",
  "workstation-left-v2",
  "workstation-right-v2",
];
for (const name of names) {
  const output = `public/environment/${name}.webp`;
  // Sumber PNG disimpan di luar repo (.data/asset-originals), hanya WebP yang dikirim ke browser.
  await sharp(`.data/asset-originals/environment/${name}.png`)
    .webp({ quality: 90, alphaQuality: 100, effort: 6 })
    .toFile(output);
  const { size } = await stat(output);
  console.log(name, size);
}
