import type { AvatarConfig, AvatarDirection } from "@/shared/avatar";
import { sampleAvatarAction, type AvatarAction, type RigPose } from "@/shared/avatar-animation";
import type { AvatarPose } from "./avatar";
import {
  avatarSprite,
  avatarSpriteMirror,
  paintedAvatarReady,
  loadAvatarAssets,
  drawSleeve,
  drawPaintedLeg,
  unifiedBodySprite,
} from "./avatar-assets";
import { groundShadow, INK, rr, shade } from "./common";
import { drawHeldProp, loadEnvironmentAssets } from "./environment-assets";
import { AVATAR_RENDER_METRICS } from "@/shared/avatar-metrics";

type AccessoryPainter = (
  ctx: CanvasRenderingContext2D,
  a: AvatarConfig,
  x: number,
  hy: number,
  r: number,
  s: number,
  side: number,
  back: boolean,
) => void;
const BUBBLES: Record<string, string> = {
  sleep: "Zz",
  water: "💧",
  food: "🍔",
  battery: "▱",
  cough: "💨",
  stars: "✦",
  cloud: "☁",
  ellipsis: "…",
  question: "?",
  idea: "💡",
  clock: "◷",
  chat: "···",
  music: "♫",
};

export function paintedDims(a: AvatarConfig) {
  return a.body === "tall"
    ? { torso: 14, leg: 9, width: 13.5 }
    : a.body === "small"
      ? { torso: 10, leg: 6, width: 13 }
      : { torso: 12, leg: 8, width: 14.5 };
}
/** Match the front silhouette instead of inflating a narrower quarter/profile face to front width. */
export function fitHeadScale(width: number, height: number, referenceWidth: number, referenceHeight: number) {
  return Math.min(referenceWidth / Math.max(1, width), referenceHeight / Math.max(1, height));
}
/** Anchor the chin above the collar, rather than centering every differently shaped head at a fixed height. */
function headLayout(a: AvatarConfig, dir: AvatarDirection) {
  const sprite = avatarSprite(a, dir, "head");
  const face = sprite?.face;
  const back = dir.startsWith("up");
  const fw = a.head === "wide" ? 24 : a.head === "oval" ? 21 : 22.5;
  const front = dir === "down" ? sprite : avatarSprite(a, "down", "head");
  const frontRatio = front?.face ? fw / front.face.w : front ? 29 / front.canvas.width : 1;
  const ratio = !sprite
    ? 1
    : !back && front
      ? dir === "down"
        ? frontRatio
        : fitHeadScale(
            sprite.canvas.width,
            sprite.canvas.height,
            front.canvas.width * frontRatio,
            front.canvas.height * frontRatio,
          )
      : 29 / sprite.canvas.width;
  const anchorX = sprite ? (!back && face ? face.x + face.w / 2 : sprite.canvas.width / 2) : 0;
  const anchorY = sprite
    ? !back && face
      ? face.y + face.h / 2
      : sprite.canvas.height * (["long", "wavy", "braids", "ponytail"].includes(a.hair) ? 0.42 : 0.68)
    : 0;
  const longRearHair = back && ["long", "wavy", "braids", "ponytail"].includes(a.hair);
  const chin =
    !back && face
      ? (face.y + face.h - anchorY) * ratio
      : sprite && !longRearHair
        ? (sprite.canvas.height - anchorY) * ratio
        : 9.5;
  // A rear head has no front face/chin: connect its lower hair contour directly to the collar.
  return {
    sprite,
    face,
    ratio,
    anchorX,
    anchorY,
    chin,
    offset: chin + (back ? 0.25 : dir === "down" ? 1.2 : 0.35),
  };
}
/** Exposed for real-asset visual regression checks; native fallback has no raster dimensions. */
export function paintedHeadMetrics(a: AvatarConfig, dir: AvatarDirection) {
  const head = headLayout(a, dir);
  return head.sprite
    ? { width: head.sprite.canvas.width * head.ratio, height: head.sprite.canvas.height * head.ratio }
    : null;
}
export function paintedHeadOffset(a: AvatarConfig, dir: AvatarDirection = "down") {
  return headLayout(a, dir).offset;
}
/** Highest painted hair pixel above the standing foot anchor; labels must clear this, not a fixed y. */
export function paintedTopY(a: AvatarConfig, dir: AvatarDirection = "down") {
  const d = paintedDims(a),
    head = headLayout(a, dir);
  return 3 + d.leg + d.torso + head.offset + (head.sprite ? head.anchorY * head.ratio : 18);
}
function path(ctx: CanvasRenderingContext2D, points: number[], fill: string, line = 0.7) {
  ctx.beginPath();
  ctx.moveTo(points[0], points[1]);
  for (let i = 2; i < points.length; i += 2) ctx.lineTo(points[i], points[i + 1]);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = line;
  ctx.stroke();
}
function hand(ctx: CanvasRenderingContext2D, x: number, y: number, skin: string, gesture: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = INK;
  ctx.fillStyle = skin;
  ctx.lineWidth = 0.65;
  rr(ctx, -1.8, -1.5, 3.6, 3.4, 1.2);
  ctx.fill();
  ctx.stroke();
  if (["wave", "raise-hand", "high-five", "stretch", "present"].includes(gesture)) {
    for (let i = 0; i < 4; i++) {
      rr(ctx, -1.9 + i, -3.5 - (i === 1 ? 0.5 : 0), 0.9, 3.1, 0.45);
      ctx.fill();
      ctx.stroke();
    }
    rr(ctx, -3, -0.9, 1.8, 1, 0.5);
    ctx.fill();
    ctx.stroke();
  } else if (gesture === "thumbs-up") {
    rr(ctx, -0.7, -4, 1.3, 3.5, 0.65);
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(-1, -0.1);
    ctx.lineTo(1, -0.1);
    ctx.stroke();
  }
  ctx.restore();
}
function arm(
  ctx: CanvasRenderingContext2D,
  a: AvatarConfig,
  shoulder: number[],
  end: readonly number[],
  action: string,
  dir: AvatarDirection,
) {
  const mid = [
    shoulder[0] * 0.55 + end[0] * 0.45 + Math.sign(shoulder[0]) * 0.65,
    (shoulder[1] + end[1]) / 2 + 1,
  ];
  const gesture = ["wave", "raise-hand", "high-five", "stretch", "present", "thumbs-up"].includes(action);
  const paintedArm = drawSleeve(ctx, a, dir, shoulder, mid, end, gesture);
  if (paintedArm) {
    if (gesture) hand(ctx, end[0], end[1], a.skin, action);
    return;
  }
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4.7;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(...(shoulder as [number, number]));
  ctx.quadraticCurveTo(mid[0], mid[1], end[0], end[1]);
  ctx.stroke();
  ctx.strokeStyle = a.skin;
  ctx.lineWidth = 3.35;
  ctx.stroke();
  const short = ["tee", "polo", "striped"].includes(a.outfit),
    f = short ? 0.4 : 0.87;
  ctx.beginPath();
  ctx.moveTo(shoulder[0], shoulder[1]);
  ctx.quadraticCurveTo(
    mid[0],
    mid[1],
    shoulder[0] + (end[0] - shoulder[0]) * f,
    shoulder[1] + (end[1] - shoulder[1]) * f,
  );
  ctx.lineWidth = 5.15;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.lineWidth = 3.75;
  ctx.strokeStyle = shade(a.bodyColor, -0.1);
  ctx.stroke();
  hand(ctx, end[0], end[1], a.skin, action);
}
function drawFace(
  ctx: CanvasRenderingContext2D,
  a: AvatarConfig,
  f: { x: number; y: number; w: number; h: number },
  rig: RigPose,
  dir: AvatarDirection,
  time: number,
  action: AvatarAction,
) {
  const side =
    dir === "right" ? 1 : dir === "left" ? -1 : dir.includes("right") ? 0.4 : dir.includes("left") ? -0.4 : 0;
  const cx = f.x + f.w / 2,
    ey = f.y + f.h * 0.61,
    gap = f.w * 0.23;
  const face = rig.expression !== "normal" ? rig.expression : a.face;
  const eyes = ["sleepy", "tired", "bored"].includes(face)
    ? "sleepy"
    : ["happy", "calm", "excited"].includes(face) && a.eyes === "happy"
      ? "happy"
      : a.eyes;
  const blink = time > 0 && time % 4.4 < 0.14,
    smile = ["laugh", "clap", "dance"].includes(action);
  const positions = Math.abs(side) === 1 ? [cx + side * f.w * 0.07] : [cx - gap, cx + gap];
  if (action === "sick" || action === "nauseous") {
    ctx.fillStyle = action === "nauseous" ? "rgba(119,161,86,.23)" : "rgba(134,183,156,.18)";
    ctx.beginPath();
    ctx.ellipse(cx, ey + 1, f.w * 0.4, f.h * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.lineWidth = 0.75;
  ctx.strokeStyle = INK;
  for (const [i, ex] of positions.entries()) {
    ctx.fillStyle = "#26201d";
    ctx.beginPath();
    if (action === "dizzy") {
      ctx.moveTo(ex, ey);
      for (let n = 0; n <= 24; n++) {
        const angle = n * 0.4,
          radius = n * 0.065;
        ctx.lineTo(ex + Math.cos(angle) * radius, ey + Math.sin(angle) * radius);
      }
      ctx.stroke();
    } else if (
      blink ||
      action === "sleep" ||
      eyes === "closed" ||
      eyes === "happy" ||
      smile ||
      (a.face === "wink" && i === 1)
    ) {
      ctx.moveTo(ex - 1.6, ey);
      ctx.quadraticCurveTo(ex, ey + (eyes === "happy" || smile ? -2 : 0.9), ex + 1.6, ey);
      ctx.stroke();
    } else if (eyes === "sleepy") {
      ctx.moveTo(ex - 1.6, ey - 0.5);
      ctx.lineTo(ex + 1.6, ey - 0.5);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(ex, ey + 0.1, 1, 0.8, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const h = eyes === "dot" ? 1.2 : eyes === "wide" ? 2.1 : 1.8;
      ctx.ellipse(ex, ey, eyes === "dot" ? 1.15 : 1.5, h, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff8ef";
      ctx.beginPath();
      ctx.arc(ex - 0.35, ey - h * 0.5, 0.38, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = shade(a.hairColor, -0.15);
    ctx.lineWidth = 0.65;
    ctx.beginPath();
    const angry = face === "angry" || face === "focus" || a.brows === "angled";
    ctx.moveTo(ex - 1.7, ey - 3.1 + (angry && i === 0 ? -0.6 : 0));
    ctx.quadraticCurveTo(
      ex,
      ey - (a.brows === "arched" ? 4.3 : a.brows === "straight" ? 3.1 : 3.7),
      ex + 1.7,
      ey - 3.1 + (angry && i === 1 ? -0.6 : 0),
    );
    ctx.stroke();
    ctx.strokeStyle = INK;
  }
  if (a.faceAccent !== "none" || face === "shy")
    for (const dx of Math.abs(side) === 1 ? [side * 2] : [-f.w * 0.33, f.w * 0.33]) {
      ctx.fillStyle = a.faceAccent === "freckles" ? "#aa7050" : "rgba(231,125,124,.44)";
      if (a.faceAccent === "freckles")
        for (const n of [-1, 0, 1]) {
          ctx.beginPath();
          ctx.arc(cx + dx + n * 1.2, ey + 2.3 + (n === 0 ? 0.5 : 0), 0.35, 0, Math.PI * 2);
          ctx.fill();
        }
      else if (["heart", "star"].includes(a.faceAccent)) {
        ctx.font = "4px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(a.faceAccent === "heart" ? "♥" : "★", cx + dx, ey + 4);
      } else {
        ctx.beginPath();
        ctx.ellipse(cx + dx, ey + 2.5, 2, 1.05, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  const mx = cx + side * f.w * 0.045,
    my = f.y + f.h * 0.86;
  const talking = ["talk", "chat", "video-call", "present"].includes(action) && rig.frame % 2 === 0;
  const mouth = talking || smile ? "open" : face === "sad" ? "frown" : a.mouth;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  if (["open", "laugh", "tongue"].includes(mouth)) {
    ctx.moveTo(mx - 1.9, my - 0.5);
    ctx.lineTo(mx + 1.9, my - 0.5);
    ctx.bezierCurveTo(mx + 1.6, my + 3, mx - 1.6, my + 3, mx - 1.9, my - 0.5);
    ctx.fillStyle = "#73352e";
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#e99b96";
    ctx.beginPath();
    ctx.ellipse(mx, my + 1.1, 1.15, 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.moveTo(mx - 1.5, my);
    ctx.quadraticCurveTo(
      mx,
      my + (mouth === "frown" ? -1.2 : mouth === "straight" ? 0 : mouth === "tiny" ? 0.8 : 1.8),
      mx + 1.5,
      my,
    );
    ctx.stroke();
  }
}
/** Eyewear uses exactly the same eye anchors and head transform as the face, including quarter views. */
function drawPaintedEyewear(
  ctx: CanvasRenderingContext2D,
  a: AvatarConfig,
  f: { x: number; y: number; w: number; h: number },
  dir: AvatarDirection,
) {
  const enabled = a.eyewear !== "none" || ["glasses", "sunglasses"].includes(a.accessory);
  if (!enabled) return;
  const profile = dir === "left" || dir === "right";
  const side = dir.includes("left") ? -1 : dir.includes("right") ? 1 : 0;
  const cx = f.x + f.w / 2,
    ey = f.y + f.h * 0.61;
  const eyes = profile ? [cx + side * f.w * 0.07] : [cx - f.w * 0.23, cx + f.w * 0.23];
  const width = f.w * (profile ? 0.4 : 0.34),
    height = Math.min(5.6, f.h * 0.34);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 0.7;
  for (const ex of eyes) {
    rr(ctx, ex - width / 2, ey - height / 2, width, height, a.eyewear === "round" ? height / 2 : 1);
    if (a.eyewear === "sun" || a.accessory === "sunglasses") {
      ctx.fillStyle = "#243344";
      ctx.fill();
    }
    ctx.stroke();
  }
  ctx.beginPath();
  if (profile) {
    const ex = eyes[0];
    ctx.moveTo(ex - (side * width) / 2, ey);
    ctx.lineTo(cx - side * f.w * 0.42, ey - 0.6);
  } else {
    ctx.moveTo(eyes[0] + width / 2, ey);
    ctx.quadraticCurveTo(cx, ey - 0.6, eyes[1] - width / 2, ey);
    for (const i of [0, 1]) {
      const sd = i === 0 ? -1 : 1;
      ctx.moveTo(eyes[i] + (sd * width) / 2, ey);
      ctx.lineTo(cx + sd * f.w * 0.49, ey - 0.5);
    }
  }
  ctx.stroke();
}
function prop(ctx: CanvasRenderingContext2D, rig: RigPose, a: AvatarConfig, back = false) {
  const p = rig.prop === "none" ? a.prop : rig.prop,
    [hx, hy] = rig.right;
  const wide = ["laptop", "book", "pen", "board"].includes(p);
  if (
    drawHeldProp(
      ctx,
      p,
      wide ? 0 : hx,
      wide ? -12 : hy,
      wide ? (p === "board" ? 19 : 18) : p === "phone" ? 5 : 7,
      back,
    )
  )
    return;
  void loadEnvironmentAssets("props");
  ctx.strokeStyle = INK;
  ctx.lineWidth = 0.65;
  if (p === "laptop") {
    rr(ctx, -8, -17, 16, 9, 1);
    ctx.fillStyle = "#6c8292";
    ctx.fill();
    ctx.stroke();
    path(ctx, [-8, -8, 8, -8, 9, -6, -9, -6], "#bcc9d0", 0.6);
    ctx.fillStyle = "#e0e6e7";
    ctx.beginPath();
    ctx.arc(0, -12, 1, 0, Math.PI * 2);
    ctx.fill();
  } else if (p === "book" || p === "pen") {
    path(ctx, [-7, -16, 0, -15, 7, -16, 7, -8, 0, -7, -7, -8], "#fff0d7");
    ctx.beginPath();
    ctx.moveTo(0, -15);
    ctx.lineTo(0, -7);
    ctx.stroke();
    ctx.strokeStyle = "#b59f83";
    ctx.lineWidth = 0.35;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(-5, -13 + i * 1.6);
      ctx.lineTo(-1, -12.5 + i * 1.6);
      ctx.moveTo(1, -12.5 + i * 1.6);
      ctx.lineTo(5, -13 + i * 1.6);
      ctx.stroke();
    }
    if (p === "pen") {
      ctx.strokeStyle = "#273b52";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(hx - 2, hy + 1);
      ctx.lineTo(hx + 1, hy - 3);
      ctx.stroke();
    }
  } else if (p === "phone") {
    rr(ctx, hx - 2.5, hy - 3, 4.5, 7, 0.8);
    ctx.fillStyle = "#293844";
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#92cdda";
    ctx.fillRect(hx - 1.7, hy - 2, 2.8, 4.4);
  } else if (p === "coffee") {
    rr(ctx, hx - 2, hy - 2, 4.5, 5, 0.8);
    ctx.fillStyle = "#fff0d8";
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(hx + 2.8, hy + 0.5, 1.2, -Math.PI / 2, Math.PI / 2);
    ctx.stroke();
    ctx.fillStyle = "#795040";
    ctx.beginPath();
    ctx.ellipse(hx + 0.2, hy - 2, 1.9, 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(240,234,216,.75)";
    ctx.beginPath();
    ctx.moveTo(hx, hy - 4);
    ctx.quadraticCurveTo(hx + 2, hy - 6, hx, hy - 7);
    ctx.stroke();
  } else if (p === "bottle") {
    rr(ctx, hx - 1.4, hy - 4, 3.2, 7, 1);
    ctx.fillStyle = "#76c7e9";
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#d8eff7";
    ctx.fillRect(hx - 0.6, hy - 5, 1.7, 1.5);
  } else if (p === "burger") {
    ctx.fillStyle = "#dfab59";
    ctx.beginPath();
    ctx.ellipse(0, -15, 4, 2.4, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#665031";
    ctx.fillRect(-4, -15, 8, 1.5);
    ctx.fillStyle = "#7aa559";
    ctx.fillRect(-4, -13.5, 8, 0.8);
    ctx.fillStyle = "#dfab59";
    ctx.fillRect(-4, -12.7, 8, 1.5);
  }
}
/**
 * Walking step for a whole painted body seen from the side, at an angle, or from behind. The upper body
 * stays as painted; below the hip, a profile view swings the legs forward/back (shear pivoting on the hip)
 * and other views lift the left and right legs alternately. `s` is the stride phase, -1..1.
 */
function drawSteppingBody(
  ctx: CanvasRenderingContext2D,
  img: HTMLCanvasElement,
  x: number,
  y: number,
  w: number,
  h: number,
  hipFrac: number,
  s: number,
  profile: boolean,
) {
  const sw = img.width,
    sh = img.height,
    cut = Math.round(sh * hipFrac),
    hipY = y + h * hipFrac,
    legH = h - h * hipFrac;
  if (profile) {
    ctx.save();
    ctx.translate(0, hipY);
    ctx.transform(1, 0, s * 0.3, 1, 0, 0);
    ctx.drawImage(img, 0, cut, sw, sh - cut, x, 0, w, legH);
    ctx.restore();
  } else {
    const half = sw / 2;
    const lift = [Math.max(0, s), Math.max(0, -s)];
    for (const i of [0, 1])
      ctx.drawImage(
        img,
        i * half,
        cut,
        half,
        sh - cut,
        x + (i * w) / 2,
        hipY - lift[i] * h * 0.05,
        w / 2,
        legH,
      );
  }
  // Upper body last, overlapping the seam slightly so the moving legs never show a gap at the waist.
  const overlap = 0.02;
  ctx.drawImage(img, 0, 0, sw, cut + sh * overlap, x, y, w, h * (hipFrac + overlap));
}

/** Painted modular head/garment sprites + deterministic articulated limbs, not whole-sheet screenshots. */
export function drawPaintedAvatar(
  ctx: CanvasRenderingContext2D,
  a: AvatarConfig,
  x: number,
  y: number,
  scale: number,
  pose: AvatarPose,
  accessory: AccessoryPainter,
): boolean {
  if (!paintedAvatarReady()) {
    void loadAvatarAssets();
    return false;
  }
  const action = pose.activity ?? (pose.walk ? "walk" : pose.sitting ? "sit" : "idle");
  const conditionAction =
    pose.condition && pose.condition !== "normal" && action === "idle" ? pose.condition : action;
  const rig = sampleAvatarAction(
    conditionAction,
    pose.walk && action === "walk" ? pose.walk / (Math.PI * 2) : (pose.time ?? 0),
    pose.staticPose ?? false,
  );
  if (pose.sitting) rig.seated = true;
  const atKeyboard = action === "type" && !!pose.workstationHands;
  if (atKeyboard) rig.prop = "none";
  if (!atKeyboard && rig.prop === "none" && a.prop !== "none") {
    rig.prop = a.prop;
    if (a.prop === "book" || a.prop === "laptop") {
      rig.left = [-6, -13];
      rig.right = [6, -13];
    } else {
      rig.right = [7, -16];
    }
  }
  const d = paintedDims(a),
    leg = rig.seated ? AVATAR_RENDER_METRICS.seatedLegUnits : d.leg,
    hip = -AVATAR_RENDER_METRICS.hipPaddingUnits - leg,
    top = hip - d.torso;
  const head = headLayout(a, pose.dir);
  let headY = top - head.offset;
  const side = pose.dir.includes("left") ? -1 : pose.dir.includes("right") ? 1 : 0;
  const back = pose.dir.startsWith("up"),
    diagonal = pose.dir.includes("-"),
    mirror = avatarSpriteMirror(a, pose.dir, "head");
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  if (!pose.layer) groundShadow(ctx, 0, 0, 11, 3.5, 0.22);
  ctx.translate(0, rig.bob);
  ctx.rotate(rig.lean);
  const bodyW = d.width * (side ? (diagonal ? 0.91 : 0.78) : 1);
  const cloth = avatarSprite(a, pose.dir, "cloth")!;
  const directionalTorso = cloth.collarX !== undefined && cloth.collarY !== undefined;
  const torsoHeight = directionalTorso ? d.torso + 4.5 : d.torso + 1.5;
  const torsoWidth = bodyW * 1.04;
  const torsoY = directionalTorso ? top - 3 : top;
  // Every source view has its own neck center. Centering the image bounding box would slide a
  // profile jacket behind the head; align the anatomical neck instead (left is mirrored later).
  const torsoX = directionalTorso
    ? (side ? 0.6 : 0) - (cloth.collarX! / cloth.canvas.width) * torsoWidth
    : -bodyW * 0.52;
  const offset = rig.seated ? 3 : 0,
    left: [number, number] = [rig.left[0], rig.left[1] + offset],
    right: [number, number] = [rig.right[0], rig.right[1] + offset];
  // Rig poses are authored for the front view (hands beside the body). Seen from the side or at an
  // angle, the near arm sits in front of the torso and the far arm behind it, and both reach toward the
  // facing direction; otherwise a sideways avatar shows a front-facing pair of arms.
  const view = back ? "back" : side === 0 ? "front" : diagonal ? "quarter" : "profile";
  const sideways = view === "quarter" || view === "profile";
  const reach = (p: readonly [number, number]) => Math.max(0, Math.abs(p[0]) - 8);
  const nearShoulder: [number, number] = sideways
    ? [side * bodyW * (view === "profile" ? 0.08 : 0.3), top + 2]
    : [bodyW * 0.43, top + 2];
  const farShoulder: [number, number] = sideways
    ? [-side * bodyW * (view === "profile" ? 0.06 : 0.26), top + 2]
    : [-bodyW * 0.43, top + 2];
  // A hand raised above the shoulders goes further forward so the arm does not cover the face.
  const raisedReach = right[1] < top - 4 ? (view === "profile" ? 4 : 2.5) : 0;
  let nearHand: [number, number] = sideways
    ? [
        nearShoulder[0] + side * (1.4 + raisedReach + reach(right) * (view === "profile" ? 0.85 : 0.8)),
        right[1],
      ]
    : right;
  let farHand: [number, number] = sideways
    ? [farShoulder[0] + side * (0.6 + reach(left) * 0.5), left[1]]
    : left;
  if (atKeyboard) {
    const tick = pose.staticPose ? 0 : Math.sin((pose.time ?? 0) * Math.PI * 10) * 0.35;
    farHand = [pose.workstationHands!.left[0], pose.workstationHands!.left[1] + tick];
    nearHand = [pose.workstationHands!.right[0], pose.workstationHands!.right[1] - tick];
  }
  const seatedSideways = rig.seated && side !== 0 && !back;
  const unified =
    !rig.seated && !pose.part && rig.prop === "none"
      ? unifiedBodySprite(a, pose.dir, action, rig.frame)
      : null;
  // An item held in front of a rear-facing avatar belongs behind the torso, not pasted on its back.
  if (
    !atKeyboard &&
    back &&
    (rig.prop !== "none" || a.prop !== "none") &&
    !pose.part &&
    rig.prop !== "board"
  ) {
    ctx.save();
    ctx.translate(diagonal ? side * 4 : 0, 0);
    prop(ctx, { ...rig, right: nearHand }, a, true);
    ctx.restore();
  }
  if (!back && unified?.collarY !== undefined) {
    const height = d.torso + d.leg + 6;
    const collar = top - 3 + (unified.collarY * height) / unified.canvas.height;
    // Authored quarter/profile bodies have a longer bare neck than the front body.
    // Attach the chin to their actual garment seam, not the top of the entire sprite.
    headY = collar - (pose.dir === "down" ? 1.6 : 0.6) - head.chin;
  } else if (!unified && directionalTorso) {
    const collar = torsoY + (cloth.collarY! * torsoHeight) / cloth.canvas.height;
    headY = collar - (back ? 0.25 : pose.dir === "down" ? 1.0 : 0.45) - head.chin;
  }
  // Shared physical attachment for ALL body sources, including generated quarter/rear views.
  // The head and garment overpaint its ends, leaving only the short anatomical neck visible.
  ctx.fillStyle = a.skin;
  ctx.strokeStyle = shade(a.skin, -0.38);
  ctx.lineWidth = 0.4;
  rr(ctx, -2.35 + side * 0.6, top - 3.2, 4.7, 4.8, 1.1);
  ctx.fill();
  ctx.stroke();
  if (!pose.layer && unified) {
    ctx.save();
    if (pose.dir.includes("left")) ctx.scale(-1, 1);
    const height = d.torso + d.leg + 6;
    const width = (height * unified.canvas.width) / unified.canvas.height;
    // Only the front view has authored step frames; other views step procedurally on the same
    // painted body, so starting or stopping a walk never swaps to a different-looking rig.
    if ((action === "walk" || action === "run") && pose.dir !== "down")
      drawSteppingBody(
        ctx,
        unified.canvas,
        -width / 2,
        top - 3,
        width,
        height,
        (d.torso + 3) / height,
        rig.stride / (action === "run" ? 5 : 3),
        view === "profile",
      );
    else ctx.drawImage(unified.canvas, -width / 2, top - 3, width, height);
    ctx.restore();
  } else if (!pose.layer) {
    for (const sd of [-1, 1]) {
      const stride = rig.stride * sd,
        // Seated and facing sideways: thighs point forward instead of hanging straight down.
        footX =
          action === "sit-floor"
            ? -sd * 4.5
            : seatedSideways
              ? side * (diagonal ? 5.5 : 8) + sd * (diagonal ? 2.2 : 0.7)
              : sd * (side ? 2 : 3.3) + (side ? stride : 0),
        footY = rig.seated && action !== "sit-floor" ? 1.2 : -2 - Math.max(0, stride);
      const knee: readonly [number, number] | undefined =
        rig.seated && action !== "sit-floor" ? [seatedSideways ? footX : sd * 4.4, hip + 2.5] : undefined;
      if (drawPaintedLeg(ctx, a, sd * 3.2, hip, footX, footY, sd > 0, knee)) continue;
      const shorts = a.bottom === "shorts" || a.bottom === "skirt";
      path(
        ctx,
        [sd * 3.2 - 2.3, hip, sd * 3.2 + 2.3, hip, footX + 2, footY, footX - 2, footY],
        shorts ? a.skin : a.pantsColor,
      );
      if (a.bottom === "shorts")
        path(
          ctx,
          [
            sd * 3.2 - 2.5,
            hip,
            sd * 3.2 + 2.5,
            hip,
            sd * 3.2 + 2.4,
            hip + leg * 0.55,
            sd * 3.2 - 2.4,
            hip + leg * 0.55,
          ],
          a.pantsColor,
        );
      if (a.bottom === "cargo") {
        ctx.strokeStyle = shade(a.pantsColor, 0.25);
        ctx.lineWidth = 0.45;
        ctx.strokeRect(sd * 3.2 - 1.4, hip + 2, 2.8, 2.4);
      }
      rr(ctx, footX - 2.6, footY - 1.6, 5.8, 3.3, 1.4);
      ctx.fillStyle = a.shoes === "boots" ? "#6c4935" : a.shoes === "canvas" ? "#4b7860" : "#f6f2e9";
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 0.75;
      ctx.stroke();
      ctx.strokeStyle = "#aaa99e";
      ctx.lineWidth = 0.45;
      ctx.beginPath();
      ctx.moveTo(footX - 2, footY + 1);
      ctx.lineTo(footX + 2.8, footY + 1);
      ctx.stroke();
      for (const n of [0, 1]) {
        ctx.beginPath();
        ctx.moveTo(footX - 0.8, footY - 1 + n * 0.7);
        ctx.lineTo(footX + 1.1, footY - 1 + n * 0.7);
        ctx.stroke();
      }
    }
    if (a.bottom === "skirt") {
      path(ctx, [-5, hip - 1, 5, hip - 1, 7, hip + 4, -7, hip + 4], a.pantsColor);
      ctx.strokeStyle = shade(a.pantsColor, 0.25);
      for (const n of [-3, 0, 3]) {
        ctx.beginPath();
        ctx.moveTo(n, hip);
        ctx.lineTo(n * 1.3, hip + 3);
        ctx.stroke();
      }
    }
    if (pose.part === "legs") {
      ctx.restore();
      return true;
    }
    arm(ctx, a, farShoulder, farHand, action, pose.dir);
    if (!sideways) arm(ctx, a, nearShoulder, nearHand, action, pose.dir);
    ctx.save();
    if (avatarSpriteMirror(a, pose.dir, "cloth")) ctx.scale(-1, 1);
    // Directional bodices are closed torso silhouettes. Arms are separate animated material,
    // not a front jacket panel or fixed sleeve stubs composited over the turning body.
    if (directionalTorso || !back) {
      ctx.drawImage(cloth.canvas, torsoX, torsoY, torsoWidth, torsoHeight);
    } else {
      // Keep only the torso from the older rear shirt atlas: its static shoulder stubs must not be drawn
      // over separately animated long sleeves. Overlap the clavicle joints under the garment.
      ctx.beginPath();
      ctx.moveTo(-bodyW * 0.25, top);
      ctx.quadraticCurveTo(-bodyW * 0.49, top, -bodyW * 0.49, top + 3);
      ctx.lineTo(-bodyW * 0.46, top + d.torso * 0.65);
      ctx.lineTo(-bodyW * 0.5, top + d.torso + 1.5);
      ctx.lineTo(bodyW * 0.5, top + d.torso + 1.5);
      ctx.lineTo(bodyW * 0.46, top + d.torso * 0.65);
      ctx.quadraticCurveTo(bodyW * 0.52, top, bodyW * 0.25, top);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(cloth.canvas, -bodyW * 0.65, top, bodyW * 1.3, d.torso + 1.5);
    }
    ctx.restore();
    // Seen from the side, the near arm lies over the torso (raised arms are drawn later, over the head).
    if (sideways && (nearHand[1] >= top + 2 || atKeyboard))
      arm(ctx, a, nearShoulder, nearHand, action, pose.dir);
  }
  if (!pose.layer && a.accessory === "backpack") {
    ctx.fillStyle = a.accessoryColor;
    rr(ctx, side ? -side * 9 : -6, top + 3, side ? 5 : 12, 11, 2);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 0.7;
    ctx.stroke();
    if (back) {
      rr(ctx, -4, top + 8, 8, 4, 1);
      ctx.stroke();
    }
  }
  if (pose.part === "body") {
    ctx.restore();
    return true;
  }
  if (pose.layer && sideways) arm(ctx, a, farShoulder, farHand, action, pose.dir);
  if (rig.prop === "board") {
    ctx.save();
    ctx.translate(side < 0 ? -34 : 17, top - 11);
    if (!drawHeldProp(ctx, "board", 8.5, 7, 23)) {
      path(ctx, [0, 0, 17, 0, 17, 14, 0, 14], "#f4edda");
      ctx.strokeStyle = "#71a992";
      ctx.lineWidth = 0.6;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(3, 3 + i * 3);
        ctx.lineTo(13, 3 + i * 3);
        ctx.stroke();
      }
    }
    ctx.restore();
  }
  const { sprite: headSprite, face, ratio, anchorX, anchorY } = head;
  const sprite = headSprite!;
  ctx.save();
  ctx.translate(diagonal && back ? side * 1.1 : 0, headY);
  ctx.rotate(rig.tilt);
  if (mirror) ctx.scale(-1, 1);
  if (back && diagonal) ctx.transform(0.92, 0, side * 0.06, 1, 0, 0);
  const softHead = a.head === "soft" ? 0.93 : 1;
  ctx.scale(1, softHead);
  ctx.drawImage(
    sprite.canvas,
    -anchorX * ratio,
    -anchorY * ratio,
    sprite.canvas.width * ratio,
    sprite.canvas.height * ratio,
  );
  ctx.restore();
  if (!back && face) {
    ctx.save();
    ctx.translate(0, headY);
    ctx.rotate(rig.tilt);
    const fx = mirror ? -(face.x + face.w - anchorX) * ratio : (face.x - anchorX) * ratio;
    drawFace(
      ctx,
      a,
      { x: fx, y: (face.y - anchorY) * ratio, w: face.w * ratio, h: face.h * ratio },
      rig,
      pose.dir,
      pose.time ?? 0,
      action,
    );
    drawPaintedEyewear(
      ctx,
      a,
      { x: fx, y: (face.y - anchorY) * ratio, w: face.w * ratio, h: face.h * ratio },
      pose.dir,
    );
    ctx.restore();
  }
  const accessoryA = ["hijab", "cap", "beanie", "glasses", "sunglasses"].includes(a.accessory)
    ? { ...a, accessory: "none" as const }
    : a;
  accessory(ctx, accessoryA, 0, headY, 12, 1, diagonal ? side * 0.4 : side, back);
  if (a.headphones && a.accessory !== "headphones")
    accessory(ctx, { ...a, accessory: "headphones" }, 0, headY, 12, 1, side * 0.4, back);
  if (!atKeyboard && !back && rig.prop !== "board" && (rig.prop !== "none" || a.prop !== "none")) {
    // Held items follow the near hand; laptops/books shift toward the facing side.
    ctx.save();
    const shift = sideways ? side * (view === "profile" ? 4 : 2.5) : 0;
    ctx.translate(shift, 0);
    prop(ctx, { ...rig, right: [nearHand[0] - shift, nearHand[1]] }, a, back);
    ctx.restore();
  }
  // Raised hands draw in front of the head/props; ordinary arms stay behind the garment.
  if ((pose.layer && sideways) || (!pose.layer && !atKeyboard && nearHand[1] < top + 2))
    arm(ctx, a, nearShoulder, nearHand, action, pose.dir);
  // Seen from the side, a raised far arm stays behind the head (it was drawn before the torso).
  if (!pose.layer && !atKeyboard && !sideways && farHand[1] < top + 2)
    arm(ctx, a, farShoulder, farHand, action, pose.dir);
  if (rig.bubble) {
    ctx.save();
    ctx.translate(17, headY - 12 - Math.max(0, Math.sin((pose.time ?? 0) * 3)) * 0.8);
    ctx.fillStyle = "#f8f4e9";
    ctx.strokeStyle = "#5b544d";
    ctx.lineWidth = 0.6;
    rr(ctx, -4, -4, 9, 8, 3);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = rig.bubble === "water" ? "#3e9abc" : rig.bubble === "stars" ? "#d99f2e" : "#66577e";
    ctx.font = "bold 5.5px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(BUBBLES[rig.bubble] ?? "…", 0.5, 1.6);
    ctx.restore();
  }
  ctx.restore();
  return true;
}
