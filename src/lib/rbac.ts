import type { Prisma } from "@prisma/client";
import type { Role, SessionPayload } from "./auth/jwt";
import { forbidden } from "./errors";

/**
 * Matrice des permissions (RBAC).
 * SUPER_ADMIN : tout. MANAGER : uniquement le périmètre des résidences qui lui sont attribuées.
 */
export const PERMISSIONS = {
  "owners:read": ["SUPER_ADMIN", "MANAGER"],
  "owners:write": ["SUPER_ADMIN", "MANAGER"],
  "owners:delete": ["SUPER_ADMIN"],
  "residences:read": ["SUPER_ADMIN", "MANAGER"],
  "residences:write": ["SUPER_ADMIN", "MANAGER"],
  "residences:delete": ["SUPER_ADMIN"],
  "residences:assign": ["SUPER_ADMIN"],
  "apartments:read": ["SUPER_ADMIN", "MANAGER"],
  "apartments:write": ["SUPER_ADMIN", "MANAGER"],
  "apartments:delete": ["SUPER_ADMIN", "MANAGER"],
  "tenants:read": ["SUPER_ADMIN", "MANAGER"],
  "tenants:write": ["SUPER_ADMIN", "MANAGER"],
  "tenants:delete": ["SUPER_ADMIN", "MANAGER"],
  "leases:read": ["SUPER_ADMIN", "MANAGER"],
  "leases:write": ["SUPER_ADMIN", "MANAGER"],
  "payments:read": ["SUPER_ADMIN", "MANAGER"],
  "payments:write": ["SUPER_ADMIN", "MANAGER"],
  "reminders:run": ["SUPER_ADMIN", "MANAGER"],
  "users:manage": ["SUPER_ADMIN"],
  "audit:read": ["SUPER_ADMIN", "MANAGER"],
  "settings:write": ["SUPER_ADMIN"],
  "exports:run": ["SUPER_ADMIN", "MANAGER"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(session: Pick<SessionPayload, "role"> | null, perm: Permission) {
  return !!session && (PERMISSIONS[perm] as readonly Role[]).includes(session.role);
}

export function assertCan(session: SessionPayload, perm: Permission) {
  if (!can(session, perm)) throw forbidden(`Permission requise : ${perm}`);
}

export const isAdmin = (s: SessionPayload) => s.role === "SUPER_ADMIN";

/** Filtre Prisma : résidences visibles par l'utilisateur. */
export function residenceScope(s: SessionPayload): Prisma.ResidenceWhereInput {
  if (isAdmin(s)) return { deletedAt: null };
  return { deletedAt: null, managerId: s.managerId ?? "__none__" };
}

export const apartmentScope = (s: SessionPayload): Prisma.ApartmentWhereInput => ({ deletedAt: null, residence: residenceScope(s) });
export const tenantScope = (s: SessionPayload): Prisma.TenantWhereInput => ({ deletedAt: null, residence: residenceScope(s) });
export const leaseScope = (s: SessionPayload): Prisma.LeaseWhereInput => ({ residence: residenceScope(s) });

/** Propriétaires visibles : tous pour l'admin ; pour un gestionnaire, ceux de ses résidences ou créés par lui. */
export function ownerScope(s: SessionPayload): Prisma.OwnerWhereInput {
  if (isAdmin(s)) return { deletedAt: null };
  return {
    deletedAt: null,
    OR: [{ residences: { some: residenceScope(s) } }, { createdById: s.sub }],
  };
}
