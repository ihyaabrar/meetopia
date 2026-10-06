import type { AvatarDirection } from "./avatar";

/** Cosmetic actions, independent from private needs or microphone permissions. */
export const AVATAR_ACTIONS = [
  "idle",
  "walk",
  "run",
  "jump",
  "sit",
  "sit-floor",
  "sit-sofa",
  "type",
  "read",
  "write",
  "present",
  "raise-hand",
  "phone",
  "coffee",
  "video-call",
  "brainstorm",
  "wave",
  "clap",
  "thumbs-up",
  "facepalm",
  "chat",
  "handshake",
  "high-five",
  "fist-bump",
  "talk",
  "laugh",
  "dance",
  "stretch",
  "wait",
  "think",
  "hungry",
  "very-hungry",
  "thirsty",
  "very-thirsty",
  "tired",
  "very-tired",
  "sleepy",
  "sleep",
  "sick",
  "dizzy",
  "nauseous",
  "bored",
  "focus",
  "confused",
] as const;
export type AvatarAction = (typeof AVATAR_ACTIONS)[number];
export type ActionGroup = "movement" | "work" | "social" | "condition";
export const ACTION_GROUPS: Record<ActionGroup, readonly AvatarAction[]> = {
  movement: ["idle", "walk", "run", "jump", "sit", "sit-floor", "sit-sofa", "stretch", "wait"],
  work: [
    "type",
    "read",
    "write",
    "present",
    "raise-hand",
    "phone",
    "coffee",
    "video-call",
    "brainstorm",
    "think",
    "focus",
  ],
  social: [
    "wave",
    "clap",
    "thumbs-up",
    "facepalm",
    "chat",
    "handshake",
    "high-five",
    "fist-bump",
    "talk",
    "laugh",
    "dance",
  ],
  condition: [
    "hungry",
    "very-hungry",
    "thirsty",
    "very-thirsty",
    "tired",
    "very-tired",
    "sleepy",
    "sleep",
    "sick",
    "dizzy",
    "nauseous",
    "bored",
    "confused",
  ],
};
export const ACTION_LABELS: Record<AvatarAction, readonly [string, string]> = {
  idle: ["Berdiri santai", "Idle"],
  walk: ["Berjalan", "Walk"],
  run: ["Berlari", "Run"],
  jump: ["Lompat", "Jump"],
  sit: ["Duduk kursi", "Sit on chair"],
  "sit-floor": ["Duduk lantai", "Sit on floor"],
  "sit-sofa": ["Duduk sofa", "Sit on sofa"],
  type: ["Mengetik", "Type"],
  read: ["Membaca dokumen", "Read"],
  write: ["Menulis catatan", "Write"],
  present: ["Presentasi", "Present"],
  "raise-hand": ["Angkat tangan", "Raise hand"],
  phone: ["Pakai HP", "Use phone"],
  coffee: ["Minum kopi", "Drink coffee"],
  "video-call": ["Video call", "Video call"],
  brainstorm: ["Papan ide", "Brainstorm"],
  wave: ["Melambai", "Wave"],
  clap: ["Tepuk tangan", "Clap"],
  "thumbs-up": ["Jempol", "Thumbs up"],
  facepalm: ["Facepalm", "Facepalm"],
  chat: ["Ngobrol", "Chat"],
  handshake: ["Gestur jabat tangan", "Handshake gesture"],
  "high-five": ["Gestur high five", "High five gesture"],
  "fist-bump": ["Gestur fist bump", "Fist bump gesture"],
  talk: ["Bicara", "Talk"],
  laugh: ["Tertawa", "Laugh"],
  dance: ["Menari kecil", "Dance"],
  stretch: ["Peregangan", "Stretch"],
  wait: ["Menunggu", "Wait"],
  think: ["Berpikir", "Think"],
  hungry: ["Lapar", "Hungry"],
  "very-hungry": ["Sangat lapar", "Very hungry"],
  thirsty: ["Haus", "Thirsty"],
  "very-thirsty": ["Sangat haus", "Very thirsty"],
  tired: ["Lelah", "Tired"],
  "very-tired": ["Sangat lelah", "Very tired"],
  sleepy: ["Mengantuk", "Sleepy"],
  sleep: ["Tidur", "Sleep"],
  sick: ["Sakit", "Sick"],
  dizzy: ["Pusing", "Dizzy"],
  nauseous: ["Mual", "Nauseous"],
  bored: ["Bosan", "Bored"],
  focus: ["Fokus", "Focus"],
  confused: ["Bingung", "Confused"],
};
export const actionLabel = (a: AvatarAction, locale: string) => ACTION_LABELS[a][locale === "id" ? 0 : 1];
export function directionFrom(dx: number, dy: number, fallback: AvatarDirection): AvatarDirection {
  if (Math.hypot(dx, dy) < 0.001) return fallback;
  const sectors: AvatarDirection[] = [
    "right",
    "down-right",
    "down",
    "down-left",
    "left",
    "up-left",
    "up",
    "up-right",
  ];
  return sectors[(Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) + 8) % 8];
}
export interface RigPose {
  frame: number;
  frames: number;
  bob: number;
  lean: number;
  tilt: number;
  seated: boolean;
  left: readonly [number, number];
  right: readonly [number, number];
  stride: number;
  prop: "none" | "laptop" | "book" | "pen" | "phone" | "coffee" | "bottle" | "burger" | "board";
  bubble: string | null;
  expression: "normal" | "happy" | "sleepy" | "sad" | "angry" | "surprised" | "confused";
}
/** 6/8 discrete rig frames, shared by preview and live map. Static mode uses a representative frame. */
export function sampleAvatarAction(action: AvatarAction, seconds: number, staticPose = false): RigPose {
  const frames = ["wave", "clap", "thumbs-up", "facepalm"].includes(action) ? 6 : 8;
  const frame = staticPose ? 2 : Math.floor(Math.max(0, seconds) * 8) % frames;
  const phase = (frame / frames) * Math.PI * 2,
    k = Math.sin(phase),
    p = Math.max(0, k);
  const r: RigPose = {
    frame,
    frames,
    bob: Math.sin(phase) * 0.2,
    lean: 0,
    tilt: 0,
    seated: false,
    left: [-10, -10],
    right: [10, -10],
    stride: 0,
    prop: "none",
    bubble: null,
    expression: "normal",
  };
  switch (action) {
    case "walk":
    case "run":
      r.stride = k * (action === "run" ? 5 : 3);
      r.bob = -Math.abs(k) * (action === "run" ? 2.5 : 1.2);
      r.lean = action === "run" ? 0.12 : 0;
      r.left = [-10, -10 + k * 2];
      r.right = [10, -10 - k * 2];
      break;
    case "jump":
      // Arms up in a V rather than straight out sideways.
      r.bob = -p * 9;
      r.left = [-12, -30 - p * 4];
      r.right = [12, -30 - p * 4];
      break;
    case "sit":
    case "sit-floor":
    case "sit-sofa":
      r.seated = true;
      r.left = [-7, -8];
      r.right = [7, -8];
      r.lean = action === "sit-sofa" ? -0.08 : 0;
      if (action === "sit-floor") {
        r.left = [-6, -6];
        r.right = [6, -6];
      }
      break;
    case "type":
    case "video-call":
      r.seated = true;
      r.prop = "laptop";
      r.left = [-6, -10 + k * 0.6];
      r.right = [6, -10 - k * 0.6];
      r.bubble = action === "video-call" ? "chat" : null;
      break;
    case "read":
      r.prop = "book";
      r.left = [-6, -13];
      r.right = [6, -13 + k * 0.3];
      r.tilt = 0.025 * k;
      break;
    case "write":
      r.prop = "pen";
      r.left = [-5, -12];
      r.right = [5 + k, -13 + k * 0.5];
      break;
    case "present":
    case "brainstorm":
      r.prop = "board";
      r.right = [15, -23 + k * 2];
      r.left = [-7, -13];
      r.bubble = action === "brainstorm" ? "idea" : null;
      break;
    case "raise-hand":
      r.right = [12, -37 + k];
      r.left = [-10, -10];
      break;
    case "phone":
      r.prop = "phone";
      r.right = [6, -17 + k * 0.4];
      r.left = [-6, -14];
      break;
    case "coffee":
    case "thirsty":
    case "very-thirsty":
      r.prop = action === "coffee" ? "coffee" : "bottle";
      r.right = [7, -15 - p * 8];
      r.left = [-10, -10];
      r.tilt = -p * 0.07;
      if (action === "very-thirsty") {
        r.left = [-7, -16];
        r.lean = 0.07;
        r.expression = "sad";
      }
      r.bubble = action !== "coffee" ? "water" : null;
      break;
    case "wave":
      r.right = [15 + k * 2, -28 + k];
      break;
    case "clap":
      r.left = [-2 - p * 4, -20];
      r.right = [2 + p * 4, -20];
      r.expression = "happy";
      break;
    case "thumbs-up":
      r.right = [12, -22 - p];
      r.expression = "happy";
      break;
    case "facepalm":
      r.right = [2, -29 + k * 0.2];
      r.tilt = 0.06;
      r.expression = "sad";
      break;
    case "chat":
    case "talk":
      r.right = [12, -18 + k * 3];
      r.bubble = action === "chat" ? "chat" : null;
      break;
    case "handshake":
      r.right = [17, -15 + k];
      r.lean = 0.05;
      break;
    case "high-five":
      r.right = [18, -31 + k * 2];
      r.lean = -0.04;
      r.expression = "happy";
      break;
    case "fist-bump":
      r.right = [18, -20 + k];
      r.expression = "happy";
      break;
    case "laugh":
      r.left = [-5, -14];
      r.right = [5, -14];
      r.expression = "happy";
      r.bob = -Math.abs(k);
      r.tilt = k * 0.06;
      break;
    case "dance":
      r.left = [-13, -20 + k * 5];
      r.right = [13, -20 - k * 5];
      r.lean = k * 0.12;
      r.stride = k * 2;
      r.bob = -Math.abs(k) * 1.5;
      r.bubble = "music";
      break;
    case "stretch":
      r.left = [-12, -36 + k];
      r.right = [12, -36 - k];
      r.lean = k * 0.06;
      r.expression = "happy";
      break;
    case "wait":
      r.left = [-6, -15];
      r.right = [6, -15];
      r.bubble = "clock";
      r.tilt = k * 0.025;
      break;
    case "think":
    case "confused":
      r.right = [4, -25];
      r.tilt = 0.08 + k * 0.025;
      r.bubble = action === "think" ? "idea" : "question";
      break;
    case "hungry":
    case "very-hungry":
      r.left = [-4, -14];
      r.right = [4, -14 + k];
      r.lean = k * 0.025;
      r.prop = action === "very-hungry" ? "burger" : "none";
      r.bubble = "food";
      r.expression = "sad";
      break;
    case "tired":
    case "very-tired":
      r.lean = action === "very-tired" ? 0.2 : 0.09;
      r.left = [-9, -8];
      r.right = [9, -8];
      r.tilt = k * 0.05;
      r.expression = "sleepy";
      r.bubble = "battery";
      if (action === "very-tired") {
        r.seated = true;
        r.right = [3, -25];
      }
      break;
    case "sleepy":
    case "sleep":
      r.seated = action === "sleep";
      r.tilt = (action === "sleep" ? 0.3 : 0.12) + k * 0.025;
      r.right = [4, -25];
      r.expression = "sleepy";
      r.bubble = "sleep";
      break;
    case "sick":
      r.right = [3, -25 + p];
      r.left = [-5, -13];
      r.bob = k * 0.5;
      r.expression = "sad";
      r.bubble = "cough";
      break;
    case "dizzy":
      r.lean = k * 0.09;
      r.tilt = k * 0.12;
      r.right = [10, -29];
      r.bubble = "stars";
      r.expression = "confused";
      break;
    case "nauseous":
      r.right = [2, -25];
      r.left = [-4, -14];
      r.lean = 0.1 + k * 0.03;
      r.bubble = "cloud";
      r.expression = "sad";
      break;
    case "bored":
      r.left = [-4, -20];
      r.right = [4, -20];
      r.expression = "sleepy";
      r.bubble = "ellipsis";
      r.tilt = k * 0.04;
      break;
    case "focus":
      r.prop = "laptop";
      r.left = [-6, -13];
      r.right = [6, -13 + k * 0.5];
      r.expression = "angry";
      break;
  }
  return r;
}
