"use client";
import { useId, useState } from "react";
import { AvatarCanvas } from "./AvatarCanvas";
import { Icon } from "./Icon";
import { useT, useI18n } from "@/i18n/client";
import { actionLabel } from "@/shared/avatar-animation";
import {
  AVATAR_GENDERS,
  AVATAR_DIRECTIONS,
  AVATAR_CONDITIONS,
  PREVIEW_ACTIONS,
  BODY_COLORS,
  BODY_SHAPES,
  HAIR_COLORS,
  HAIR_BY_GENDER,
  SKIN_TONES,
  HEAD_SHAPES,
  EYE_STYLES,
  MOUTH_STYLES,
  BROW_STYLES,
  FACE_ACCENTS,
  FACES,
  OUTFITS,
  BOTTOMS,
  PANTS_COLORS,
  SHOE_STYLES,
  ACCESSORIES,
  PROPS,
  DEFAULT_AVATAR,
  randomAvatar,
  type AvatarConfig,
  type AvatarGender,
  type AvatarDirection,
  type AvatarActivity,
  type AvatarCondition,
} from "@/shared/avatar";

const PRESETS: Record<AvatarGender, Partial<AvatarConfig>> = {
  male: { body: "tall", hair: "sidepart", outfit: "jacket" },
  female: { body: "round", hair: "bun", outfit: "hoodie" },
  neutral: { body: "small", hair: "bob", outfit: "tee" },
};
const TABS = ["base", "head", "hair", "eyes", "brows", "mouth", "clothing", "accessory"] as const;
type Tab = (typeof TABS)[number];
type ChoiceKey =
  | "head"
  | "eyes"
  | "mouth"
  | "body"
  | "shoes"
  | "outfit"
  | "hair"
  | "accessory"
  | "brows"
  | "faceAccent"
  | "face"
  | "bottom"
  | "prop"
  | "eyewear";

/** Thumbnail choices share the world renderer. Simulations never change private needs. */
export function AvatarBuilder({
  value,
  onChange,
}: {
  value: AvatarConfig;
  onChange: (a: AvatarConfig) => void;
}) {
  const t = useT();
  const { locale } = useI18n();
  const id = useId();
  const [tab, setTab] = useState<Tab>("base");
  const [clothing, setClothing] = useState<"outfit" | "bottom" | "shoes">("outfit");
  const [hairFilter, setHairFilter] = useState<AvatarGender>(value.gender);
  const [direction, setDirection] = useState<AvatarDirection>("down");
  const [activity, setActivity] = useState<AvatarActivity>("idle");
  const [condition, setCondition] = useState<AvatarCondition>("normal");
  const [previewExpanded, setPreviewExpanded] = useState(false);
  const set = <K extends keyof AvatarConfig>(key: K, v: AvatarConfig[K]) =>
    onChange({
      ...value,
      ...(["eyes", "mouth", "brows"].includes(key) ? { face: "normal" as const } : {}),
      [key]: v,
    });
  const panel = (key: string, children: React.ReactNode) => (
    <section className="avatar-panel avatar-panel-wide">
      <h3>{t(`avatar.${key}`)}</h3>
      {children}
    </section>
  );
  function options<K extends ChoiceKey>(
    key: K,
    list: readonly AvatarConfig[K][],
    prefix: string,
    face = false,
  ) {
    return (
      <div className="avatar-options" role="group" aria-label={t(`avatar.${key}`)}>
        {list.map((v) => (
          <button
            type="button"
            className="avatar-option"
            key={v}
            aria-pressed={value[key] === v}
            title={t(`${prefix}.${v}`)}
            aria-label={t(`${prefix}.${v}`)}
            onClick={() => set(key, v)}
          >
            <AvatarCanvas
              avatar={{
                ...value,
                [key]: v,
                ...(["head", "eyes", "brows", "mouth", "faceAccent"].includes(key)
                  ? { face: "normal" as const }
                  : {}),
                ...(key === "hair" ? { accessory: "none", eyewear: "none", headphones: false } : {}),
                ...(key === "accessory" ? { eyewear: "none", headphones: false } : {}),
                ...(face && !["hair", "accessory", "eyewear"].includes(key)
                  ? { hair: "none", accessory: "none", eyewear: "none", headphones: false }
                  : {}),
              }}
              size={64}
              part={
                key === "outfit" || key === "body"
                  ? "body"
                  : key === "shoes" || key === "bottom"
                    ? "legs"
                    : undefined
              }
              face={face}
            />
            <small>{t(`${prefix}.${v}`)}</small>
          </button>
        ))}
      </div>
    );
  }
  function colors(
    key: "skin" | "hairColor" | "bodyColor" | "pantsColor" | "accessoryColor",
    list: readonly string[],
  ) {
    return (
      <div className="swatches" role="group" aria-label={t(`avatar.${key}`)}>
        {list.map((color, i) => (
          <button
            type="button"
            key={color}
            className="swatch"
            style={{ background: color }}
            aria-label={`${t(`avatar.${key}`)} ${i + 1}`}
            aria-pressed={value[key] === color}
            onClick={() => set(key, color)}
          />
        ))}
      </div>
    );
  }
  function chooseGender(gender: AvatarGender) {
    setHairFilter(gender);
    onChange({ ...value, gender, ...PRESETS[gender] });
  }
  return (
    <div className={`builder avatar-studio avatar-tabbed ${previewExpanded ? "preview-expanded" : ""}`}>
      <div className="builder-preview">
        <span className="builder-kicker">
          <i />
          {t("avatar.preview")}
        </span>
        <div className="avatar-pedestal">
          <AvatarCanvas
            avatar={value}
            size={300}
            animate
            direction={direction}
            activity={activity}
            condition={condition}
          />
        </div>
        <button
          type="button"
          className="btn secondary small avatar-preview-expand"
          aria-expanded={previewExpanded}
          aria-controls={`${id}-preview-controls`}
          onClick={() => setPreviewExpanded((v) => !v)}
        >
          {t(previewExpanded ? "avatar.hideControls" : "avatar.showControls")}
        </button>
        <div className="avatar-preview-extra" id={`${id}-preview-controls`}>
          <div className="avatar-view-controls" role="group" aria-label={t("avatar.viewLabel")}>
            {AVATAR_DIRECTIONS.map((view) => (
              <button
                key={view}
                type="button"
                aria-pressed={direction === view}
                onClick={() => setDirection(view)}
              >
                {t(`avatar.view.${view}`)}
              </button>
            ))}
          </div>
          <div className="avatar-simulation">
            <label>
              {t("avatar.activity")}
              <select
                aria-label={t("avatar.activity")}
                value={activity}
                onChange={(e) => setActivity(e.target.value as AvatarActivity)}
              >
                {PREVIEW_ACTIONS.map((a) => (
                  <option key={a} value={a}>
                    {actionLabel(a, locale)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t("avatar.condition")}
              <select
                aria-label={t("avatar.condition")}
                value={condition}
                onChange={(e) => setCondition(e.target.value as AvatarCondition)}
              >
                {AVATAR_CONDITIONS.map((c) => (
                  <option key={c} value={c}>
                    {t(`avatar.condition.${c}`)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <small className="hint">{t("avatar.simulationNote")}</small>
        </div>
        <div className="avatar-preview-actions">
          <button
            type="button"
            className="btn secondary small"
            onClick={() => onChange(randomAvatar(value.gender))}
          >
            <Icon name="shuffle" size={16} />
            {t("avatar.random")}
          </button>
          <button
            type="button"
            className="btn secondary small"
            onClick={() => onChange({ ...DEFAULT_AVATAR, gender: value.gender, ...PRESETS[value.gender] })}
          >
            <Icon name="refresh" size={16} />
            {t("avatar.reset")}
          </button>
        </div>
        <span className="hint avatar-preview-note">{t("avatar.freeChoice")}</span>
      </div>
      <div className="avatar-editor">
        <div className="avatar-tabs" role="tablist" aria-label={t("avatar.parts")}>
          {TABS.map((item, index) => (
            <button
              key={item}
              type="button"
              id={`${id}-${item}`}
              role="tab"
              aria-selected={tab === item}
              aria-controls={`${id}-panel`}
              tabIndex={tab === item ? 0 : -1}
              onClick={() => setTab(item)}
              onKeyDown={(e) => {
                const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
                if (!step && e.key !== "Home" && e.key !== "End") return;
                e.preventDefault();
                const next =
                  e.key === "Home"
                    ? 0
                    : e.key === "End"
                      ? TABS.length - 1
                      : (index + step + TABS.length) % TABS.length;
                setTab(TABS[next]);
                e.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>("button")[next]?.focus();
              }}
            >
              {t(`avatar.tab.${item}`)}
            </button>
          ))}
        </div>
        <div
          id={`${id}-panel`}
          role="tabpanel"
          aria-labelledby={`${id}-${tab}`}
          className="avatar-panels"
          tabIndex={0}
        >
          {tab === "base" && (
            <>
              {panel(
                "gender",
                <div className="gender-cards" role="radiogroup" aria-label={t("avatar.gender")}>
                  {AVATAR_GENDERS.map((gender, index) => (
                    <button
                      key={gender}
                      type="button"
                      className="gender-card"
                      role="radio"
                      aria-checked={value.gender === gender}
                      tabIndex={value.gender === gender ? 0 : -1}
                      onClick={() => chooseGender(gender)}
                      onKeyDown={(e) => {
                        const step = ["ArrowRight", "ArrowDown"].includes(e.key)
                          ? 1
                          : ["ArrowLeft", "ArrowUp"].includes(e.key)
                            ? -1
                            : 0;
                        if (!step && e.key !== "Home" && e.key !== "End") return;
                        e.preventDefault();
                        const next = e.key === "Home" ? 0 : e.key === "End" ? 2 : (index + step + 3) % 3;
                        chooseGender(AVATAR_GENDERS[next]);
                        e.currentTarget.parentElement
                          ?.querySelectorAll<HTMLButtonElement>("button")
                          [next]?.focus();
                      }}
                    >
                      <AvatarCanvas avatar={{ ...value, gender, ...PRESETS[gender] }} size={80} />
                      <b>{t(`avatar.gender.${gender}`)}</b>
                      {value.gender === gender && <Icon name="check" size={15} />}
                    </button>
                  ))}
                </div>,
              )}
              {panel("body", options("body", BODY_SHAPES, "avatar.bodyShape"))}
              {panel("skin", colors("skin", SKIN_TONES))}
            </>
          )}
          {tab === "head" && (
            <>
              {panel("head", options("head", HEAD_SHAPES, "avatar.headShape", true))}
              {panel("faceAccent", options("faceAccent", FACE_ACCENTS, "avatar.faceAccentStyle", true))}
              {panel("face", options("face", FACES, "avatar.faceStyle", true))}
            </>
          )}
          {tab === "hair" && (
            <>
              {panel(
                "hair",
                <>
                  <div className="avatar-subtabs" role="group" aria-label={t("avatar.hairFilter")}>
                    {AVATAR_GENDERS.map((g) => (
                      <button
                        type="button"
                        key={g}
                        aria-pressed={hairFilter === g}
                        onClick={() => setHairFilter(g)}
                      >
                        {t(`avatar.gender.${g}`)}
                      </button>
                    ))}
                  </div>
                  {options("hair", HAIR_BY_GENDER[hairFilter], "avatar.hairStyle", true)}
                  <p className="hint">{t("avatar.freeChoice")}</p>
                </>,
              )}
              {panel("hairColor", colors("hairColor", HAIR_COLORS))}
            </>
          )}
          {tab === "eyes" && panel("eyes", options("eyes", EYE_STYLES, "avatar.eyeStyle", true))}
          {tab === "brows" && panel("brows", options("brows", BROW_STYLES, "avatar.browStyle", true))}
          {tab === "mouth" && panel("mouth", options("mouth", MOUTH_STYLES, "avatar.mouthStyle", true))}
          {tab === "clothing" && (
            <div className="avatar-clothing">
              <div className="avatar-subtabs" role="group" aria-label={t("avatar.clothing")}>
                {(["outfit", "bottom", "shoes"] as const).map((c) => (
                  <button type="button" key={c} aria-pressed={clothing === c} onClick={() => setClothing(c)}>
                    {t(`avatar.${c}`)}
                  </button>
                ))}
              </div>
              {clothing === "outfit" &&
                panel(
                  "outfit",
                  <>
                    {options("outfit", OUTFITS, "avatar.outfitStyle")}
                    {colors("bodyColor", BODY_COLORS)}
                  </>,
                )}
              {clothing === "bottom" &&
                panel(
                  "bottom",
                  <>
                    {options("bottom", BOTTOMS, "avatar.bottomStyle")}
                    {colors("pantsColor", PANTS_COLORS)}
                  </>,
                )}
              {clothing === "shoes" && panel("shoes", options("shoes", SHOE_STYLES, "avatar.shoeStyle"))}
            </div>
          )}
          {tab === "accessory" && (
            <>
              {panel(
                "accessory",
                <>
                  {options("accessory", ACCESSORIES, "avatar.accessoryStyle", true)}
                  {colors("accessoryColor", BODY_COLORS)}
                </>,
              )}
              {panel(
                "layers",
                <>
                  {options("eyewear", ["none", "round", "square", "sun"], "avatar.eyewearStyle", true)}
                  <label className="avatar-layer-toggle">
                    <input
                      type="checkbox"
                      checked={value.headphones}
                      onChange={(e) => set("headphones", e.target.checked)}
                    />
                    {t("avatar.layerHeadphones")}
                  </label>
                </>,
              )}
              {panel("prop", options("prop", PROPS, "avatar.propStyle"))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
