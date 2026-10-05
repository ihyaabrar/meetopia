import { SignJWT, jwtVerify } from "jose";
import { authSecret } from "./env";

/** Token singkat untuk membuka WebSocket ke ruangan grup. Diterbitkan setelah cek keanggotaan. */
export async function createRealtimeToken(userId: string, groupId: string): Promise<string> {
  return new SignJWT({ gid: groupId })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setAudience("realtime")
    .setIssuedAt()
    .setExpirationTime("2m")
    .sign(authSecret());
}

export async function verifyRealtimeToken(
  token: string,
): Promise<{ userId: string; groupId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, authSecret(), { audience: "realtime" });
    if (typeof payload.sub !== "string" || typeof payload.gid !== "string") return null;
    return { userId: payload.sub, groupId: payload.gid };
  } catch {
    return null;
  }
}
