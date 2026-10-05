import { describe, expect, it } from "vitest";
import { can, canChangeRole } from "@/shared/roles";

describe("peran (FR-03)", () => {
  it("tamu hanya membaca kanal", () => {
    expect(can("guest", "enterRoom")).toBe(true);
    expect(can("guest", "sendChannelMessage")).toBe(false);
    expect(can("guest", "editSharedNote")).toBe(false);
  });
  it("hanya admin ke atas yang membuat undangan; hanya pemilik menghapus grup", () => {
    expect(can("member", "createInvite")).toBe(false);
    expect(can("admin", "createInvite")).toBe(true);
    expect(can("admin", "deleteGroup")).toBe(false);
    expect(can("owner", "deleteGroup")).toBe(true);
  });
  it("admin tidak bisa mengubah sesama admin atau menjadikan orang pemilik", () => {
    expect(canChangeRole("admin", "member", "guest")).toBe(true);
    expect(canChangeRole("admin", "admin", "member")).toBe(false);
    expect(canChangeRole("admin", "member", "admin")).toBe(false);
    expect(canChangeRole("owner", "member", "admin")).toBe(true);
    expect(canChangeRole("owner", "owner", "admin")).toBe(false);
    expect(canChangeRole("member", "guest", "member")).toBe(false);
  });
});
