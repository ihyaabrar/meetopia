"use client";
import { useEffect, useRef } from "react";
import { useT } from "@/i18n/client";
import { renderIllustratedPreview } from "@/client/art/world";
import { buildTemplate, type TemplateId } from "@/shared/templates";
import { TILE } from "@/shared/map";

/** Uses the same map and furniture renderer as the actual room. */
export function MapPreview({
  id,
  className = "",
  ambience = "normal",
}: {
  id: TemplateId;
  className?: string;
  ambience?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const t = useT();
  useEffect(() => {
    let cancelled = false;
    const canvas = ref.current;
    const map = buildTemplate(id);
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
  }, [id, t]);
  return (
    <canvas
      ref={ref}
      className={`map-preview ${className}`}
      data-ambience={ambience}
      role="img"
      aria-label={t("gallery.preview", { name: t(`tpl.${id}`) })}
    />
  );
}
