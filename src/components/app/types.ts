import type { AudioConfig } from "@/shared/map";
import type { Role } from "@/shared/roles";
import type { AvatarConfig } from "@/shared/avatar";

export interface GroupSummary {
  id: string;
  name: string;
  role: Role;
  iconColor: string;
  iconSymbol: string;
}

export interface MemberInfo {
  id: string;
  name: string;
  avatar: AvatarConfig;
  role: Role;
  joinedAt?: string;
}

export interface GroupDetail {
  group: {
    id: string;
    name: string;
    ownerId: string;
    recordingPolicy: string;
    description: string;
    iconColor: string;
    iconSymbol: string;
  };
  role: Role;
  channels: Array<{ id: string; name: string; kind: string }>;
  members: MemberInfo[];
  audio: AudioConfig;
  template: string;
}

export interface Me {
  id: string;
  email: string;
  name: string;
  avatar: AvatarConfig;
  locale: string;
  highContrast: boolean;
  emailVerified: boolean;
  emailVerification: boolean;
  statusText: string | null;
  statusExpiresAt: string | null;
}

export type ChatTarget =
  { kind: "channel"; id: string } | { kind: "nearby" } | { kind: "dm"; userId: string };

export const chatKey = (c: ChatTarget) =>
  c.kind === "channel" ? `c:${c.id}` : c.kind === "dm" ? `dm:${c.userId}` : "nearby";
