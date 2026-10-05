/** Protokol pesan WebSocket antara klien dan server real-time. */
import { z } from "zod";
import type { AvatarConfig } from "./avatar";
import { STATUSES, type PresenceStatus } from "./proximity";
import type { MapData } from "./map";
import type { Role } from "./roles";

export type Direction = "up" | "down" | "left" | "right";

export interface MediaState {
  mic: boolean;
  cam: boolean;
  screen: boolean;
}

export interface Presence {
  id: string;
  /** Id koneksi; mencegah pesan "keluar" lama menghapus koneksi baru setelah sambung ulang. */
  conn: string;
  name: string;
  avatar: AvatarConfig;
  role: Role;
  x: number;
  y: number;
  dir: Direction;
  moving: boolean;
  sitting: boolean;
  status: PresenceStatus;
  /** Status diatur manual (tidak ditimpa otomatis "jauh"). */
  manualStatus: boolean;
  media: MediaState;
  allowedZone: string | null;
  allowedPeers: string[];
  lastActive: number;
}

export interface ChatMessage {
  id: string;
  groupId: string;
  kind: "channel" | "nearby" | "dm";
  channelId: string | null;
  toUserId: string | null;
  senderId: string;
  senderName: string;
  body: string;
  createdAt: string;
}

export interface SharedNote {
  content: string;
  updatedAt: string | null;
  updatedBy: string | null;
  updatedByName: string | null;
}

const num = z.number().finite();

/** Emote yang bisa dimunculkan di atas kepala avatar. */
export const EMOTES = ["👋", "👍", "❤️", "😂", "🎉", "☕", "🤔", "👏"] as const;
export type Emote = (typeof EMOTES)[number];

export const clientMessageSchema = z.discriminatedUnion("t", [
  z.object({
    t: z.literal("move"),
    x: num,
    y: num,
    dir: z.enum(["up", "down", "left", "right"]),
    moving: z.boolean(),
  }),
  z.object({ t: z.literal("sit"), sitting: z.boolean() }),
  z.object({ t: z.literal("status"), status: z.enum(STATUSES), manual: z.boolean() }),
  z.object({ t: z.literal("activity") }),
  z.object({
    t: z.literal("chat"),
    kind: z.enum(["channel", "nearby", "dm"]),
    channelId: z.string().max(64).optional(),
    toUserId: z.string().max(64).optional(),
    body: z.string().min(1).max(2000),
  }),
  z.object({ t: z.literal("media"), mic: z.boolean(), cam: z.boolean(), screen: z.boolean() }),
  z.object({ t: z.literal("signal"), to: z.string().max(64), data: z.unknown() }),
  z.object({
    t: z.literal("knock"),
    toUserId: z.string().max(64).optional(),
    zoneId: z.string().max(64).optional(),
  }),
  z.object({ t: z.literal("knockReply"), knockId: z.string().max(64), accept: z.boolean() }),
  z.object({ t: z.literal("emote"), emoji: z.enum(EMOTES) }),
  z.object({ t: z.literal("ping") }),
]);

export type ClientMessage = z.infer<typeof clientMessageSchema>;

export type ServerMessage =
  | { t: "welcome"; selfId: string; peers: Presence[]; map: MapData; sharedNote: SharedNote }
  | { t: "join"; peer: Presence }
  | { t: "update"; peer: Presence }
  | { t: "leave"; id: string; conn: string }
  | { t: "chat"; message: ChatMessage }
  | { t: "emote"; id: string; emoji: Emote }
  | { t: "signal"; from: string; data: unknown }
  | { t: "knock"; knockId: string; from: string; fromName: string; zoneId: string | null }
  | { t: "knockResult"; knockId: string; accept: boolean; byName: string; zoneId: string | null }
  | { t: "moveRejected"; x: number; y: number; reason: "privateZone" }
  | { t: "screenRejected"; presenterId: string }
  | { t: "sharedNote"; note: SharedNote }
  | { t: "map"; map: MapData }
  | { t: "groupChanged" }
  | { t: "kicked"; reason: string }
  | { t: "error"; code: string }
  | { t: "pong" };
