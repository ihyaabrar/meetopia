import { ok, route, parseBody, requirePermission, ApiError } from "@/server/api";
import { getMap } from "@/server/repo";
import { sql } from "@/server/db";
import { mapEditSchema, objectPlacementError, layoutError, resizeMap } from "@/shared/map-edit";
import { DEFAULT_APPEARANCE } from "@/shared/map";
import { buildTemplate, templateOf } from "@/shared/templates";
import { publishToRoom } from "@/realtime/bus";
type Ctx = { params: Promise<{ groupId: string }> };
export const GET = route<Ctx>(async (_req, { params }) => {
  const { groupId } = await params;
  await requirePermission(groupId, "enterRoom");
  return ok({ map: await getMap(groupId) });
});
export const PATCH = route<Ctx>(async (req, { params }) => {
  const { groupId } = await params;
  await requirePermission(groupId, "manageGroup");
  const body = await parseBody(req, mapEditSchema),
    current = await getMap(groupId);
  if (current.version !== body.expectedVersion) throw new ApiError(409, "mapConflict");
  const appearance = body.appearance ?? current.appearance ?? DEFAULT_APPEARANCE;
  let next = { ...current, appearance, version: current.version + 1 };
  if (appearance.roomSize !== (current.appearance ?? DEFAULT_APPEARANCE).roomSize) {
    try {
      next = {
        ...resizeMap(buildTemplate(templateOf(current)), appearance.roomSize),
        audio: current.audio,
        appearance,
        version: next.version,
      };
    } catch {
      throw new ApiError(400, "badRequest");
    }
  }
  if (body.objects) {
    next = { ...next, objects: body.objects, customLayout: true };
    // Existing decorative placement is tolerated, but new/changed furniture is validated strictly.
    for (const obj of next.objects)
      if (
        JSON.stringify(obj) !== JSON.stringify(current.objects.find((o) => o.id === obj.id)) &&
        objectPlacementError(next, obj)
      )
        throw new ApiError(400, "badRequest");
    if (layoutError(next)) throw new ApiError(400, "badRequest");
  }
  const changed = await sql(
    "UPDATE maps SET data = $2, version = $3, updated_at = now() WHERE group_id = $1 AND version = $4 RETURNING id",
    [groupId, JSON.stringify(next), next.version, body.expectedVersion],
  );
  if (!changed.length) throw new ApiError(409, "mapConflict");
  await publishToRoom(groupId, { control: { kind: "map", map: next } });
  return ok({ map: next });
});
