import type { NextConfig } from "next";

/**
 * Header keamanan untuk semua halaman dan API:
 * - frame-ancestors / X-Frame-Options: aplikasi tidak bisa dimuat di dalam iframe situs lain
 *   (mencegah clickjacking, mis. menjebak klik "hapus grup").
 * - nosniff, Referrer-Policy: header standar yang aman.
 * - Permissions-Policy: kamera & mikrofon hanya untuk aplikasi ini sendiri (bukan iframe YouTube),
 *   lokasi tidak dipakai sama sekali.
 */
const securityHeaders = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=()" },
];

const nextConfig: NextConfig = {
  // Paket ini dijalankan di Node (bukan dibundel) karena memakai modul native / WASM.
  serverExternalPackages: ["@electric-sql/pglite", "pg", "ioredis", "ws", "bcryptjs", "nodemailer"],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
