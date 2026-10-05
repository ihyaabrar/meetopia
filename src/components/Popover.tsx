"use client";

import { useEffect, useRef } from "react";

/** Panel melayang di bawah tombol pemicu; Escape atau klik di luar menutupnya. */
export function Popover({
  label,
  onClose,
  className = "",
  children,
}: {
  label: string;
  onClose: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    el?.querySelector<HTMLElement>("button, a, input")?.focus();
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      // Klik pada tombol pemicu ditangani pemicunya sendiri (toggle).
      if (el?.contains(target) || el?.parentElement?.contains(target)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);
  return (
    <div ref={ref} className={`popover ${className}`} role="dialog" aria-label={label}>
      {children}
    </div>
  );
}
