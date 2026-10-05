/**
 * Sesi berbasis cookie berisi JWT yang ditandatangani (jose). Kata sandi di-hash dengan bcrypt.
 * `session_version` di tabel users memungkinkan semua sesi dicabut (mis. setelah reset kata sandi).
 */
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { authSecret, emailVerificationEnabled } from "./env";
import { one } from "./db";
import type { AvatarConfig } from "@/shared/avatar";

export const SESSION_COOKIE = "mt_session";
const SESSION_DAYS = 30;

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  avatar: AvatarConfig;
  locale: string;
  highContrast: boolean;
  emailVerified: boolean;
  /** Apakah fitur verifikasi email aktif; bila tidak, UI tidak menampilkan apa pun soal verifikasi. */
  emailVerification: boolean;
}

export const hashPassword = (pw: string) => bcrypt.hash(pw, 10);
export const verifyPassword = (pw: string, hash: string) => bcrypt.compare(pw, hash);

export async function createSessionToken(userId: string, version: number): Promise<string> {
  return new SignJWT({ v: version })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setAudience("session")
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(authSecret());
}

export async function setSessionCookie(userId: string, version: number) {
  const token = await createSessionToken(userId, version);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 3600,
  });
}

export async function clearSessionCookie() {
  (await cookies()).delete(SESSION_COOKIE);
}

interface UserRow {
  id: string;
  email: string;
  name: string;
  avatar: AvatarConfig;
  locale: string;
  high_contrast: boolean;
  email_verified_at: string | null;
  session_version: number;
}

export function toSessionUser(r: UserRow): SessionUser {
  return {
    id: r.id,
    email: r.email,
    name: r.name,
    avatar: r.avatar,
    locale: r.locale,
    highContrast: r.high_contrast,
    emailVerified: !!r.email_verified_at,
    emailVerification: emailVerificationEnabled(),
  };
}

export async function userFromSessionToken(token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, authSecret(), { audience: "session" });
    const row = await one<UserRow>("SELECT * FROM users WHERE id = $1", [payload.sub]);
    if (!row || row.session_version !== payload.v) return null;
    return toSessionUser(row);
  } catch {
    return null;
  }
}

export async function getSessionUser(): Promise<SessionUser | null> {
  return userFromSessionToken((await cookies()).get(SESSION_COOKIE)?.value);
}
