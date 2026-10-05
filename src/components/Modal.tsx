"use client";

import { useEffect, useRef } from "react";

/** Dialog modal yang bisa ditutup dengan Escape dan mengembalikan fokus (aksesibilitas). */
export function Modal({
  title,
  sub,
  onClose,
  children,
  wide,
  bare,
}: {
  title: string;
  sub?: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
  /** Tanpa judul bawaan dan tanpa padding (untuk kartu dengan tata letak sendiri). */
  bare?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const first = ref.current?.querySelector<HTMLElement>("input, select, textarea, button");
    first?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      prev?.focus();
    };
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={ref}
        className={`modal ${wide ? "wide" : ""} ${bare ? "bare" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        {!bare && <h2>{title}</h2>}
        {!bare && sub && <p className="sub">{sub}</p>}
        {children}
      </div>
    </div>
  );
}
