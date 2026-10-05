import crypto from "node:crypto";

export const newId = () => crypto.randomUUID();
export const newToken = () => crypto.randomBytes(24).toString("base64url");
export const hashToken = (token: string) => crypto.createHash("sha256").update(token).digest("hex");
