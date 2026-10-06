"use client";
import { useState } from "react";
import { useT } from "@/i18n/client";
import { TEMPLATE_IDS, TEMPLATE_PERKS, buildTemplate, type TemplateId } from "@/shared/templates";
import { Icon, type IconName } from "./Icon";
import { MapPreview } from "./MapPreview";

export const WORLD_ICONS: Record<TemplateId, IconName> = {
  office: "briefcase",
  home: "home",
  gaming: "play",
  studio: "palette",
  rooftop: "leaf",
};
const CATEGORIES = ["all", "office", "home", "gaming", "studio", "rooftop"] as const;

export function TemplatePicker({
  value,
  onChange,
  current,
}: {
  value: TemplateId;
  onChange: (id: TemplateId) => void;
  current?: TemplateId;
}) {
  const t = useT();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("all");
  const [ambience, setAmbience] = useState("normal");
  const filtered = TEMPLATE_IDS.filter(
    (id) =>
      (category === "all" || id === category) &&
      `${t(`tpl.${id}`)} ${t(`tpl.${id}.desc`)}`
        .toLocaleLowerCase()
        .includes(query.toLocaleLowerCase().trim()),
  );
  return (
    <div className="map-gallery">
      <div className="gallery-heading">
        <div>
          <span className="eyebrow">MEETOPIA WORLDS</span>
          <h3>{t("gallery.title")}</h3>
          <p>{t("gallery.subtitle")}</p>
        </div>
        <label className="gallery-search">
          <Icon name="search" size={17} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("gallery.search")}
            aria-label={t("gallery.search")}
          />
        </label>
      </div>
      <div className="gallery-filters" role="group" aria-label={t("gallery.filter")}>
        {CATEGORIES.map((id) => (
          <button
            className="chip"
            type="button"
            key={id}
            aria-pressed={category === id}
            onClick={() => setCategory(id)}
          >
            {t(id === "all" ? "gallery.all" : `tpl.${id}`)}
          </button>
        ))}
      </div>
      <div className="gallery-layout">
        <div className="tpl-list" role="radiogroup" aria-label={t("tpl.choose")}>
          {filtered.map((id, index) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={value === id}
              tabIndex={value === id || (!filtered.includes(value) && index === 0) ? 0 : -1}
              className={`tpl tpl-${id}`}
              onClick={() => onChange(id)}
              onKeyDown={(event) => {
                const step = ["ArrowRight", "ArrowDown"].includes(event.key)
                  ? 1
                  : ["ArrowLeft", "ArrowUp"].includes(event.key)
                    ? -1
                    : 0;
                if (!step && event.key !== "Home" && event.key !== "End") return;
                event.preventDefault();
                const next =
                  event.key === "Home"
                    ? 0
                    : event.key === "End"
                      ? filtered.length - 1
                      : (index + step + filtered.length) % filtered.length;
                onChange(filtered[next]);
                event.currentTarget.parentElement
                  ?.querySelectorAll<HTMLButtonElement>("button.tpl")
                  [next]?.focus();
              }}
            >
              <MapPreview id={id} className="tpl-thumb" />
              {value === id && (
                <span className="tpl-check">
                  <Icon name="check" size={14} />
                </span>
              )}
              <span className="tpl-body">
                <Icon name={WORLD_ICONS[id]} size={22} />
                <span className="grow">
                  <span className="tpl-name">
                    <b>{t(`tpl.${id}`)}</b>
                    {current === id && <span className="badge">{t("tpl.current")}</span>}
                  </span>
                  <span className="hint">{t(`landing.space.${id}`)}</span>
                </span>
                <span className="tpl-arrow">
                  <Icon name="arrow" size={15} />
                </span>
              </span>
            </button>
          ))}
          {!filtered.length && (
            <div className="gallery-empty">
              <Icon name="leaf" size={32} />
              <b>{t("gallery.empty")}</b>
              <p className="hint">{t("gallery.emptyHint")}</p>
              <button
                type="button"
                className="btn secondary small"
                onClick={() => {
                  setQuery("");
                  setCategory("all");
                }}
              >
                {t("gallery.showAll")}
              </button>
            </div>
          )}
        </div>
        <aside className="gallery-detail" aria-label={t("gallery.detail")}>
          <div className="gallery-detail-title">
            <Icon name={WORLD_ICONS[value]} size={24} />
            <div>
              <h4>{t(`tpl.${value}`)}</h4>
              <p>{t(`tpl.${value}.desc`)}</p>
            </div>
          </div>
          <MapPreview id={value} ambience={ambience} className="gallery-large-preview" />
          <span className="gallery-area-count">
            <Icon name="door" size={14} />
            {t("gallery.areas", { n: buildTemplate(value).zones.length })}
          </span>
          <ul className="gallery-perks">
            {TEMPLATE_PERKS[value].map((key) => (
              <li key={key}>
                <span>
                  <Icon name="check" size={16} />
                </span>
                {t(key)}
              </li>
            ))}
          </ul>
          <div className="gallery-ambience">
            <b>{t("gallery.lightPreview")}</b>
            <div>
              {["bright", "normal", "dim", "night"].map((v) => (
                <button
                  type="button"
                  className="chip"
                  key={v}
                  aria-pressed={ambience === v}
                  onClick={() => setAmbience(v)}
                >
                  {t(`gallery.ambience.${v}`)}
                </button>
              ))}
            </div>
            <small className="hint">{t("gallery.previewOnly")}</small>
          </div>
        </aside>
      </div>
    </div>
  );
}
