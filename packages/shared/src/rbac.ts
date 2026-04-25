import type { RoleKey, SessionUser, Visibility } from "./contracts";

const roleWeight: Record<RoleKey, number> = {
  public: 0,
  viewer: 1,
  editor: 2,
  admin: 3,
  owner: 4
};

export function hasRole(user: SessionUser | null, required: RoleKey): boolean {
  const current = user?.role ?? "public";
  return roleWeight[current] >= roleWeight[required];
}

export function canReadVisibility(
  user: SessionUser | null,
  visibility: Visibility,
  allowedRoles: RoleKey[] = [],
  allowedGroupIds: string[] = []
): boolean {
  if (visibility === "public") {
    return true;
  }

  if (!user) {
    return false;
  }

  if (visibility === "internal") {
    return hasRole(user, "viewer");
  }

  if (hasRole(user, "admin")) {
    return true;
  }

  if (allowedRoles.length === 0 && allowedGroupIds.length === 0) {
    return false;
  }

  const roleAllowed =
    allowedRoles.length === 0 || allowedRoles.some((role) => hasRole(user, role));
  const groupAllowed =
    allowedGroupIds.length === 0 ||
    allowedGroupIds.some((groupId) => user.groupIds.includes(groupId));

  return roleAllowed && groupAllowed;
}

export function canEditPage(user: SessionUser | null): boolean {
  return hasRole(user, "editor");
}

export function canManageSettings(user: SessionUser | null): boolean {
  return hasRole(user, "admin");
}
