/** Peran dalam grup (FR-03). Urutan menentukan tingkat hak akses. */
export const ROLES = ["guest", "member", "admin", "owner"] as const;
export type Role = (typeof ROLES)[number];

export function roleRank(role: Role): number {
  return ROLES.indexOf(role);
}

export function hasRole(actual: Role, required: Role): boolean {
  return roleRank(actual) >= roleRank(required);
}

/** Hak akses per aksi. Diperiksa di server untuk setiap API dan pesan real-time. */
export const PERMISSIONS = {
  enterRoom: "guest",
  readChannel: "guest",
  sendChannelMessage: "member",
  useMedia: "guest",
  editSharedNote: "member",
  createInvite: "admin",
  manageGroup: "admin",
  manageMembers: "admin",
  deleteGroup: "owner",
} as const satisfies Record<string, Role>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: Role, permission: Permission): boolean {
  return hasRole(role, PERMISSIONS[permission]);
}

/** Admin hanya boleh mengubah peran yang lebih rendah darinya; pemilik tidak bisa diubah lewat API ini. */
export function canChangeRole(actor: Role, target: Role, next: Role): boolean {
  if (!can(actor, "manageMembers")) return false;
  if (target === "owner" || next === "owner") return false;
  if (actor === "owner") return true;
  return roleRank(target) < roleRank(actor) && roleRank(next) < roleRank(actor);
}
