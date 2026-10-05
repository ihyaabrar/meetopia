import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { messages, translate } from "@/i18n";
import { OFFICE_TEMPLATE } from "@/shared/map";

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    return statSync(p).isDirectory() ? sourceFiles(p) : /\.tsx?$/.test(p) ? [p] : [];
  });
}

describe("terjemahan", () => {
  it("bahasa Indonesia dan Inggris punya kunci yang sama", () => {
    expect(Object.keys(messages.en).sort()).toEqual(Object.keys(messages.id).sort());
  });

  it("setiap kunci statis di kode ada di berkas terjemahan", () => {
    const missing: string[] = [];
    for (const file of sourceFiles(path.resolve(import.meta.dirname, "../../src"))) {
      const src = readFileSync(file, "utf8");
      for (const m of src.matchAll(/\bt\(\s*"([a-zA-Z0-9_.]+)"/g))
        if (!(m[1] in messages.id)) missing.push(`${m[1]} (${file})`);
    }
    for (const o of OFFICE_TEMPLATE.objects) if (o.label && !(o.label in messages.id)) missing.push(o.label);
    for (const z of OFFICE_TEMPLATE.zones) if (!(z.label in messages.id)) missing.push(z.label);
    expect(missing).toEqual([]);
  });

  it("mengganti variabel", () => {
    expect(translate("id", "nav.inRoom", { n: 3 })).toBe("3 orang di ruangan");
    expect(translate("en", "nav.inRoom", { n: 3 })).toBe("3 in the room");
  });
});
