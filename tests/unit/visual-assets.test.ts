import { describe, it, expect } from "vitest";
import { ICON_PATHS } from "@/shared/icons";
import { zoneIcon } from "@/shared/zone-icons";
import { TEMPLATE_IDS, buildTemplate } from "@/shared/templates";
import { GET } from "@/app/favicon.ico/route";

describe("shared frontend visual assets", () => {
  it("serves the conventional favicon URL from the same canonical logo asset", () => {
    const response = GET();
    expect(response.status).toBe(307);
    expect(response.headers.get("Location")).toBe("/icon.svg");
  });
  it("uses known semantic symbols for all official map areas", () => {
    const symbols = new Set<string>();
    for (const id of TEMPLATE_IDS)
      for (const zone of buildTemplate(id).zones) {
        const icon = zoneIcon(zone.label);
        symbols.add(icon);
        expect(ICON_PATHS[icon]).toBeTruthy();
      }
    expect(symbols.size).toBeGreaterThan(10);
  });
  it("has a safe fallback for custom labels", () => expect(zoneIcon("Custom user room")).toBe("door"));
  it("distinguishes work, rest, meeting and games without relying on locale", () => {
    expect(zoneIcon("zone.work")).toBe("monitor");
    expect(zoneIcon("zone.lounge")).toBe("sofa");
    expect(zoneIcon("zone.meeting")).toBe("users");
    expect(zoneIcon("zone.pcGaming")).toBe("controller");
  });
});
