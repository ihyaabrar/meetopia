/**
 * Endpoint WebSocket di Vercel Functions (M2). Lokal, permintaan upgrade ke /api/ws ditangani
 * server.ts sebelum sampai ke sini. Koneksi ditutup Vercel saat durasi maksimum tercapai;
 * klien menyambung ulang otomatis dan posisinya dipulihkan dari Redis.
 */
import { experimental_upgradeWebSocket } from "@vercel/functions";
import { getHub } from "@/realtime/hub";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: Request) {
  if (req.headers.get("upgrade")?.toLowerCase() !== "websocket") {
    return new Response("Endpoint ini hanya menerima koneksi WebSocket.", { status: 426 });
  }
  const url = new URL(req.url);
  return experimental_upgradeWebSocket((ws) => getHub().accept(ws, url.pathname + url.search), {
    maxPayload: 64 * 1024,
  });
}
