"use client";

import { useT } from "@/i18n/client";
import { Modal } from "@/components/Modal";

/** Onboarding singkat: tiga petunjuk interaktif (bagian 10 PRD). */
export function Tips({ onClose }: { onClose: () => void }) {
  const t = useT();
  return (
    <Modal title={t("tips.title")} sub={t("tips.sub")} onClose={onClose}>
      <div className="tips">
        {[1, 2, 3].map((n) => (
          <div className="tip" key={n}>
            <span className="num">{n}</span>
            <div>
              <b>{t(`tips.${n}.title`)}</b>
              <div className="hint">{t(`tips.${n}.body`)}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="modal-actions">
        <button className="btn" onClick={onClose}>
          {t("tips.ok")}
        </button>
      </div>
    </Modal>
  );
}
