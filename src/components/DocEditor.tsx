"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { useT } from "@/i18n/client";
import { Icon, type IconName } from "./Icon";
import {
  BLOCK_TYPES,
  MAX_BLOCKS,
  applyShortcut,
  newBlock,
  type Block,
  type BlockType,
  type Doc,
} from "@/shared/doc";

const TYPE_ICON: Record<BlockType, IconName> = {
  p: "edit",
  h1: "hash",
  h2: "hash",
  h3: "hash",
  todo: "check",
  bullet: "menu",
  number: "menu",
  quote: "chat",
  callout: "alert",
  code: "code",
  divider: "more",
};

/** Jenis yang berlanjut saat menekan Enter (seperti daftar di Notion). */
const CONTINUES: BlockType[] = ["todo", "bullet", "number"];

type Focus = { id: string; at: number | "end" };

/**
 * Editor dokumen berbasis blok (gaya Notion). Pintasan: "# " judul, "- " daftar, "1. " bernomor,
 * "[] " ceklis, "> " kutipan, "! " callout, "```" kode, "---" pemisah, "/" untuk memilih jenis.
 */
export function DocEditor({
  doc,
  onChange,
  readOnly = false,
  onToggleTodo,
  label,
}: {
  doc: Doc;
  onChange?: (doc: Doc) => void;
  readOnly?: boolean;
  /** Mode baca: ceklis tetap bisa dicentang. */
  onToggleTodo?: (id: string) => void;
  label: string;
}) {
  const t = useT();
  const root = useRef<HTMLDivElement>(null);
  const pending = useRef<Focus | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [slashActive, setSlashActive] = useState(0);
  const [focused, setFocused] = useState<string | null>(null);
  const blocks = doc.blocks;

  const focusNow = (f: Focus) => {
    const el = root.current?.querySelector<HTMLTextAreaElement>(`[data-block="${f.id}"] textarea`);
    if (!el) return;
    el.focus();
    const pos = f.at === "end" ? el.value.length : f.at;
    el.setSelectionRange(pos, pos);
  };
  // Pindahkan fokus/kursor setelah blok ditambah, digabung, atau diubah jenisnya.
  useLayoutEffect(() => {
    const f = pending.current;
    if (!f) return;
    pending.current = null;
    focusNow(f);
  });

  const commit = (next: Block[], focus?: Focus) => {
    if (focus) pending.current = focus;
    onChange?.({ v: 1, blocks: next.length ? next : [newBlock()] });
  };
  const update = (id: string, patch: Partial<Block>, focus?: Focus) =>
    commit(
      blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)),
      focus,
    );
  const insertAfter = (id: string, block: Block, focus = true) => {
    if (blocks.length >= MAX_BLOCKS) return;
    const i = blocks.findIndex((b) => b.id === id);
    const next = [...blocks];
    next.splice(i + 1, 0, block);
    commit(next, focus ? { id: block.id, at: 0 } : undefined);
  };
  const setType = (b: Block, type: BlockType) => {
    setMenuFor(null);
    if (type === "divider") {
      const after = newBlock();
      const i = blocks.findIndex((x) => x.id === b.id);
      const next = [...blocks];
      next.splice(i, 1, { id: b.id, type: "divider", text: "" }, after);
      return commit(next, { id: after.id, at: 0 });
    }
    update(
      b.id,
      {
        type,
        text: b.text.startsWith("/") ? "" : b.text,
        checked: type === "todo" ? !!b.checked : undefined,
      },
      { id: b.id, at: "end" },
    );
  };
  const remove = (id: string) => {
    setMenuFor(null);
    const i = blocks.findIndex((b) => b.id === id);
    const prev = blocks[i - 1];
    commit(
      blocks.filter((b) => b.id !== id),
      prev ? { id: prev.id, at: "end" } : undefined,
    );
  };
  const duplicate = (b: Block) => {
    setMenuFor(null);
    insertAfter(b.id, { ...b, id: newBlock().id });
  };

  const typeLabel = (type: BlockType) => t(`doc.type.${type}`);
  const slashQuery = (b: Block) => (b.text.startsWith("/") ? b.text.slice(1).toLowerCase() : null);
  const slashMatches = (q: string) =>
    BLOCK_TYPES.filter((ty) => typeLabel(ty).toLowerCase().includes(q) || ty.includes(q));

  const onText = (b: Block, value: string) => {
    if (b.type !== "code") {
      const s = applyShortcut(value);
      if (s) {
        if (s.type === "divider") return setType({ ...b, text: "" }, "divider");
        return update(b.id, { type: s.type, text: s.text, checked: s.checked }, { id: b.id, at: 0 });
      }
    }
    if (value.startsWith("/")) setSlashActive(0);
    update(b.id, { text: value });
  };

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>, b: Block, i: number) => {
    if (e.nativeEvent.isComposing) return;
    const el = e.currentTarget;
    const q = slashQuery(b);
    if (q !== null) {
      const matches = slashMatches(q);
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const n = Math.max(1, matches.length);
        setSlashActive((a) => (a + (e.key === "ArrowDown" ? 1 : -1) + n) % n);
        return;
      }
      if (e.key === "Enter" && matches.length) {
        e.preventDefault();
        return setType(b, matches[Math.min(slashActive, matches.length - 1)]);
      }
      if (e.key === "Escape") {
        e.preventDefault();
        return update(b.id, { text: "" });
      }
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    if (e.key === "Enter" && !e.shiftKey && !(b.type === "code" && !e.ctrlKey && !e.metaKey)) {
      e.preventDefault();
      // Enter pada daftar kosong: keluar dari daftar.
      if (!b.text && b.type !== "p")
        return update(b.id, { type: "p", checked: undefined }, { id: b.id, at: 0 });
      const before = b.text.slice(0, start);
      const after = b.text.slice(end);
      const type = CONTINUES.includes(b.type) ? b.type : "p";
      const nb = newBlock(type, after);
      const next = blocks.map((x) => (x.id === b.id ? { ...x, text: before } : x));
      next.splice(i + 1, 0, nb);
      return commit(next, { id: nb.id, at: 0 });
    }
    if (e.key === "Backspace" && start === 0 && end === 0) {
      if (b.type !== "p") {
        e.preventDefault();
        return update(b.id, { type: "p", checked: undefined }, { id: b.id, at: 0 });
      }
      const prev = blocks[i - 1];
      if (!prev) return;
      e.preventDefault();
      if (prev.type === "divider")
        return commit(
          blocks.filter((x) => x.id !== prev.id),
          { id: b.id, at: 0 },
        );
      const joinAt = prev.text.length;
      const next = blocks
        .filter((x) => x.id !== b.id)
        .map((x) => (x.id === prev.id ? { ...x, text: x.text + b.text } : x));
      return commit(next, { id: prev.id, at: joinAt });
    }
    if (e.key === "ArrowUp" && start === 0 && end === 0 && i > 0) {
      e.preventDefault();
      return focusNow({ id: findText(i, -1), at: "end" });
    }
    if (e.key === "ArrowDown" && start === b.text.length && i < blocks.length - 1) {
      e.preventDefault();
      return focusNow({ id: findText(i, 1), at: 0 });
    }
  };
  /** Blok bertek terdekat ke atas/bawah (melewati pemisah). */
  const findText = (i: number, dir: 1 | -1) => {
    for (let j = i + dir; j >= 0 && j < blocks.length; j += dir)
      if (blocks[j].type !== "divider") return blocks[j].id;
    return blocks[i].id;
  };

  // Nomor urut untuk blok bernomor (berurutan sampai disela blok lain).
  const numbers = blocks.reduce<number[]>((acc, b, i) => {
    acc.push(b.type === "number" ? (blocks[i - 1]?.type === "number" ? acc[i - 1] + 1 : 1) : 0);
    return acc;
  }, []);
  return (
    <div className={`doc ${readOnly ? "readonly" : ""}`} ref={root} role="group" aria-label={label}>
      {blocks.map((b, i) => {
        const q = !readOnly && focused === b.id ? slashQuery(b) : null;
        const matches = q !== null ? slashMatches(q) : [];
        return (
          <div key={b.id} className={`blk blk-${b.type} ${b.checked ? "done" : ""}`} data-block={b.id}>
            {!readOnly && (
              <div className="blk-handle">
                <button
                  type="button"
                  className="blk-btn"
                  onClick={() => insertAfter(b.id, newBlock())}
                  aria-label={t("doc.addBelow")}
                  title={t("doc.addBelow")}
                  tabIndex={-1}
                >
                  <Icon name="plus" size={14} />
                </button>
                <button
                  type="button"
                  className="blk-btn"
                  onClick={() => setMenuFor((m) => (m === b.id ? null : b.id))}
                  aria-label={t("doc.blockMenu")}
                  title={t("doc.blockMenu")}
                  aria-expanded={menuFor === b.id}
                >
                  <Icon name="more" size={14} />
                </button>
              </div>
            )}
            {b.type === "todo" && (
              <input
                type="checkbox"
                className="blk-check"
                checked={!!b.checked}
                disabled={readOnly && !onToggleTodo}
                aria-label={b.text || t("doc.type.todo")}
                onChange={() => (readOnly ? onToggleTodo?.(b.id) : update(b.id, { checked: !b.checked }))}
              />
            )}
            {b.type === "bullet" && (
              <span className="blk-marker" aria-hidden>
                •
              </span>
            )}
            {b.type === "number" && (
              <span className="blk-marker num" aria-hidden>
                {numbers[i]}.
              </span>
            )}
            {b.type === "callout" && (
              <span className="blk-marker callout" aria-hidden>
                <Icon name="alert" size={16} />
              </span>
            )}
            {b.type === "divider" ? (
              <hr />
            ) : readOnly ? (
              <div className="blk-text">{b.text || " "}</div>
            ) : (
              <AutoText
                value={b.text}
                placeholder={
                  focused === b.id ? t(b.type === "p" ? "doc.placeholder" : `doc.type.${b.type}`) : ""
                }
                onChange={(v) => onText(b, v)}
                onKeyDown={(e) => onKey(e, b, i)}
                onFocus={() => setFocused(b.id)}
                label={typeLabel(b.type)}
              />
            )}
            {menuFor === b.id && !readOnly && (
              <div className="blk-menu-row">
                <div className="blk-menu" role="menu" aria-label={t("doc.blockMenu")}>
                  <div className="blk-menu-title">{t("doc.turnInto")}</div>
                  {BLOCK_TYPES.map((ty) => (
                    <button
                      key={ty}
                      role="menuitem"
                      aria-current={ty === b.type}
                      onClick={() => setType(b, ty)}
                    >
                      <Icon name={TYPE_ICON[ty]} size={14} /> {typeLabel(ty)}
                    </button>
                  ))}
                  <span className="blk-menu-sep" />
                  <button role="menuitem" onClick={() => duplicate(b)}>
                    <Icon name="copy" size={14} /> {t("doc.duplicate")}
                  </button>
                  <button role="menuitem" className="danger" onClick={() => remove(b.id)}>
                    <Icon name="trash" size={14} /> {t("doc.delete")}
                  </button>
                </div>
              </div>
            )}
            {q !== null && matches.length > 0 && (
              <div className="blk-menu-row">
                <div className="blk-menu slash" role="listbox" aria-label={t("doc.turnInto")}>
                  {matches.map((ty, k) => (
                    <button
                      key={ty}
                      role="option"
                      aria-selected={k === Math.min(slashActive, matches.length - 1)}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setType(b, ty);
                      }}
                    >
                      <Icon name={TYPE_ICON[ty]} size={14} /> {typeLabel(ty)}
                      <span className="hint">{t(`doc.hint.${ty}`)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Textarea satu blok yang tingginya mengikuti isi. */
function AutoText({
  value,
  placeholder,
  onChange,
  onKeyDown,
  onFocus,
  label,
}: {
  value: string;
  placeholder: string;
  onChange: (v: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onFocus: () => void;
  label: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      className="blk-text"
      rows={1}
      value={value}
      placeholder={placeholder}
      aria-label={label}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
    />
  );
}
