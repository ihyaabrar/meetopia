"use client";

import { createContext, useCallback, useContext, useState } from "react";

export interface Toast {
  id: number;
  text: string;
  kind?: "info" | "error";
  action?: { label: string; run: () => void };
  secondary?: { label: string; run: () => void };
  sticky?: boolean;
}

const Ctx = createContext<(t: Omit<Toast, "id">) => () => void>(() => () => {});
let seq = 0;

/** Notifikasi singkat (hasil aksi objek, galat perangkat, ketukan, dll). */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const dismiss = useCallback((id: number) => setToasts((l) => l.filter((t) => t.id !== id)), []);
  const push = useCallback(
    (t: Omit<Toast, "id">) => {
      const id = ++seq;
      setToasts((l) => [...l.slice(-3), { ...t, id }]);
      if (!t.sticky) setTimeout(() => dismiss(id), t.action ? 9000 : 3500);
      return () => dismiss(id);
    },
    [dismiss],
  );
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind === "error" ? "error" : ""}`}>
            <span className="grow">{t.text}</span>
            {t.secondary && (
              <button className="btn small secondary" onClick={() => (t.secondary!.run(), dismiss(t.id))}>
                {t.secondary.label}
              </button>
            )}
            {t.action && (
              <button className="btn small" onClick={() => (t.action!.run(), dismiss(t.id))}>
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
