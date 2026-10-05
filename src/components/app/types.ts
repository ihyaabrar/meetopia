import type { AudioConfig } from "@/shared/map";
import type { Role } from "@/shared/roles";
import type { AvatarConfig } from "@/shared/avatar";

export interface GroupSummary {
  id: string;
  name: string;
  role: Role;
}

export interface MemberInfo {
  id: string;
  name: string;
  avatar: AvatarConfig;
  role: Role;
}

export interface GroupDetail {
  group: { id: string; name: string; ownerId: string; recordingPolicy: string };
  role: Role;
  channels: Array<{ id: string; name: string; kind: string }>;
  members: MemberInfo[];
  audio: AudioConfig;
}

export interface Me {
  id: string;
  email: string;
  name: string;
  avatar: AvatarConfig;
  locale: string;
  highContrast: boolean;
  emailVerified: boolean;
}

export type ChatTarget =
  { kind: "channel"; id: string } | { kind: "nearby" } | { kind: "dm"; userId: string };

export const chatKey = (c: ChatTarget) =>
  c.kind === "channel" ? `c:${c.id}` : c.kind === "dm" ? `dm:${c.userId}` : "nearby";
