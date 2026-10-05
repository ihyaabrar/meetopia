"use client";

import { useEffect, useState } from "react";
import { useT } from "@/i18n/client";
import { renderStaticMap } from "@/client/art/world";
import { TEMPLATE_IDS, TEMPLATE_PERKS, buildTemplate, type TemplateId } from "@/shared/templates";
import { Icon } from "./Icon";

const thumbs = new Map<string, string>();

/** Pratinjau kecil tata ruang, dirender sekali lalu disimpan sebagai gambar. */
function Thumb({ id, label }: { id: TemplateId; label: (k: string) => string }) {
  const [src, setSrc] = useState<string | null>(() => thumbs.get(id) ?? null);
  useEffect(() => {
    if (thumbs.has(id)) return;
    // Ditunda satu frame agar dialog tampil dulu sebelum peta dirender.
    const h = requestAnimationFrame(() => {
      const full = renderStaticMap(buildTemplate(id), label);
      const c = document.createElement("canvas");
      const scale = 280 / full.width;
      c.width = 280;
      c.height = Math.round(full.height * scale);
      const ctx = c.getContext("2d")!;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(full, 0, 0, c.width, c.height);
      const url = c.toDataURL("image/png");
      thumbs.set(id, url);
      setSrc(url);
    });
    return () => cancelAnimationFrame(h);
  }, [id, label]);
  // Gambar data-URL buatan sendiri: next/image tidak memberi manfaat di sini.
  // eslint-disable-next-line @next/next/no-img-element
  return src ? <img className="tpl-thumb" src={src} alt="" /> : <span className="tpl-thumb" aria-hidden />;
}

/** Pilih jenis ruangan: kantor, rumah, gaming house. Tiap pilihan menampilkan kelebihannya. */
export function TemplatePicker({
  value,
  onChange,
  current,
}: {
  value: TemplateId;
  onChange: (id: TemplateId) => void;
  /** Jenis ruangan yang sedang dipakai (di pengaturan grup). */
  current?: TemplateId;
}) {
  const t = useT();
  return (
    <div className="tpl-list" role="radiogroup" aria-label={t("tpl.choose")}>
      {TEMPLATE_IDS.map((id) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={value === id}
          className="tpl"
          onClick={() => onChange(id)}
        >
          <Thumb id={id} label={t} />
          <span className="tpl-body">
            <span className="tpl-name">
              <b>{t(`tpl.${id}`)}</b>
              {current === id && <span className="badge">{t("tpl.current")}</span>}
            </span>
            <span className="hint">{t(`tpl.${id}.desc`)}</span>
            <ul>
              {TEMPLATE_PERKS[id].map((k) => (
                <li key={k}>
                  <Icon name="check" size={13} /> {t(k)}
                </li>
              ))}
            </ul>
          </span>
        </button>
      ))}
    </div>
  );
}
