/** Standalone SVG/asset previews request the conventional favicon URL automatically. */
export function GET() {
  return new Response(null, {
    status: 307,
    headers: { Location: "/icon.svg", "Cache-Control": "public, max-age=86400" },
  });
}
