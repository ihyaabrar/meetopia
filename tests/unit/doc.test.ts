import { describe, expect, it } from "vitest";
import { applyShortcut, docToText, parseDoc, serializeDoc, todoProgress } from "@/shared/doc";

describe("dokumen catatan berbasis blok", () => {
  it("mengubah catatan teks lama menjadi blok", () => {
    const doc = parseDoc("# Rapat\n- poin satu\n[ ] tugas\n[x] selesai\nbiasa");
    expect(doc.blocks.map((b) => b.type)).toEqual(["h1", "bullet", "todo", "todo", "p"]);
    expect(doc.blocks[2].checked).toBe(false);
    expect(doc.blocks[3].checked).toBe(true);
    expect(doc.blocks[0].text).toBe("Rapat");
  });

  it("bolak-balik JSON tanpa kehilangan isi", () => {
    const doc = parseDoc("## Judul\n1. satu\n1. dua\n> kutip\n---");
    const again = parseDoc(serializeDoc(doc));
    expect(again).toEqual(doc);
    expect(docToText(again)).toBe("## Judul\n1. satu\n2. dua\n> kutip\n---");
  });

  it("pintasan markdown di awal blok", () => {
    expect(applyShortcut("# x")).toEqual({ type: "h1", text: "x" });
    expect(applyShortcut("[] beli kopi")).toEqual({ type: "todo", text: "beli kopi", checked: false });
    expect(applyShortcut("- ")).toEqual({ type: "bullet", text: "" });
    expect(applyShortcut("---")).toEqual({ type: "divider", text: "" });
    expect(applyShortcut("halo")).toBeNull();
  });

  it("menolak isi aneh dan menghitung ceklis", () => {
    const doc = parseDoc(
      JSON.stringify({
        v: 1,
        blocks: [
          { type: "evil", text: 5 },
          { type: "todo", text: "a", checked: true },
        ],
      }),
    );
    expect(doc.blocks[0]).toMatchObject({ type: "p", text: "" });
    expect(todoProgress(doc)).toEqual({ done: 1, total: 1 });
    expect(parseDoc("").blocks).toHaveLength(1);
  });
});
