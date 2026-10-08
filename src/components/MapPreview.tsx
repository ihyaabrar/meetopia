"use client";
import { useEffect, useRef } from "react";
import { useT } from "@/i18n/client";
import { renderIllustratedPreview } from "@/client/art/world";
import { buildTemplate, type TemplateId } from "@/shared/templates";
import { TILE, type MapData, type MapAppearance } from "@/shared/map";
import { resizeMap } from "@/shared/map-edit";

/** Uses the same map and furniture renderer as the actual room. */
export function MapPreview({
  id,
  className = "",
  ambience = "normal",
  map: suppliedMap,
  appearance,
}: {
  id: TemplateId;
  className?: string;
  ambience?: string;
  map?: MapData;
  appearance?: MapAppearance;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const t = useT();
  useEffect(() => {
    let cancelled = false;
    const canvas = ref.current;
    let map = suppliedMap ?? buildTemplate(id);
    if (appearance && !suppliedMap) {
      try {
        map = resizeMap(map, appearance.roomSize);
      } catch {
        /* keep the canonical preview on an invalid compact layout */
      }
      map = { ...map, appearance };
    }
    if (canvas) {
      canvas.width = map.width * TILE;
      canvas.height = map.height * TILE;
      canvas.dataset.renderer = "loading";
      canvas.setAttribute("aria-busy", "true");
    }
    void renderIllustratedPreview(map, t).then(({ canvas: image, illustrated }) => {
      if (!canvas || cancelled) return;
      canvas.width = image.width;
      canvas.height = image.height;
      canvas.getContext("2d")!.drawImage(image, 0, 0);
      canvas.dataset.renderer = illustrated ? "illustrated" : "native";
      canvas.setAttribute("aria-busy", "false");
    });
    return () => {
      cancelled = true;
    };
  }, [id, suppliedMap, appearance, t]);
  return (
    <canvas
      ref={ref}
      className={`map-preview ${className}`}
      data-ambience={appearance?.ambience ?? ambience}
      role="img"
      aria-label={t("gallery.preview", { name: t(`tpl.${id}`) })}
    />
  );
}
