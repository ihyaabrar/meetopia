"use client";

import { useEffect, useState } from "react";
import type { RoomClient } from "@/client/roomClient";
import { useT } from "@/i18n/client";
import { Modal } from "@/components/Modal";
import { Icon } from "@/components/Icon";
import type { Zone } from "@/shared/map";

const PIN_RE = /^\d{4,6}$/;

function PinInput({ value, onChange, id }: { value: string; onChange: (v: string) => void; id: string }) {
  return (
    <input
      id={id}
      className="input code pin-input"
      inputMode="numeric"
      autoComplete="off"
      maxLength={6}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
      autoFocus
    />
  );
}

/** Pemegang ruangan membuat PIN untuk mengunci ruangan. */
export function SetPinDialog({ room, zone, onClose }: { room: RoomClient; zone: Zone; onClose: () => void }) {
  const t = useT();
  const [pin, setPin] = useState("");
  return (
    <Modal title={t("lock.setTitle", { zone: t(zone.label) })} sub={t("lock.setSub")} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!PIN_RE.test(pin)) return;
          room.send({ t: "lockZone", zoneId: zone.id, locked: true, pin });
          onClose();
        }}
      >
        <div className="field">
          <label htmlFor="pin-set">{t("lock.pin")}</label>
          <PinInput id="pin-set" value={pin} onChange={setPin} />
          <span className="hint">{t("lock.pinHint")}</span>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn secondary" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button className="btn" disabled={!PIN_RE.test(pin)}>
            <Icon name="lock" size={16} /> {t("lock.lockNow")}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/** Di depan pintu ruangan terkunci: masukkan PIN, atau ketuk dan tunggu dibukakan. */
export function DoorPrompt({
  room,
  zone,
  masterName,
  onEnter,
  onClose,
  onKnocked,
}: {
  room: RoomClient;
  zone: Zone;
  masterName: string;
  onEnter: () => void;
  onClose: () => void;
  onKnocked: () => void;
}) {
  const t = useT();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  useEffect(
    () =>
      room.on("pinResult", (r) => {
        if (r.zoneId !== zone.id) return;
        if (r.ok) onEnter();
        else {
          setError(t("lock.wrongPin"));
          setPin("");
        }
      }),
    [room, zone.id, onEnter, t],
  );
  return (
    <Modal
      title={t("lock.lockedTitle", { zone: t(zone.label) })}
      sub={t("lock.lockedSub", { name: masterName })}
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (PIN_RE.test(pin)) room.send({ t: "zonePin", zoneId: zone.id, pin });
        }}
      >
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
        <div className="field">
          <label htmlFor="pin-enter">{t("lock.pin")}</label>
          <PinInput id="pin-enter" value={pin} onChange={setPin} />
        </div>
        <div className="modal-actions">
          <button type="button" className="btn secondary" onClick={onKnocked}>
            <Icon name="knock" size={16} /> {t("knock.knock")}
          </button>
          <span className="spacer" />
          <button className="btn" disabled={!PIN_RE.test(pin)}>
            {t("lock.enter")}
          </button>
        </div>
      </form>
    </Modal>
  );
}
