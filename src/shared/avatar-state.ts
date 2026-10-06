import type { AvatarCondition } from "./avatar";
import type { LifeState } from "./life";

/** Cosmetic condition is local to its owner; private needs are never published to peers. */
export function avatarCondition(life: LifeState | null, effectsEnabled = true): AvatarCondition {
  if (!life?.settings.enabled || !life.settings.effects || !effectsEnabled) return "normal";
  const { energy, hunger, thirst } = life.needs;
  if (energy < 8) return "sleepy";
  const low = Math.min(energy, hunger, thirst);
  if (low >= 20) return "normal";
  if (low === thirst) return "thirsty";
  if (low === hunger) return "hungry";
  return "tired";
}
