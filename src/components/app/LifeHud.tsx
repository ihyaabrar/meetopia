"use client";

import { useEffect, useRef, useState } from "react";
import type { RoomSnapshot } from "@/client/roomClient";
import { setPrefs, usePrefs } from "@/client/prefs";
import { useT } from "@/i18n/client";
import {
  LOW_NEED,
  NEED_KEYS,
  NO_EFFECTS,
  lifeEffects,
  tickNeeds,
  type LifeEffects,
  type LifeState,
  type NeedKey,
} from "@/shared/life";
import { Toggle } from "./UserSettings";

export const NEED_EMOJI: Record<NeedKey, string> = { energy: "⚡", hunger: "🍽️", thirst: "💧" };

/**
 * Kondisi karakter sendiri, diperkirakan di klien di antara kiriman server (tiap ~20 detik) dengan
 * rumus yang sama seperti server, agar bar bergerak mulus tanpa pesan tambahan.
 */
export function useLiveLife(snap: RoomSnapshot): LifeState | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 3_000);
    return () => clearInterval(id);
  }, []);
  const life = snap.life;
  if (!life) return null;
  return { ...life, needs: tickNeeds(life.needs, now - snap.lifeAt, life.settings, life.rest) };
}

/** Efek yang benar-benar dipakai: mati bila admin atau pengguna mematikannya (aturan 6). */
export function activeEffects(life: LifeState | null, userEnabled: boolean): LifeEffects {
  if (!life || !life.settings.enabled || !life.settings.effects || !userEnabled) return NO_EFFECTS;
  return lifeEffects(life.needs);
}

const level = (v: number) => (v < LOW_NEED ? "low" : v < 50 ? "mid" : "ok");

export function NeedBar({ need, value, compact }: { need: NeedKey; value: number; compact?: boolean }) {
  const t = useT();
  const pct = Math.round(value);
  return (
    <div className={`need ${compact ? "compact" : ""}`} data-level={level(value)}>
      <span className="need-ico" aria-hidden>
        {NEED_EMOJI[need]}
      </span>
      {!compact && <span className="need-name">{t(`life.${need}`)}</span>}
      <span
        className="need-track"
        role="meter"
        aria-label={t(`life.${need}`)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
      >
        <i style={{ width: `${pct}%` }} />
      </span>
      {!compact && <span className="need-val">{pct}</span>}
    </div>
  );
}

/** Chip di kiri atas peta: koin + tiga bar mini. Diketuk untuk melihat rincian. */
export function LifeHud({ life }: { life: LifeState }) {
  const t = useT();
  const prefs = usePrefs();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const s = life.settings;
  const low = NEED_KEYS.filter((k) => life.needs[k] < LOW_NEED);
  return (
    <div className="life-hud" ref={ref}>
      <button
        className="hud-chip chip-btn life-chip"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={t("life.open")}
        title={t("life.open")}
        data-low={low.length > 0}
      >
        <span className="coin-amt">
          <span aria-hidden>🪙</span> <b data-testid="coins">{life.coins}</b>
        </span>
        <span className="need-minis">
          {NEED_KEYS.map((k) => (
            <NeedBar key={k} need={k} value={life.needs[k]} compact />
          ))}
        </span>
      </button>
      {open && (
        <div className="life-pop" role="dialog" aria-label={t("life.title")}>
          <div className="life-pop-head">
            <b>{t("life.title")}</b>
            <span className="coin-amt">
              <span aria-hidden>🪙</span> {t("life.coins", { n: life.coins })}
            </span>
          </div>
          {NEED_KEYS.map((k) => (
            <NeedBar key={k} need={k} value={life.needs[k]} />
          ))}
          {life.rest !== "none" && <p className="life-note ok">{t(`life.rest.${life.rest}`)}</p>}
          {low.length > 0 && (
            <p className="life-note warn">
              {t("life.low", { need: low.map((k) => t(`life.${k}`)).join(", ") })}
            </p>
          )}
          <p className="hint">{t("life.restHint")}</p>
          <p className="hint">{t("life.foodHint")}</p>
          <div className="life-salary">
            {s.salary && s.coinsPerHour > 0 ? (
              <>
                <span>{t("life.earnedToday", { n: life.earnedToday, cap: s.dailyCap })}</span>
                <span className="need-track" aria-hidden>
                  <i
                    style={{ width: `${Math.min(100, (life.earnedToday / Math.max(1, s.dailyCap)) * 100)}%` }}
                  />
                </span>
                <span className="hint">{t("life.salaryHint", { n: s.coinsPerHour })}</span>
              </>
            ) : (
              <span className="hint">{t("life.salaryOff")}</span>
            )}
          </div>
          {s.effects ? (
            <Toggle
              id="life-effects"
              label={t("us.lifeEffects")}
              hint={t("us.lifeEffectsHint")}
              checked={prefs.lifeEffects}
              onChange={(v) => setPrefs({ lifeEffects: v })}
            />
          ) : (
            <p className="hint">{t("life.effectsOffAdmin")}</p>
          )}
        </div>
      )}
    </div>
  );
}
