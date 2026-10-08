import type { MapData } from "@/shared/map";
import { buildTemplate, isTemplateId } from "@/shared/templates";

/** Archived full-map concept art. Runtime worlds now use environment-assets.ts + world.ts layers.
 * Retained for reference and legacy exports, never used as an interactive room background. */
export const ILLUSTRATED_MAPS = {
  office: "/maps/illustrated/office-v2.webp",
  home: "/maps/illustrated/home-v1.webp",
  gaming: "/maps/illustrated/gaming-v1.webp",
  studio: "/maps/illustrated/studio-v1.webp",
  rooftop: "/maps/illustrated/rooftop-v1.webp",
} as const;

/** Never put official-template art behind a modified/editor map with different obstacles. */
export function illustrationFor(map: MapData): string | null {
  if (!isTemplateId(map.template)) return null;
  const canonical = buildTemplate(map.template);
  if (
    map.templateRev !== canonical.templateRev ||
    map.width !== canonical.width ||
    map.height !== canonical.height ||
    map.tiles.join("\n") !== canonical.tiles.join("\n") ||
    furnitureGeometry(map) !== furnitureGeometry(canonical)
  )
    return null;
  return ILLUSTRATED_MAPS[map.template];
}

function furnitureGeometry(map: MapData): string {
  // JSONB may reorder keys and admins may change audio/actions without moving furniture.
  return map.objects
    .map((o) => [o.kind, o.x, o.y, o.w, o.h, o.facing ?? ""].join(":"))
    .sort()
    .join("|");
}

const images = new Map<string, Promise<HTMLImageElement | null>>();

export function loadIllustration(src: string): Promise<HTMLImageElement | null> {
  let pending = images.get(src);
  if (!pending) {
    pending = new Promise((resolve) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => {
        // Keep the native world usable offline; let a subsequent view retry the asset.
        images.delete(src);
        resolve(null);
      };
      image.src = src;
    });
    images.set(src, pending);
  }
  return pending;
}
