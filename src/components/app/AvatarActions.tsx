"use client";
import { useState } from "react";
import { ACTION_GROUPS, actionLabel, type AvatarAction, type ActionGroup } from "@/shared/avatar-animation";
import { useI18n } from "@/i18n/client";
import { Icon } from "../Icon";
export function AvatarActions({
  value,
  onSelect,
}: {
  value: AvatarAction;
  onSelect: (a: AvatarAction) => void;
}) {
  const { locale } = useI18n();
  const [group, setGroup] = useState<ActionGroup>("social");
  const labels: Record<ActionGroup, string> =
    locale === "id"
      ? { movement: "Gerak", work: "Kerja", social: "Sosial", condition: "Kondisi" }
      : { movement: "Movement", work: "Work", social: "Social", condition: "Conditions" };
  return (
    <section
      className="avatar-live-actions"
      aria-label={locale === "id" ? "Gerakan avatar" : "Avatar actions"}
    >
      <header>
        <span>{locale === "id" ? "Gerakan avatar" : "Avatar actions"}</span>
        <button type="button" onClick={() => onSelect("idle")}>
          <Icon name="x" size={14} />
          {locale === "id" ? "Hentikan" : "Stop"}
        </button>
      </header>
      <div
        className="avatar-action-groups"
        role="group"
        aria-label={locale === "id" ? "Kategori gerakan" : "Action categories"}
      >
        {(Object.keys(labels) as ActionGroup[]).map((g) => (
          <button type="button" key={g} aria-pressed={group === g} onClick={() => setGroup(g)}>
            {labels[g]}
          </button>
        ))}
      </div>
      <div className="avatar-action-grid">
        {ACTION_GROUPS[group].map((a) => (
          <button
            type="button"
            key={a}
            aria-pressed={value === a}
            data-action={a}
            onClick={() => onSelect(a)}
          >
            {actionLabel(a, locale)}
          </button>
        ))}
      </div>
      <small>
        {locale === "id"
          ? "Pose visual; berjalan menghentikan aksi. Kondisi tidak mengubah kebutuhan. Gestur berpasangan tidak menggerakkan pemain lain."
          : "Visual poses; walking stops the action. Conditions do not change needs. Pair gestures do not control other players."}
      </small>
    </section>
  );
}
