/**
 * Server lokal / self-host: Next.js + WebSocket real-time di satu proses dan satu port.
 * Untuk Vercel: aplikasi Next dideploy biasa, server real-time dijalankan terpisah
 * (`npm run start:realtime`) dan alamatnya diisi di NEXT_PUBLIC_REALTIME_URL. Lihat README.
 */
import { createServer } from "node:http";
import next from "next";
import { getHub } from "./src/realtime/hub";
import { getDb } from "./src/server/db";

const dev = process.env.NODE_ENV !== "production";
const port = Number(process.env.PORT ?? 3000);
const app = next({ dev, port });
const handle = app.getRequestHandler();

await app.prepare();
await getDb();
const hub = getHub();
const nextUpgrade = app.getUpgradeHandler();

const server = createServer((req, res) => void handle(req, res));
server.on("upgrade", (req, socket, head) => {
  if (req.url?.startsWith("/ws")) hub.handleUpgrade(req, socket, head);
  else void nextUpgrade(req, socket, head);
});

server.listen(port, () => console.log(`> Meetopia siap di http://localhost:${port}`));

const shutdown = async () => {
  await hub.close();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
