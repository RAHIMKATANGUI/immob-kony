import "server-only";
import type { SessionPayload } from "../auth/jwt";
import { prisma, type Tx } from "../prisma";
import { residenceScope } from "../rbac";
import { badRequest } from "../errors";

/** Vérifie le rattachement résidence / appartement dans le périmètre de l'utilisateur. */
export async function assertPlacement(session: SessionPayload, residenceId: string, apartmentId: string | null | undefined) {
  const residence = await prisma.residence.findFirst({ where: { id: residenceId, ...residenceScope(session) } });
  if (!residence) throw badRequest("Résidence invalide ou hors de votre périmètre");
  if (apartmentId) {
    const apt = await prisma.apartment.findFirst({ where: { id: apartmentId, residenceId, deletedAt: null } });
    if (!apt) throw badRequest("L'appartement n'appartient pas à cette résidence");
    if (apt.status === "MAINTENANCE") throw badRequest("Cet appartement est en maintenance");
  }
  return residence;
}

/** Recalcule le statut d'occupation d'un appartement selon ses occupants / baux actifs. */
export async function syncApartmentStatus(db: Tx, apartmentId: string) {
  const apt = await db.apartment.findUnique({ where: { id: apartmentId } });
  if (!apt || apt.status === "MAINTENANCE") return;
  const [tenants, leases] = await Promise.all([
    db.tenant.count({ where: { apartmentId, deletedAt: null, exitDate: null } }),
    db.lease.count({ where: { apartmentId, status: "ACTIVE" } }),
  ]);
  const occupied = tenants > 0 || leases > 0;
  if (occupied && apt.status !== "OCCUPIED") await db.apartment.update({ where: { id: apartmentId }, data: { status: "OCCUPIED" } });
  if (!occupied && apt.status === "OCCUPIED") await db.apartment.update({ where: { id: apartmentId }, data: { status: "AVAILABLE" } });
}
