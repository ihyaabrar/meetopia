import { ok, requirePermission, route } from "@/server/api";
import { createRealtimeToken } from "@/server/tokens";
import { ConfigError, onVercel } from "@/server/env";

/** Token singkat untuk membuka WebSocket ruangan; hanya untuk anggota grup. */
export const POST = route<{ params: Promise<{ groupId: string }> }>(async (_req, { params }) => {
  const { groupId } = await params;
  const { user } = await requirePermission(groupId, "enterRoom");
  // Di Vercel tiap koneksi bisa jatuh ke instance berbeda; tanpa Redis mereka tidak saling melihat.
  if (onVercel && !process.env.REDIS_URL && !process.env.NEXT_PUBLIC_REALTIME_URL)
    throw new ConfigError("realtimeNotConfigured");
  // Vercel: endpoint fungsi /api/ws. Server Node (server.ts / standalone): /ws, karena server dev
  // Next.js ikut menangani upgrade di bawah /api dan memutusnya.
  return ok({ token: await createRealtimeToken(user.id, groupId), wsPath: onVercel ? "/api/ws" : "/ws" });
});
