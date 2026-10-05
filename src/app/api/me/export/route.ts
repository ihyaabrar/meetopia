import { sql } from "@/server/db";
import { requireUser, route } from "@/server/api";
import { getPrivateNote, listGroups } from "@/server/repo";

/** Ekspor data pribadi pengguna sebagai JSON (bagian 11 PRD). */
export const GET = route(async () => {
  const user = await requireUser();
  const messages = await sql(
    "SELECT id, group_id, kind, channel_id, to_user_id, body, created_at FROM messages WHERE sender_id = $1",
    [user.id],
  );
  const data = {
    user,
    groups: await listGroups(user.id),
    privateNote: await getPrivateNote(user.id),
    messages,
  };
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "content-type": "application/json",
      "content-disposition": 'attachment; filename="meetopia-data.json"',
    },
  });
});
