/**
 * Jeu de données de démonstration IMMOB KONY.
 *   npm run db:seed
 * Comptes :
 *   admin@immobkony.com        / Admin@2026!    (SUPER_ADMIN)
 *   gestionnaire@immobkony.com / Gestion@2026!  (MANAGER — Cocody & Marcory)
 *   a.kone@immobkony.com       / Gestion@2026!  (MANAGER — Yopougon & Plateau)
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import type { ApartmentStatus, PaymentMethod, RoomType } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { addMonths, startOfMonth, today, dueDateFor, addDays } from "../src/lib/dates";
import { nextCode, nextLeaseReference } from "../src/lib/sequence";
import { recordPayment, ensureRents, refreshRentStatuses } from "../src/lib/services/rent.service";
import { DEFAULT_CLAUSES } from "../src/lib/settings.shared";

// Générateur pseudo-aléatoire déterministe
let seed = 20261105;
const rand = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = <T,>(a: readonly T[]) => a[Math.floor(rand() * a.length)];

const FIRST = ["Aya", "Koffi", "Mariam", "Yao", "Fatou", "Serge", "Awa", "Didier", "Aminata", "Jean-Marc", "Adjoua", "Ibrahim", "Christelle", "Moussa", "Nadège", "Hervé", "Salimata", "Patrick", "Estelle", "Bakary", "Grâce", "Olivier"];
const LAST = ["Kouassi", "Traoré", "Konan", "Bamba", "Yao", "Coulibaly", "N'Guessan", "Diabaté", "Kouadio", "Touré", "Ouattara", "Gnagne", "Assi", "Koné", "Diallo", "Brou", "Aka", "Ehui"];
const JOBS = ["Ingénieur informatique", "Enseignante", "Comptable", "Médecin", "Commerçant", "Juriste", "Infirmière", "Architecte", "Chef de projet", "Banquier", "Pharmacienne", "Consultant"];
const phone = () => `+225 07 ${String(Math.floor(rand() * 90) + 10)} ${String(Math.floor(rand() * 90) + 10)} ${String(Math.floor(rand() * 90) + 10)} ${String(Math.floor(rand() * 90) + 10)}`;
const slug = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z]/g, "").toLowerCase();

async function main() {
  console.log("→ Nettoyage…");
  await prisma.$transaction([
    prisma.auditLog.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.receipt.deleteMany(),
    prisma.advancePayment.deleteMany(),
    prisma.rentAllocation.deleteMany(),
    prisma.payment.deleteMany(),
    prisma.rent.deleteMany(),
    prisma.deposit.deleteMany(),
    prisma.lease.deleteMany(),
    prisma.tenant.deleteMany(),
    prisma.room.deleteMany(),
    prisma.apartment.deleteMany(),
    prisma.residence.deleteMany(),
    prisma.owner.deleteMany(),
    prisma.manager.deleteMany(),
    prisma.user.deleteMany(),
    prisma.sequence.deleteMany(),
    prisma.setting.deleteMany(),
  ]);

  console.log("→ Paramètres & utilisateurs…");
  await prisma.setting.createMany({
    data: [
      { key: "agencyName", value: "KONY Gestion Immobilière" },
      { key: "agencyAddress", value: "Rue des Jardins, Cocody Deux-Plateaux, Abidjan" },
      { key: "agencyPhone", value: "+225 27 22 41 00 00" },
      { key: "agencyEmail", value: "contact@immobkony.com" },
      { key: "currency", value: "XOF" },
      { key: "defaultClauses", value: DEFAULT_CLAUSES },
      { key: "remindersEnabled", value: true },
    ],
  });

  const adminHash = await bcrypt.hash("Admin@2026!", 12);
  const managerHash = await bcrypt.hash("Gestion@2026!", 12);

  const admin = await prisma.user.create({
    data: {
      email: "admin@immobkony.com", passwordHash: adminHash, role: "SUPER_ADMIN", firstName: "Rahim", lastName: "Kony", phone: "+225 07 00 00 00 01", onboardingCompleted: true,
      manager: { create: { firstName: "Rahim", lastName: "Kony", phone: "+225 07 00 00 00 01", email: "admin@immobkony.com", address: "Cocody, Abidjan", company: "KONY Gestion Immobilière" } },
    },
    include: { manager: true },
  });
  const m1 = await prisma.user.create({
    data: {
      email: "gestionnaire@immobkony.com", passwordHash: managerHash, role: "MANAGER", firstName: "Aïcha", lastName: "Diomandé", phone: "+225 05 44 12 33 21", onboardingCompleted: true,
      manager: { create: { firstName: "Aïcha", lastName: "Diomandé", phone: "+225 05 44 12 33 21", email: "gestionnaire@immobkony.com", address: "Riviera 3, Cocody, Abidjan", company: "KONY Gestion Immobilière" } },
    },
    include: { manager: true },
  });
  const m2 = await prisma.user.create({
    data: {
      email: "a.kone@immobkony.com", passwordHash: managerHash, role: "MANAGER", firstName: "Arsène", lastName: "Koné", phone: "+225 01 70 22 18 90", onboardingCompleted: true,
      manager: { create: { firstName: "Arsène", lastName: "Koné", phone: "+225 01 70 22 18 90", email: "a.kone@immobkony.com", address: "Yopougon Maroc, Abidjan", company: "KONY Gestion Immobilière" } },
    },
    include: { manager: true },
  });

  console.log("→ Propriétaires…");
  const ownersData = [
    { firstName: "Laurent", lastName: "Gbagbo-Assi", phone: "+225 07 08 11 22 33", email: "l.assi@example.ci", address: "Cocody Ambassades, Abidjan" },
    { firstName: "Mireille", lastName: "Kouamé", phone: "+225 05 06 55 44 11", email: "m.kouame@example.ci", address: "Marcory Zone 4, Abidjan" },
    { firstName: "Issouf", lastName: "Sangaré", phone: "+225 01 02 03 04 05", email: "i.sangare@example.ci", address: "Plateau, Avenue Chardy, Abidjan" },
  ];
  const owners = [];
  for (const o of ownersData) owners.push(await prisma.owner.create({ data: { ...o, code: await nextCode("PRO"), createdById: admin.id } }));

  console.log("→ Résidences, appartements & pièces…");
  const residencesData = [
    { name: "Résidence Les Palmiers", address: "Rue L125, Riviera Palmeraie", city: "Abidjan", commune: "Cocody", owner: 0, manager: m1.manager!.id, floors: 3, perFloor: 3, rent: [250000, 350000, 450000] },
    { name: "Résidence Azur", address: "Boulevard VGE, Zone 4C", city: "Abidjan", commune: "Marcory", owner: 1, manager: m1.manager!.id, floors: 2, perFloor: 4, rent: [180000, 220000, 300000] },
    { name: "Les Jardins de Yopougon", address: "Carrefour Siporex", city: "Abidjan", commune: "Yopougon", owner: 2, manager: m2.manager!.id, floors: 2, perFloor: 3, rent: [90000, 120000, 150000] },
    { name: "Plateau Business Lofts", address: "Avenue Franchet d'Espérey", city: "Abidjan", commune: "Plateau", owner: 2, manager: m2.manager!.id, floors: 2, perFloor: 2, rent: [400000, 550000, 650000] },
  ];

  const allApartments: { id: string; residenceId: string; rent: number; number: string }[] = [];
  for (const r of residencesData) {
    const residence = await prisma.residence.create({
      data: {
        code: await nextCode("RES"), name: r.name, address: r.address, city: r.city, commune: r.commune,
        description: `${r.name} : immeuble sécurisé avec gardiennage 24h/24, groupe électrogène et parking. Situé à ${r.commune}.`,
        ownerId: owners[r.owner].id, managerId: r.manager, createdById: admin.id,
      },
    });
    for (let f = 0; f < r.floors; f++) {
      for (let k = 1; k <= r.perFloor; k++) {
        const pieces = 2 + ((f + k) % 3); // 2 à 4 pièces
        const rent = r.rent[Math.min(pieces - 2, 2)];
        const rooms: { type: RoomType; label: string; surface: number }[] = [
          { type: "LIVING_ROOM", label: "Salon", surface: 22 + pieces * 2 },
          ...Array.from({ length: pieces - 1 }, (_, i) => ({ type: "BEDROOM" as RoomType, label: `Chambre ${i + 1}`, surface: 12 + i })),
          { type: "KITCHEN", label: "Cuisine", surface: 9 },
          { type: "SHOWER", label: "Douche", surface: 5 },
          { type: "TOILET", label: "Toilette", surface: 2 },
          ...(pieces >= 3 ? [{ type: "BALCONY" as RoomType, label: "Balcon", surface: 6 }] : []),
          ...(pieces === 4 ? [{ type: "OFFICE" as RoomType, label: "Bureau", surface: 10 }] : []),
        ];
        const apt = await prisma.apartment.create({
          data: {
            residenceId: residence.id,
            number: `${String.fromCharCode(65 + f)}${k}`,
            floor: f,
            surface: rooms.reduce((a, x) => a + x.surface, 0),
            roomsCount: pieces,
            baseRent: rent,
            status: "AVAILABLE",
            rooms: { create: rooms },
          },
        });
        allApartments.push({ id: apt.id, residenceId: residence.id, rent, number: apt.number });
      }
    }
  }

  console.log("→ Locataires, baux, cautions & paiements…");
  const now = today();
  const profiles = ["good", "good", "good", "late", "partial", "advance", "good", "unpaid"] as const;
  let index = 0;
  for (const apt of allApartments) {
    index++;
    // ~75 % d'occupation, quelques logements réservés / en maintenance
    const roll = rand();
    if (roll > 0.78) {
      const status: ApartmentStatus = roll > 0.93 ? "MAINTENANCE" : roll > 0.86 ? "RESERVED" : "AVAILABLE";
      await prisma.apartment.update({ where: { id: apt.id }, data: { status } });
      continue;
    }
    const firstName = pick(FIRST);
    const lastName = pick(LAST);
    const monthsAgo = 2 + Math.floor(rand() * 14);
    const start = addMonths(startOfMonth(now), -monthsAgo);
    const adults = 1 + Math.floor(rand() * 2);
    const children = Math.floor(rand() * 3);
    const tenant = await prisma.tenant.create({
      data: {
        code: await nextCode("LOC"), firstName, lastName, phone: phone(),
        email: `${slug(firstName)}.${slug(lastName)}${index}@example.ci`,
        profession: pick(JOBS), idType: rand() > 0.8 ? "PASSPORT" : "CNI", idNumber: `CI${Math.floor(rand() * 9e9 + 1e9)}`,
        entryDate: start, adults, children, totalOccupants: adults + children,
        residenceId: apt.residenceId, apartmentId: apt.id, createdById: admin.id,
      },
    });
    const durationMonths = [12, 24, 36].find((d) => d > monthsAgo + 2 && rand() > 0.3) ?? 36;
    const charges = apt.rent >= 300000 ? 25000 : 10000;
    const lease = await prisma.lease.create({
      data: {
        reference: await nextLeaseReference(prisma, start.getUTCFullYear()),
        tenantId: tenant.id, residenceId: apt.residenceId, apartmentId: apt.id,
        startDate: start, endDate: addDays(addMonths(start, durationMonths), -1), durationMonths,
        monthlyRent: apt.rent, charges, dueDay: 5, status: "ACTIVE", signedAt: start, clauses: DEFAULT_CLAUSES, createdById: admin.id,
        deposit: { create: { amount: apt.rent * 2 } },
      },
    });
    await prisma.apartment.update({ where: { id: apt.id }, data: { status: "OCCUPIED" } });
    await prisma.$transaction((tx) => ensureRents(tx, lease.id, now));

    const method = (): PaymentMethod => pick(["MOBILE_MONEY", "MOBILE_MONEY", "BANK_TRANSFER", "CASH", "CHECK"]);
    // Caution : versée intégralement ou en deux fois
    if (rand() > 0.25) {
      await recordPayment({ leaseId: lease.id, type: "DEPOSIT", amount: apt.rent * 2, method: method(), paidAt: start, recordedById: admin.id });
    } else {
      await recordPayment({ leaseId: lease.id, type: "DEPOSIT", amount: apt.rent, method: method(), paidAt: start, recordedById: admin.id });
    }

    const profile = profiles[index % profiles.length];
    const total = apt.rent + charges;
    for (let m = 0; m <= monthsAgo; m++) {
      const period = addMonths(start, m);
      const due = dueDateFor(period, 5);
      const isCurrent = m === monthsAgo;
      if (profile === "advance" && m === Math.max(0, monthsAgo - 3)) {
        await recordPayment({ leaseId: lease.id, type: "RENT", amount: total * 6, method: "BANK_TRANSFER", paidAt: addDays(due, -3), reference: `VIR-${index}${m}`, recordedById: m1.id });
        break;
      }
      if (profile === "unpaid" && m >= monthsAgo - 1) break; // 2 derniers mois impayés
      if (profile === "late" && isCurrent) break;
      if (isCurrent && due > now) {
        if (rand() > 0.5) continue; // pas encore payé ce mois-ci
      }
      const paidAt = profile === "late" ? addDays(due, 6 + Math.floor(rand() * 10)) : addDays(due, -Math.floor(rand() * 4));
      if (paidAt > now) continue;
      const amount = profile === "partial" && m >= monthsAgo - 1 ? Math.round(total * 0.5) : total;
      await recordPayment({ leaseId: lease.id, type: "RENT", amount, method: method(), paidAt, reference: rand() > 0.5 ? `OM-${Math.floor(rand() * 1e8)}` : null, recordedById: m1.id });
    }
  }
  await refreshRentStatuses(prisma, now);

  // Quelques notifications internes
  await prisma.notification.createMany({
    data: [
      { kind: "SYSTEM", channel: "IN_APP", status: "SENT", title: "Bienvenue sur IMMOB KONY", message: "Votre espace de gestion est prêt.", userId: admin.id, sentAt: new Date() },
      { kind: "SYSTEM", channel: "IN_APP", status: "SENT", title: "Bienvenue sur IMMOB KONY", message: "Vos résidences vous ont été attribuées.", userId: m1.id, sentAt: new Date() },
    ],
  });
  await prisma.auditLog.create({ data: { userId: admin.id, userEmail: admin.email, action: "CREATE", entity: "Seed", entityId: null, newValue: { note: "Jeu de démonstration chargé" } } });

  const counts = {
    utilisateurs: await prisma.user.count(), proprietaires: await prisma.owner.count(), residences: await prisma.residence.count(),
    appartements: await prisma.apartment.count(), pieces: await prisma.room.count(), locataires: await prisma.tenant.count(),
    baux: await prisma.lease.count(), loyers: await prisma.rent.count(), paiements: await prisma.payment.count(), recus: await prisma.receipt.count(),
    avances: await prisma.advancePayment.count(),
  };
  console.table(counts);
  void m2;
}

main()
  .then(() => console.log("✓ Données de démonstration chargées"))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
