"use client";

import { AvatarCanvas } from "./AvatarCanvas";
import { useT } from "@/i18n/client";
import {
  BODY_COLORS,
  BODY_SHAPES,
  FACES,
  HAIR_COLORS,
  HAIR_STYLES,
  SKIN_TONES,
  randomAvatar,
  type AvatarConfig,
} from "@/shared/avatar";

/** Pembuat avatar dasar (FR-11, FR-59): tubuh, wajah, rambut, dan warna. */
export function AvatarBuilder({
  value,
  onChange,
}: {
  value: AvatarConfig;
  onChange: (a: AvatarConfig) => void;
}) {
  const t = useT();
  const set = <K extends keyof AvatarConfig>(k: K, v: AvatarConfig[K]) => onChange({ ...value, [k]: v });

  const colors = (label: string, list: readonly string[], key: "skin" | "bodyColor" | "hairColor") => (
    <div className="field" role="group" aria-label={label}>
      <span className="label">{label}</span>
      <div className="swatches">
        {list.map((c) => (
          <button
            key={c}
            type="button"
            className="swatch"
            style={{ background: c }}
            aria-pressed={value[key] === c}
            aria-label={`${label} ${c}`}
            onClick={() => set(key, c)}
          />
        ))}
      </div>
    </div>
  );

  const chips = <K extends "body" | "face" | "hair">(
    label: string,
    list: readonly AvatarConfig[K][],
    key: K,
    prefix: string,
  ) => (
    <div className="field" role="group" aria-label={label}>
      <span className="label">{label}</span>
      <div className="chips">
        {list.map((v) => (
          <button
            key={v}
            type="button"
            className="chip"
            aria-pressed={value[key] === v}
            onClick={() => set(key, v)}
          >
            {t(`${prefix}.${v}`)}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="builder">
      <div className="builder-preview">
        <AvatarCanvas avatar={value} size={170} animate />
        <button type="button" className="btn ghost small" onClick={() => onChange(randomAvatar())}>
          🎲 {t("avatar.random")}
        </button>
      </div>
      <div>
        {chips(t("avatar.body"), BODY_SHAPES, "body", "avatar.bodyShape")}
        {colors(t("avatar.bodyColor"), BODY_COLORS, "bodyColor")}
        {colors(t("avatar.skin"), SKIN_TONES, "skin")}
        {chips(t("avatar.face"), FACES, "face", "avatar.faces")}
        {chips(t("avatar.hair"), HAIR_STYLES, "hair", "avatar.hairStyle")}
        {colors(t("avatar.hairColor"), HAIR_COLORS, "hairColor")}
      </div>
    </div>
  );
}
