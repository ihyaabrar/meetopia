"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Icon } from "./Icon";

export interface DropdownItem<V extends string> {
  value: V;
  label: string;
  /** Elemen kecil di depan label (titik status, ikon). */
  lead?: React.ReactNode;
}

/**
 * Menu pilihan bertema (pengganti <select> bawaan yang popup-nya tidak bisa diberi gaya).
 * Bisa dipakai dengan keyboard: panah atas/bawah, Enter, Escape.
 */
export function Dropdown<V extends string>({
  label,
  value,
  items,
  onChange,
  trigger,
  placement = "up",
  className = "",
}: {
  /** Nama untuk pembaca layar. */
  label: string;
  value: V | null;
  items: DropdownItem<V>[];
  onChange: (v: V) => void;
  /** Isi tombol; bawaan: lead + label item terpilih. */
  trigger?: React.ReactNode;
  placement?: "up" | "down";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const id = useId();
  const current = items.find((i) => i.value === value);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener("pointerdown", onDown);
    listRef.current?.focus();
    return () => window.removeEventListener("pointerdown", onDown);
  }, [open]);

  const choose = (v: V) => {
    setOpen(false);
    onChange(v);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      setOpen(false);
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (items[active]) choose(items[active].value);
    }
  };

  return (
    <div className={`dropdown ${className}`} ref={ref}>
      <button
        type="button"
        className="dropdown-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={id}
        aria-label={label}
        title={label}
        onClick={() => {
          setActive(
            Math.max(
              0,
              items.findIndex((i) => i.value === value),
            ),
          );
          setOpen((o) => !o);
        }}
      >
        {trigger ?? (
          <>
            {current?.lead}
            <span className="dropdown-value">{current?.label ?? label}</span>
          </>
        )}
        <Icon name="chevron" size={14} />
      </button>
      {open && (
        <ul
          id={id}
          ref={listRef}
          className={`dropdown-menu ${placement}`}
          role="listbox"
          aria-label={label}
          tabIndex={-1}
          aria-activedescendant={`${id}-${active}`}
          onKeyDown={onKey}
        >
          {items.map((it, i) => (
            <li
              key={it.value}
              id={`${id}-${i}`}
              role="option"
              aria-selected={it.value === value}
              data-active={i === active}
              onPointerEnter={() => setActive(i)}
              onClick={() => choose(it.value)}
            >
              {it.lead}
              <span className="grow">{it.label}</span>
              {it.value === value && <Icon name="check" size={14} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
