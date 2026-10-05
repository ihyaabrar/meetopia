import { z } from "zod";
import { sql } from "@/server/db";
import { ok, parseBody, requirePermission, route } from "@/server/api";
import { getGroup, getMap, listChannels, listMembers, updateMapAudio } from "@/server/repo";
import { notifyGroupChanged, publishToRoom } from "@/realtime/bus";
import { GROUP_COLOR_KEYS, GROUP_SYMBOLS, defaultGroupColor } from "@/shared/groupIcon";

type Ctx = { params: Promise<{ groupId: string }> };

export const GET = route<Ctx>(async (_req, { params }) => {
  const { groupId } = await params;
  const { role } = await requirePermission(groupId, "enterRoom");
  const [group, channels, members, map] = await Promise.all([
    getGroup(groupId),
    listChannels(groupId),
    listMembers(groupId),
    getMap(groupId),
  ]);
  return ok({
    group: {
      id: group!.id,
      name: group!.name,
      ownerId: group!.owner_id,
      recordingPolicy: group!.recording_policy,
      description: group!.description,
      iconColor: group!.icon_color ?? defaultGroupColor(group!.id),
      iconSymbol: group!.icon_symbol,
    },
    role,
    channels,
    members,
    audio: map.audio,
  });
});

const patchSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  description: z.string().trim().max(200).optional(),
  iconColor: z.enum(GROUP_COLOR_KEYS).optional(),
  iconSymbol: z.enum(GROUP_SYMBOLS).optional(),
  audio: z
    .object({
      fullVolumeRadius: z.number().min(0).max(10),
      radius: z.number().min(2).max(20),
      curve: z.number().min(0.3).max(4),
    })
    .refine((a) => a.fullVolumeRadius < a.radius)
    .optional(),
});

export const PATCH = route<Ctx>(async (req, { params }) => {
  const { groupId } = await params;
  await requirePermission(groupId, "manageGroup");
  const body = await parseBody(req, patchSchema);
  if (body.name) await sql("UPDATE groups SET name = $2 WHERE id = $1", [groupId, body.name]);
  if (body.description !== undefined)
    await sql("UPDATE groups SET description = $2 WHERE id = $1", [groupId, body.description]);
  if (body.iconColor) await sql("UPDATE groups SET icon_color = $2 WHERE id = $1", [groupId, body.iconColor]);
  if (body.iconSymbol)
    await sql("UPDATE groups SET icon_symbol = $2 WHERE id = $1", [groupId, body.iconSymbol]);
  if (body.audio) {
    const map = await updateMapAudio(groupId, body.audio);
    await publishToRoom(groupId, { control: { kind: "map", map } });
  }
  if (body.name || body.description !== undefined || body.iconColor || body.iconSymbol)
    await notifyGroupChanged(groupId);
  return ok({ ok: true });
});

export const DELETE = route<Ctx>(async (_req, { params }) => {
  const { groupId } = await params;
  await requirePermission(groupId, "deleteGroup");
  await publishToRoom(groupId, { control: { kind: "groupDeleted" } });
  await sql("DELETE FROM groups WHERE id = $1", [groupId]);
  return ok({ ok: true });
});
