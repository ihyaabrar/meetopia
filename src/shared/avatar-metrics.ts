/** Shared anchors, in world pixels unless explicitly marked as rig units. */
export const AVATAR_RENDER_METRICS = {
  mapScale: 1.5,
  footOffset: 8,
  seatedLegUnits: 4,
  hipPaddingUnits: 3,
} as const;
export const SEATED_PELVIS_OFFSET =
  AVATAR_RENDER_METRICS.footOffset -
  (AVATAR_RENDER_METRICS.hipPaddingUnits + AVATAR_RENDER_METRICS.seatedLegUnits) *
    AVATAR_RENDER_METRICS.mapScale;
