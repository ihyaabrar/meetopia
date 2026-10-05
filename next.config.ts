import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Paket ini dijalankan di Node (bukan dibundel) karena memakai modul native / WASM.
  serverExternalPackages: ["@electric-sql/pglite", "pg", "ioredis", "ws", "bcryptjs", "nodemailer"],
};

export default nextConfig;
