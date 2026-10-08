"use client";

import { useEffect, useRef } from "react";
import { useT } from "@/i18n/client";
import { Icon, type IconName } from "./Icon";

export interface SettingsSection<K extends string> {
  id: K;
  label: string;
  icon?: IconName;
  danger?: boolean;
  /** Judul kelompok menu yang ditampilkan di atas bagian ini. */
  group?: string;
  /** Garis pemisah sebelum bagian ini. */
  sep?: boolean;
}

/**
 * Jendela pengaturan layar penuh dengan menu di kiri, seperti Discord.
 * Dipakai untuk pengaturan pengguna dan pengaturan grup. Escape menutup.
 */
export function SettingsShell<K extends string>({
  title,
  sections,
  active,
  onSelect,
  onClose,
  children,
  footer,
}: {
  title: string;
  sections: SettingsSection<K>[];
  active: K;
  onSelect: (k: K) => void;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>(".settings-nav button[aria-current='true']")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const nodes = [
        ...(ref.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex="0"]',
        ) ?? []),
      ].filter((el) => el.offsetParent !== null && !el.closest('[data-visible="false"]'));
      const first = nodes[0],
        last = nodes.at(-1);
      if (!first) {
        e.preventDefault();
        ref.current?.focus();
        return;
      }
      if (
        e.shiftKey &&
        (document.activeElement === first || !ref.current?.contains(document.activeElement))
      ) {
        e.preventDefault();
        last?.focus();
      } else if (
        !e.shiftKey &&
        (document.activeElement === last || !ref.current?.contains(document.activeElement))
      ) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      prev?.focus();
    };
  }, []);
  const current = sections.find((s) => s.id === active);
  return (
    <div className="settings" role="dialog" aria-modal="true" aria-label={title} ref={ref} tabIndex={-1}>
      <nav className="settings-nav" aria-label={title}>
        <div className="settings-nav-inner">
          {sections.map((s) => (
            <div key={s.id} className="settings-nav-group">
              {s.sep && <span className="settings-sep" />}
              {s.group && <div className="section-title">{s.group}</div>}
              <button
                className={`nav-item ${s.danger ? "danger" : ""}`}
                aria-current={s.id === active}
                onClick={() => onSelect(s.id)}
              >
                {s.icon && <Icon name={s.icon} size={16} />} {s.label}
              </button>
            </div>
          ))}
          {footer}
        </div>
      </nav>
      <main className="settings-main">
        <div className="settings-content">
          <h2>{current?.label}</h2>
          {children}
        </div>
        <button className="settings-close" onClick={onClose} aria-label={t("common.close")}>
          <Icon name="x" size={18} />
          <span>Esc</span>
        </button>
      </main>
    </div>
  );
}
