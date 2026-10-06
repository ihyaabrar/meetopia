"use client";

import { useState } from "react";
import { api, errorKey } from "@/client/api";
import { useT } from "@/i18n/client";
import { Modal } from "@/components/Modal";
import { GroupIconPicker } from "@/components/GroupIconPicker";
import { GROUP_COLOR_KEYS, type GroupColor, type GroupSymbol } from "@/shared/groupIcon";
import { TemplatePicker } from "@/components/TemplatePicker";
import type { TemplateId } from "@/shared/templates";

export function CreateGroup({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const t = useT();
  const [name, setName] = useState("");
  const [icon, setIcon] = useState<{ color: GroupColor; symbol: GroupSymbol }>(() => ({
    color: GROUP_COLOR_KEYS[Math.floor(Math.random() * GROUP_COLOR_KEYS.length)],
    symbol: "initials",
  }));
  const [template, setTemplate] = useState<TemplateId>("office");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api<{ id: string }>("/api/groups", {
        body: { name, iconColor: icon.color, iconSymbol: icon.symbol, template },
      });
      onCreated(r.id);
    } catch (err) {
      setError(t(errorKey(err)));
      setBusy(false);
    }
  };
  return (
    <Modal
      title={t("group.createTitle")}
      sub={t("group.createSub")}
      onClose={onClose}
      wide
      className="create-group"
    >
      <form onSubmit={submit}>
        {error && <p className="error-text">{error}</p>}
        <div className="field">
          <label htmlFor="group-name">{t("group.name")}</label>
          <input
            id="group-name"
            className="input"
            required
            maxLength={60}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("group.namePlaceholder")}
          />
        </div>
        <GroupIconPicker name={name} color={icon.color} symbol={icon.symbol} onChange={setIcon} />
        <div className="section-title" style={{ paddingLeft: 0 }}>
          {t("tpl.choose")}
        </div>
        <TemplatePicker value={template} onChange={setTemplate} compact />
        <div className="modal-actions">
          <button type="button" className="btn secondary" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button className="btn" disabled={busy || !name.trim()}>
            {t("group.create")}
          </button>
        </div>
      </form>
    </Modal>
  );
}
