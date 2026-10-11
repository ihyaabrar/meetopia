"use client";

import { useCallback } from "react";
import { AvatarCanvas } from "./AvatarCanvas";
import { MapPreview } from "./MapPreview";
import dynamic from "next/dynamic";
import { useWebGL } from "@/features/world3d/useWebGL";

const Diorama3D = dynamic(() => import("@/features/world3d/room/Diorama3D"), { ssr: false });
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
  const webgl = useWebGL();
  // Stable callback: a new function would make the 3D preview rebuild its world on every render.
  const zoneLabel = useCallback((k: string) => t(k), [t]);
  return (
    <div className="auth-experience" data-expanded={expanded || undefined}>
      <aside className="auth-story">
        <h2>
          {t("auth.panelTitle")} <span className="auth-story-accent">{t("auth.panelJoin")}</span>
        </h2>
        <p>{t("auth.panelBody")}</p>
        <div className="auth-room-preview" aria-hidden>
          {webgl ? (
            <Diorama3D
              template="home"
              names={["Ayu", "Bima", "Sari"]}
              zoom={0.85}
              zoneLabel={zoneLabel}
              label={t("auth.panelPresence")}
            />
          ) : webgl === false ? (
            <>
              <MapPreview id="home" />
              <div className="auth-people">
                {PEOPLE.map((avatar, index) => (
                  <span className={`auth-person p${index + 1}`} key={avatar.bodyColor}>
                    <AvatarCanvas avatar={avatar} size={72} animate />
                    <i />
                  </span>
                ))}
              </div>
            </>
          ) : null}
          <span className="auth-room-status">{t("auth.panelPresence")}</span>
        </div>
      </aside>
      <div className="auth-form-slot">{children}</div>
    </div>
  );
}
