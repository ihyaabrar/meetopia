/**
 * Server real-time mandiri (cadangan di bagian 7 PRD), untuk dijalankan di host Node mana pun
 * (Railway, Fly.io, Render, VPS) saat aplikasi web dideploy di Vercel.
 * Butuh DATABASE_URL, REDIS_URL, dan AUTH_SECRET yang sama dengan aplikasi web.
 */
import { createServer } from "node:http";
import { getHub } from "./hub";
import { getDb } from "@/server/db";

const port = Number(process.env.PORT ?? 3001);
await getDb();
const hub = getHub();
const server = createServer((req, res) => {
  res.writeHead(req.url === "/health" ? 200 : 404, { "content-type": "text/plain" });
  res.end(req.url === "/health" ? "ok" : "not found");
});
server.on("upgrade", (req, socket, head) => {
  if (req.url?.startsWith("/ws")) hub.handleUpgrade(req, socket, head);
  else socket.destroy();
});
server.listen(port, () => console.log(`> Server real-time di ws://localhost:${port}/ws`));
