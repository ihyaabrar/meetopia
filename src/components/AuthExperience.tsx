"use client";

import { AvatarCanvas } from "./AvatarCanvas";
import { Icon } from "./Icon";
import { MapPreview } from "./MapPreview";
import { useT } from "@/i18n/client";
import { DEFAULT_AVATAR, type AvatarConfig } from "@/shared/avatar";

const PEOPLE: AvatarConfig[] = [
  {
    ...DEFAULT_AVATAR,
    gender: "female",
    body: "round",
    bodyColor: "#d9605a",
    skin: "#c5845a",
    face: "happy",
    hair: "bob",
    hairColor: "#2b211c",
  },
  {
    ...DEFAULT_AVATAR,
    gender: "male",
    body: "tall",
    bodyColor: "#4a7fc1",
    skin: "#8d5a3b",
    face: "calm",
    hair: "curly",
    hairColor: "#2b211c",
  },
  {
    ...DEFAULT_AVATAR,
    gender: "neutral",
    body: "small",
    bodyColor: "#3f9a55",
    skin: "#f6cfa6",
    face: "wink",
    hair: "sprout",
    hairColor: "#a8652f",
  },
];

/** Bingkai auth yang membawa konteks produk tanpa mengganggu fokus formulir. */
export function AuthExperience({
  children,
  expanded = false,
}: {
  children: React.ReactNode;
  expanded?: boolean;
}) {
  const t = useT();
  return (
    <div className="auth-experience" data-expanded={expanded || undefined}>
      <aside className="auth-story">
        <span className="auth-eyebrow">{t("auth.panelEyebrow")}</span>
        <h2>
          {t("auth.panelTitle")} <span className="auth-story-accent">{t("auth.panelJoin")}</span>
        </h2>
        <p>{t("auth.panelBody")}</p>
        <div className="auth-room-preview" aria-hidden>
          <MapPreview id="home" />
          <span className="auth-room-label">
            <Icon name="door" size={15} /> Lounge
          </span>
          <div className="auth-people">
            {PEOPLE.map((avatar, index) => (
              <span className={`auth-person p${index + 1}`} key={avatar.bodyColor}>
                <AvatarCanvas avatar={avatar} size={72} animate />
                <i />
              </span>
            ))}
          </div>
          <span className="auth-chat-bubble">{t("landing.bubble1")}</span>
          <span className="auth-room-status">
            <i /> {t("auth.panelPresence")}
          </span>
        </div>
        <div className="auth-story-meta">
          <span>
            <Icon name="lock" size={15} /> {t("auth.secure")}
          </span>
          <span>
            <Icon name="bolt" size={15} /> {t("auth.fast")}
          </span>
        </div>
      </aside>
      <div className="auth-form-slot">{children}</div>
    </div>
  );
}
