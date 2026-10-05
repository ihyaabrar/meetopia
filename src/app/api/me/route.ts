import { z } from "zod";
import { sql } from "@/server/db";
import { ApiError, ok, parseBody, requireUser, route } from "@/server/api";
import { clearSessionCookie, verifyPassword } from "@/server/auth";
import { listGroups } from "@/server/repo";
import { publishToRoom } from "@/realtime/bus";
import { sanitizeAvatar } from "@/shared/avatar";
import { LOCALES } from "@/i18n";
import { one } from "@/server/db";

export const GET = route(async () => {
  const user = await requireUser();
  return ok({ user, groups: await listGroups(user.id) });
});

const patchSchema = z.object({
  name: z.string().trim().min(1).max(40).optional(),
  avatar: z.unknown().optional(),
  locale: z.enum(LOCALES).optional(),
  highContrast: z.boolean().optional(),
});

export const PATCH = route(async (req) => {
  const user = await requireUser();
  const body = await parseBody(req, patchSchema);
  const name = body.name ?? user.name;
  const avatar = body.avatar !== undefined ? sanitizeAvatar(body.avatar) : user.avatar;
  await sql("UPDATE users SET name = $2, avatar = $3, locale = $4, high_contrast = $5 WHERE id = $1", [
    user.id,
    name,
    JSON.stringify(avatar),
    body.locale ?? user.locale,
    body.highContrast ?? user.highContrast,
  ]);
  // FR-11: perubahan avatar terlihat semua orang di setiap ruangan dalam 1 detik.
  if (body.name !== undefined || body.avatar !== undefined) {
    for (const g of await listGroups(user.id)) {
      await publishToRoom(g.id, { control: { kind: "profile", userId: user.id, name, avatar } });
    }
  }
  return ok({
    user: {
      ...user,
      name,
      avatar,
      locale: body.locale ?? user.locale,
      highContrast: body.highContrast ?? user.highContrast,
    },
  });
});

/** Hapus akun dan datanya (bagian 11 PRD). Pemilik grup harus memindahkan/menghapus grupnya dulu. */
export const DELETE = route(async (req) => {
  const user = await requireUser();
  const { password } = await parseBody(req, z.object({ password: z.string().max(200) }));
  const row = await one<{ password_hash: string }>("SELECT password_hash FROM users WHERE id = $1", [
    user.id,
  ]);
  if (!row || !(await verifyPassword(password, row.password_hash)))
    throw new ApiError(401, "invalidCredentials");
  const owned = await sql("SELECT 1 FROM groups WHERE owner_id = $1", [user.id]);
  if (owned.length) throw new ApiError(409, "ownsGroups");
  await sql("DELETE FROM users WHERE id = $1", [user.id]);
  await clearSessionCookie();
  return ok({ ok: true });
});
