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
  const url = new URL(req.url);
  try {
    // Jangan memeriksa header Upgrade sendiri: browser bisa datang lewat HTTP/2 (tanpa header itu),
    // dan runtime Vercel yang tahu apakah permintaan ini bisa di-upgrade.
    return await experimental_upgradeWebSocket(
      (ws) =>
        // Janji ini baru selesai saat soket ditutup, supaya fungsi tidak dibekukan selama ada koneksi.
        new Promise<void>((resolve) => {
          ws.once("close", () => resolve());
          getHub().accept(ws, url.pathname + url.search);
        }),
      { maxPayload: 64 * 1024 },
    );
  } catch (e) {
    console.error("[ws] upgrade gagal:", (e as Error).message);
    return new Response("Endpoint ini hanya menerima koneksi WebSocket.", { status: 426 });
  }
}
