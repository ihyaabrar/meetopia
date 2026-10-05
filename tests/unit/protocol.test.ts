import { describe, expect, it } from "vitest";
import { clientMessageSchema } from "@/shared/protocol";
import { OFFICE_TEMPLATE, TEMPLATE_REVS } from "@/shared/templates";

describe("protokol emote", () => {
  it("menerima emote yang tersedia dan menolak yang lain", () => {
    expect(clientMessageSchema.safeParse({ t: "emote", emoji: "👋" }).success).toBe(true);
    expect(clientMessageSchema.safeParse({ t: "emote", emoji: "<script>" }).success).toBe(false);
  });
});

describe("template peta", () => {
  it("menandai revisi template agar grup lama ikut diperbarui", () => {
    expect(OFFICE_TEMPLATE.templateRev).toBe(TEMPLATE_REVS.office);
  });
  it("id objek unik", () => {
    const ids = OFFICE_TEMPLATE.objects.map((o) => o.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
