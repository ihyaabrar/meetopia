import { NextResponse } from "next/server";
import { sql } from "@/server/db";
import { consumeEmailToken } from "@/server/emailTokens";
import { appUrl } from "@/server/env";

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  const userId = await consumeEmailToken(token, "verify");
  if (userId) await sql("UPDATE users SET email_verified_at = now() WHERE id = $1", [userId]);
  return NextResponse.redirect(`${appUrl(req)}/verified?ok=${userId ? 1 : 0}`);
}
