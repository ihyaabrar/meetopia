"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, errorKey } from "@/client/api";
import type { MediaManager } from "@/client/media";
import { applyContrast, applyTheme, setPrefs, usePrefs, type Prefs } from "@/client/prefs";
import { playSound } from "@/client/sounds";
import { useI18n } from "@/i18n/client";
import { LOCALES, THEMES, THEME_COOKIE, isTheme, type Locale, type Theme } from "@/i18n";
import { AvatarBuilder } from "@/components/AvatarBuilder";
import { AvatarCanvas } from "@/components/AvatarCanvas";
import { SettingsShell, type SettingsSection } from "@/components/SettingsShell";
import { Icon } from "@/components/Icon";
import { useDevices, useMicLevel } from "./useMicLevel";
import type { Me } from "./types";

export type UserSection =
  "profile" | "notifications" | "appearance" | "voice" | "privacy" | "security" | "about";

/** Pengaturan pengguna: akun, avatar, tampilan, suara & video, notifikasi (masing-masing terpisah). */
export function UserSettings({
  me,
  media,
  initial = "profile",
  onClose,
  onSaved,
}: {
  me: Me;
  media: MediaManager | null;
  initial?: UserSection;
  onClose: () => void;
  onSaved: (me: Me) => void;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [section, setSection] = useState<UserSection>(initial);
  const sections: SettingsSection<UserSection>[] = [
    { id: "profile", label: t("us.profile"), icon: "user" },
    { id: "notifications", label: t("us.notifications"), icon: "bell" },
    { id: "appearance", label: t("us.appearance"), icon: "palette" },
    { id: "voice", label: t("us.voice"), icon: "mic" },
    { id: "privacy", label: t("us.privacy"), icon: "lock" },
    { id: "security", label: t("us.security"), icon: "alert" },
    { id: "about", label: t("us.about"), icon: "help" },
  ];
  const logout = async () => {
    await api("/api/auth/logout", { method: "POST" });
    router.replace("/");
    router.refresh();
  };
  return (
    <SettingsShell
      title={t("us.title")}
      sections={sections}
      active={section}
      onSelect={setSection}
      onClose={onClose}
      footer={
        <div className="settings-nav-group">
          <span className="settings-sep" />
          <button className="nav-item" onClick={logout}>
            <Icon name="logout" size={16} /> {t("auth.logout")}
          </button>
        </div>
      }
    >
      {section === "profile" && (
        <>
          <AccountSection me={me} onSaved={onSaved} part="profile" />
          <h3 className="settings-h3">{t("us.avatar")}</h3>
          <AvatarSection me={me} onSaved={onSaved} />
        </>
      )}
      {section === "security" && <AccountSection me={me} onSaved={onSaved} part="security" />}
      {section === "privacy" && <AccountSection me={me} onSaved={onSaved} part="privacy" />}
      {section === "about" && <AboutSection />}
      {section === "appearance" && <AppearanceSection me={me} onSaved={onSaved} />}
      {section === "voice" && <VoiceSection media={media} />}
      {section === "notifications" && <NotificationSection />}
    </SettingsShell>
  );
}

function useStatus() {
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const view = (
    <>
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="success-text" role="status">
          {notice}
        </p>
      )}
    </>
  );
  return { setError, setNotice, view };
}

export function Toggle({
  id,
  label,
  hint,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="setting-row">
      <label htmlFor={id} className="grow">
        <b>{label}</b>
        {hint && <span className="hint">{hint}</span>}
      </label>
      <input
        id={id}
        type="checkbox"
        role="switch"
        className="switch"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </div>
  );
}

function AccountSection({
  me,
  onSaved,
  part,
}: {
  me: Me;
  onSaved: (me: Me) => void;
  part: "profile" | "security" | "privacy";
}) {
  const { t } = useI18n();
  const router = useRouter();
  const status = useStatus();
  const [name, setName] = useState(me.name);
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [pwOpen, setPwOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [delPw, setDelPw] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<void>, ok?: string) => {
    status.setError(null);
    status.setNotice(null);
    setBusy(true);
    try {
      await fn();
      if (ok) status.setNotice(ok);
    } catch (e) {
      status.setError(t(errorKey(e)));
    } finally {
      setBusy(false);
    }
  };

  const saveName = () =>
    run(async () => {
      const r = await api<{ user: Me }>("/api/me", { method: "PATCH", body: { name } });
      onSaved(r.user);
    }, t("common.saved"));

  const changePassword = () =>
    run(async () => {
      await api("/api/me/password", { body: { current: pw.current, next: pw.next } });
      setPw({ current: "", next: "", confirm: "" });
      setPwOpen(false);
    }, t("us.passwordChanged"));

  const resend = () =>
    run(async () => {
      await api("/api/auth/resend", { method: "POST" });
    }, t("profile.verifySent"));

  const deleteAccount = () =>
    run(async () => {
      await api("/api/me", { method: "DELETE", body: { password: delPw } });
      router.replace("/");
      router.refresh();
    });

  const pwMismatch = pw.confirm.length > 0 && pw.next !== pw.confirm;

  return (
    <>
      {status.view}
      {part === "profile" && (
        <>
          <div className="profile-banner">
            <span className="avatar-wrap">
              <AvatarCanvas avatar={me.avatar} size={72} face />
            </span>
            <div className="grow">
              <b>{me.name}</b>
              <span className="hint">{me.email}</span>
            </div>
          </div>

          <section className="setting-card">
            <div className="field">
              <label htmlFor="us-name">{t("auth.displayName")}</label>
              <div className="row">
                <input
                  id="us-name"
                  className="input"
                  maxLength={40}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <button
                  className="btn"
                  disabled={busy || !name.trim() || name.trim() === me.name}
                  onClick={saveName}
                >
                  {t("common.save")}
                </button>
              </div>
            </div>
            <div className="setting-row">
              <div className="grow">
                <b>{t("auth.email")}</b>
                <span className="hint">
                  {me.email}
                  {me.emailVerification &&
                    ` · ${me.emailVerified ? t("profile.verified") : t("profile.notVerified")}`}
                </span>
              </div>
              {me.emailVerification && !me.emailVerified && (
                <button className="btn secondary small" onClick={resend}>
                  {t("profile.resend")}
                </button>
              )}
            </div>
          </section>
        </>
      )}

      {part === "security" && (
        <section className="setting-card">
          <div className="setting-row">
            <div className="grow">
              <b>{t("auth.password")}</b>
              <span className="hint">{t("us.passwordHint")}</span>
            </div>
            {!pwOpen && (
              <button className="btn secondary small" onClick={() => setPwOpen(true)}>
                {t("us.changePassword")}
              </button>
            )}
          </div>
          {pwOpen && (
            <form
              className="pw-form"
              onSubmit={(e) => {
                e.preventDefault();
                void changePassword();
              }}
            >
              {(
                [
                  ["current", "us.currentPassword", "current-password"],
                  ["next", "us.newPassword", "new-password"],
                  ["confirm", "us.confirmPassword", "new-password"],
                ] as const
              ).map(([k, label, ac]) => (
                <div className="field" key={k}>
                  <label htmlFor={`us-pw-${k}`}>{t(label)}</label>
                  <input
                    id={`us-pw-${k}`}
                    type="password"
                    className="input"
                    autoComplete={ac}
                    minLength={k === "current" ? undefined : 8}
                    required
                    value={pw[k]}
                    onChange={(e) => setPw({ ...pw, [k]: e.target.value })}
                  />
                </div>
              ))}
              {pwMismatch && <p className="error-text">{t("us.passwordMismatch")}</p>}
              <p className="hint">{t("us.passwordOthersOut")}</p>
              <div className="row">
                <span className="spacer" />
                <button type="button" className="btn secondary small" onClick={() => setPwOpen(false)}>
                  {t("common.cancel")}
                </button>
                <button className="btn small" disabled={busy || pwMismatch || pw.next.length < 8}>
                  {t("us.changePassword")}
                </button>
              </div>
            </form>
          )}
        </section>
      )}

      {part === "privacy" && (
        <>
          <h3 className="settings-h3" style={{ marginTop: 0 }}>
            {t("us.data")}
          </h3>
          <section className="setting-card">
            <div className="setting-row">
              <div className="grow">
                <b>{t("profile.export")}</b>
                <span className="hint">{t("us.exportHint")}</span>
              </div>
              <a className="btn secondary small" href="/api/me/export">
                {t("us.download")}
              </a>
            </div>
          </section>

          <h3 className="settings-h3 danger">{t("us.dangerZone")}</h3>
          <section className="setting-card danger">
            <div className="setting-row">
              <div className="grow">
                <b>{t("profile.delete")}</b>
                <span className="hint">{t("profile.deleteWarn")}</span>
              </div>
              {!deleting && (
                <button className="btn danger-outline small" onClick={() => setDeleting(true)}>
                  {t("profile.delete")}
                </button>
              )}
            </div>
            {deleting && (
              <div className="row" style={{ marginTop: 10 }}>
                <input
                  type="password"
                  className="input"
                  placeholder={t("auth.password")}
                  aria-label={t("auth.password")}
                  value={delPw}
                  onChange={(e) => setDelPw(e.target.value)}
                />
                <button className="btn secondary small" onClick={() => setDeleting(false)}>
                  {t("common.cancel")}
                </button>
                <button className="btn danger small" disabled={!delPw || busy} onClick={deleteAccount}>
                  {t("profile.deleteConfirm")}
                </button>
              </div>
            )}
          </section>
        </>
      )}
    </>
  );
}

function AboutSection() {
  const t = useI18n().t;
  return (
    <section className="setting-card about">
      <div className="setting-row">
        <div className="grow">
          <b>Meetopia</b>
          <span className="hint">Work • Talk • Together</span>
        </div>
      </div>
      <div className="setting-row">
        <div className="grow">
          <b>{t("us.aboutPrivacy")}</b>
          <span className="hint">{t("devices.privacy")}</span>
        </div>
      </div>
      <div className="setting-row">
        <div className="grow">
          <b>{t("us.aboutKeys")}</b>
          <span className="hint">{t("us.aboutKeysHint")}</span>
        </div>
      </div>
    </section>
  );
}

function AvatarSection({ me, onSaved }: { me: Me; onSaved: (me: Me) => void }) {
  const { t } = useI18n();
  const status = useStatus();
  const [avatar, setAvatar] = useState(me.avatar);
  const changed = JSON.stringify(avatar) !== JSON.stringify(me.avatar);
  const save = async () => {
    status.setError(null);
    try {
      const r = await api<{ user: Me }>("/api/me", { method: "PATCH", body: { avatar } });
      onSaved(r.user);
      status.setNotice(t("us.avatarSaved"));
    } catch (e) {
      status.setError(t(errorKey(e)));
    }
  };
  return (
    <>
      <p className="hint">{t("us.avatarHint")}</p>
      {status.view}
      <AvatarBuilder value={avatar} onChange={setAvatar} />
      <div className="save-bar" data-visible={changed}>
        <span className="grow">{t("us.unsaved")}</span>
        <button className="btn ghost small" onClick={() => setAvatar(me.avatar)}>
          {t("us.reset")}
        </button>
        <button className="btn small" onClick={save}>
          {t("common.save")}
        </button>
      </div>
    </>
  );
}

function AppearanceSection({ me, onSaved }: { me: Me; onSaved: (me: Me) => void }) {
  const { t, locale, setLocale } = useI18n();
  const prefs = usePrefs();
  const status = useStatus();
  const [theme, setTheme] = useState<Theme>(() => {
    const v = typeof document === "undefined" ? null : document.documentElement.dataset.theme;
    return isTheme(v) ? v : "dark";
  });

  const patch = async (body: Partial<{ locale: Locale; highContrast: boolean }>) => {
    try {
      const r = await api<{ user: Me }>("/api/me", { method: "PATCH", body });
      onSaved(r.user);
    } catch (e) {
      status.setError(t(errorKey(e)));
    }
  };

  const chooseTheme = (th: Theme) => {
    setTheme(th);
    applyTheme(th, THEME_COOKIE);
  };

  return (
    <>
      {status.view}
      <h3 className="settings-h3">{t("profile.theme")}</h3>
      <div className="theme-picker" role="radiogroup" aria-label={t("profile.theme")}>
        {THEMES.map((th) => (
          <button
            key={th}
            role="radio"
            aria-checked={theme === th}
            className={`theme-option t-${th}`}
            onClick={() => chooseTheme(th)}
          >
            <span className="theme-swatch" aria-hidden>
              <i />
              <i />
              <i />
            </span>
            {t(`profile.theme.${th}`)}
          </button>
        ))}
      </div>

      <h3 className="settings-h3">{t("common.language")}</h3>
      <section className="setting-card">
        <div className="field" style={{ marginBottom: 0 }}>
          <select
            id="us-lang"
            className="input"
            aria-label={t("common.language")}
            value={locale}
            onChange={(e) => {
              const l = e.target.value as Locale;
              setLocale(l);
              void patch({ locale: l });
            }}
          >
            {LOCALES.map((l) => (
              <option key={l} value={l}>
                {l === "id" ? "Bahasa Indonesia" : "English"}
              </option>
            ))}
          </select>
        </div>
      </section>

      <h3 className="settings-h3">{t("us.accessibility")}</h3>
      <section className="setting-card">
        <Toggle
          id="us-contrast"
          label={t("profile.highContrast")}
          hint={t("us.contrastHint")}
          checked={me.highContrast}
          onChange={(v) => {
            applyContrast(v);
            void patch({ highContrast: v });
          }}
        />
      </section>

      <h3 className="settings-h3">{t("us.roomSettings")}</h3>
      <section className="setting-card">
        <Toggle
          id="us-minimap"
          label={t("us.showMinimap")}
          checked={prefs.showMinimap}
          onChange={(v) => setPrefs({ showMinimap: v })}
        />
        <Toggle
          id="us-names"
          label={t("us.showNames")}
          hint={t("us.showNamesHint")}
          checked={prefs.showNames}
          onChange={(v) => setPrefs({ showNames: v })}
        />
        <Toggle
          id="us-life-hud"
          label={t("us.showLifeHud")}
          hint={t("us.showLifeHudHint")}
          checked={prefs.showLifeHud}
          onChange={(v) => setPrefs({ showLifeHud: v })}
        />
        <Toggle
          id="us-life-effects"
          label={t("us.lifeEffects")}
          hint={t("us.lifeEffectsHint")}
          checked={prefs.lifeEffects}
          onChange={(v) => setPrefs({ lifeEffects: v })}
        />
        <Toggle
          id="us-motion"
          label={t("us.avatarAnimation")}
          hint={t("us.avatarAnimationHint")}
          checked={!prefs.reducedMotion}
          onChange={(v) => setPrefs({ reducedMotion: !v })}
        />
        <Toggle
          id="us-sounds"
          label={t("us.notifSounds")}
          checked={prefs.soundKnock || prefs.soundDm || prefs.soundMention}
          onChange={(v) => setPrefs({ soundKnock: v, soundDm: v, soundMention: v })}
        />
      </section>
    </>
  );
}

function VoiceSection({ media }: { media: MediaManager | null }) {
  const { t } = useI18n();
  const prefs = usePrefs();
  const [devices, refresh] = useDevices();
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const level = useMicLevel(testing, prefs.micDeviceId, (name) => {
    setError(t(name === "NotFoundError" ? "media.err.micNotFound" : "media.err.micDenied"));
    setTesting(false);
  });
  // Nama perangkat baru terbaca setelah izin mikrofon diberikan.
  useEffect(() => {
    if (!testing) return;
    const id = setTimeout(refresh, 800);
    return () => clearTimeout(id);
  }, [testing, refresh]);

  const select = (
    id: string,
    label: string,
    key: keyof Prefs,
    kind: MediaDeviceKind,
    apply: (v: string) => void,
  ) => {
    const list = devices.filter((d) => d.kind === kind && d.deviceId && d.deviceId !== "default");
    return (
      <div className="field">
        <label htmlFor={id}>{label}</label>
        <select
          id={id}
          className="input"
          value={String(prefs[key])}
          onChange={(e) => {
            setPrefs({ [key]: e.target.value });
            apply(e.target.value);
          }}
        >
          <option value="">{t("devices.default")}</option>
          {list.map((d, i) => (
            <option key={d.deviceId} value={d.deviceId}>
              {d.label || `${label} ${i + 1}`}
            </option>
          ))}
        </select>
      </div>
    );
  };

  const slider = (id: string, label: string, key: "othersVolume" | "musicVolume") => (
    <div className="field">
      <label htmlFor={id}>
        {label}: <b>{Math.round(prefs[key] * 100)}%</b>
      </label>
      <input
        id={id}
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={prefs[key]}
        onChange={(e) => setPrefs({ [key]: Number(e.target.value) })}
      />
    </div>
  );

  return (
    <>
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
      <div className="settings-grid">
        <section className="setting-card">
          {select("us-mic", t("devices.mic"), "micDeviceId", "audioinput", (v) => void media?.switchMic(v))}
          <div className="row">
            <button type="button" className="btn secondary small" onClick={() => setTesting((v) => !v)}>
              {testing ? t("devices.stopTest") : t("devices.testMic")}
            </button>
            <div
              className="meter"
              style={{ flex: 1 }}
              role="meter"
              aria-label={t("devices.level")}
              aria-valuenow={Math.round(level * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div style={{ width: `${level * 100}%` }} />
            </div>
          </div>
        </section>
        <section className="setting-card">
          {select("us-speaker", t("devices.speaker"), "speakerDeviceId", "audiooutput", (v) =>
            media?.switchSpeaker(v),
          )}
          {select(
            "us-cam",
            t("devices.camera"),
            "camDeviceId",
            "videoinput",
            (v) => void media?.switchCam(v),
          )}
        </section>
      </div>

      <h3 className="settings-h3">{t("us.volume")}</h3>
      <section className="setting-card">
        {slider("us-vol-others", t("us.othersVolume"), "othersVolume")}
        {slider("us-vol-music", t("us.musicVolume"), "musicVolume")}
      </section>

      <h3 className="settings-h3">{t("us.behaviour")}</h3>
      <section className="setting-card">
        <Toggle
          id="us-mic-join"
          label={t("devices.startWithMic")}
          hint={t("us.micOnJoinHint")}
          checked={prefs.micOnJoin}
          onChange={(v) => setPrefs({ micOnJoin: v })}
        />
        <Toggle
          id="us-noise"
          label={t("us.noiseSuppression")}
          hint={t("us.noiseSuppressionHint")}
          checked={prefs.noiseSuppression}
          onChange={(v) => {
            setPrefs({ noiseSuppression: v });
            void media?.restartMic();
          }}
        />
      </section>
      <p className="hint">{t("devices.privacy")}</p>
    </>
  );
}

function NotificationSection() {
  const { t } = useI18n();
  const prefs = usePrefs();
  const [perm, setPerm] = useState(() =>
    typeof Notification === "undefined" ? "unsupported" : Notification.permission,
  );
  const sound = (key: "soundKnock" | "soundDm" | "soundMention", kind: "knock" | "dm" | "mention") => (
    <div className="setting-row">
      <label htmlFor={`us-${key}`} className="grow">
        <b>{t(`us.${key}`)}</b>
        <span className="hint">{t(`us.${key}Hint`)}</span>
      </label>
      <button className="btn ghost small" onClick={() => playSound(kind)}>
        <Icon name="play" size={14} /> {t("us.preview")}
      </button>
      <input
        id={`us-${key}`}
        type="checkbox"
        role="switch"
        className="switch"
        checked={prefs[key]}
        onChange={(e) => setPrefs({ [key]: e.target.checked })}
      />
    </div>
  );
  return (
    <>
      <h3 className="settings-h3">{t("us.sounds")}</h3>
      <section className="setting-card">
        {sound("soundKnock", "knock")}
        {sound("soundDm", "dm")}
        {sound("soundMention", "mention")}
      </section>
      <h3 className="settings-h3">{t("us.desktop")}</h3>
      <section className="setting-card">
        <Toggle
          id="us-desktop"
          label={t("us.desktopNotify")}
          hint={
            perm === "denied"
              ? t("us.desktopDenied")
              : perm === "unsupported"
                ? t("us.desktopUnsupported")
                : t("us.desktopNotifyHint")
          }
          checked={prefs.desktopNotify && perm === "granted"}
          onChange={async (v) => {
            if (v && typeof Notification !== "undefined" && Notification.permission === "default") {
              const p = await Notification.requestPermission();
              setPerm(p);
              if (p !== "granted") return;
            }
            setPrefs({ desktopNotify: v });
          }}
        />
      </section>
    </>
  );
}
