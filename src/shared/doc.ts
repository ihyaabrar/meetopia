/**
 * Dokumen catatan berbasis blok (gaya Notion): paragraf, judul, ceklis, daftar, kutipan, callout,
 * kode, dan garis pemisah. Disimpan sebagai JSON di kolom `notes.content`; catatan lama berupa teks
 * biasa otomatis diubah menjadi blok saat dibuka.
 */
export const BLOCK_TYPES = [
  "p",
  "h1",
  "h2",
  "h3",
  "todo",
  "bullet",
  "number",
  "quote",
  "callout",
  "code",
  "divider",
] as const;
export type BlockType = (typeof BLOCK_TYPES)[number];

export interface Block {
  id: string;
  type: BlockType;
  text: string;
  checked?: boolean;
}

export interface Doc {
  v: 1;
  blocks: Block[];
}

export const MAX_BLOCKS = 2000;

let counter = 0;
export function blockId(): string {
  counter = (counter + 1) % 1e6;
  return `${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export const newBlock = (type: BlockType = "p", text = "", checked?: boolean): Block => ({
  id: blockId(),
  type,
  text,
  ...(type === "todo" ? { checked: !!checked } : {}),
});

export const emptyDoc = (): Doc => ({ v: 1, blocks: [newBlock()] });

/** Pintasan ala markdown di awal blok, mis. "# " jadi judul, "[] " jadi ceklis. */
export function applyShortcut(text: string): { type: BlockType; text: string; checked?: boolean } | null {
  const rules: Array<[RegExp, BlockType, boolean?]> = [
    [/^### /, "h3"],
    [/^## /, "h2"],
    [/^# /, "h1"],
    [/^\[[xX]\] /, "todo", true],
    [/^\[ ?\] /, "todo", false],
    [/^- \[[xX]\] /, "todo", true],
    [/^- \[ ?\] /, "todo", false],
    [/^[-*] /, "bullet"],
    [/^1[.)] /, "number"],
    [/^> /, "quote"],
    [/^! /, "callout"],
    [/^```/, "code"],
  ];
  if (/^(---|\*\*\*)$/.test(text)) return { type: "divider", text: "" };
  for (const [re, type, checked] of rules) {
    const m = text.match(re);
    if (m) return { type, text: text.slice(m[0].length), ...(type === "todo" ? { checked } : {}) };
  }
  return null;
}

function sanitize(raw: unknown): Doc | null {
  if (typeof raw !== "object" || raw === null) return null;
  const d = raw as { v?: unknown; blocks?: unknown };
  if (d.v !== 1 || !Array.isArray(d.blocks)) return null;
  const blocks: Block[] = [];
  for (const b of d.blocks.slice(0, MAX_BLOCKS)) {
    if (typeof b !== "object" || b === null) continue;
    const x = b as Partial<Block>;
    const type = (BLOCK_TYPES as readonly string[]).includes(x.type as string) ? (x.type as BlockType) : "p";
    blocks.push({
      id: typeof x.id === "string" && x.id ? x.id.slice(0, 40) : blockId(),
      type,
      text: typeof x.text === "string" ? x.text.slice(0, 20_000) : "",
      ...(type === "todo" ? { checked: !!x.checked } : {}),
    });
  }
  return { v: 1, blocks: blocks.length ? blocks : [newBlock()] };
}

/** Membaca isi catatan: JSON dokumen, atau teks lama yang diubah menjadi blok per baris. */
export function parseDoc(content: string): Doc {
  const trimmed = content.trim();
  if (trimmed.startsWith("{")) {
    try {
      const doc = sanitize(JSON.parse(trimmed));
      if (doc) return doc;
    } catch {}
  }
  if (!trimmed) return emptyDoc();
  const blocks = content.split("\n").map((line) => {
    const s = applyShortcut(line);
    return s ? newBlock(s.type, s.text, s.checked) : newBlock("p", line);
  });
  return { v: 1, blocks };
}

export const serializeDoc = (doc: Doc): string => JSON.stringify(doc);

/** Teks biasa (untuk pratinjau, ekspor, dan pencarian). */
export function docToText(doc: Doc): string {
  let n = 0;
  return doc.blocks
    .map((b) => {
      n = b.type === "number" ? n + 1 : 0;
      switch (b.type) {
        case "h1":
          return `# ${b.text}`;
        case "h2":
          return `## ${b.text}`;
        case "h3":
          return `### ${b.text}`;
        case "todo":
          return `[${b.checked ? "x" : " "}] ${b.text}`;
        case "bullet":
          return `- ${b.text}`;
        case "number":
          return `${n}. ${b.text}`;
        case "quote":
          return `> ${b.text}`;
        case "divider":
          return "---";
        default:
          return b.text;
      }
    })
    .join("\n");
}

/** Jumlah ceklis selesai / total, untuk ringkasan. */
export function todoProgress(doc: Doc): { done: number; total: number } {
  const todos = doc.blocks.filter((b) => b.type === "todo");
  return { done: todos.filter((b) => b.checked).length, total: todos.length };
}
