import { z } from "zod";
import { ok, parseBody, requireUser, route } from "@/server/api";
import { getPrivateNote, savePrivateNote } from "@/server/repo";

/** Catatan pribadi (FR-66): hanya pemilik akun yang bisa membaca dan menulis. */
export const GET = route(async () => {
  const user = await requireUser();
  return ok({ note: await getPrivateNote(user.id) });
});

export const PUT = route(async (req) => {
  const user = await requireUser();
  const { content } = await parseBody(req, z.object({ content: z.string().max(50_000) }));
  return ok({ updatedAt: await savePrivateNote(user.id, content) });
});
