import { z } from "zod";
import { email, id, int, isoDate, money, optEmail, optId, optIsoDate, optStr, personSchema, phone, positiveMoney, reqStr } from "./common";

export * from "./common";

// --- Auth ---------------------------------------------------------------
export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Mot de passe requis").max(200),
});

export const passwordSchema = z
  .string()
  .min(10, "10 caractères minimum")
  .regex(/[A-Z]/, "Au moins une majuscule")
  .regex(/[a-z]/, "Au moins une minuscule")
  .regex(/[0-9]/, "Au moins un chiffre");

export const changePasswordSchema = z
  .object({ currentPassword: z.string().min(1), newPassword: passwordSchema, confirm: z.string() })
  .refine((d) => d.newPassword === d.confirm, { message: "Les mots de passe ne correspondent pas", path: ["confirm"] });

// --- Onboarding -----------------------------------------------------------
export const onboardingSchema = z.object({
  manager: personSchema.extend({ company: optStr(120) }),
  owner: personSchema,
});

// --- Utilisateurs (gestionnaires) --------------------------------------------
export const userCreateSchema = personSchema.extend({
  role: z.enum(["SUPER_ADMIN", "MANAGER"]).default("MANAGER"),
  password: passwordSchema,
  residenceIds: z.array(z.string()).default([]),
});
export const userUpdateSchema = personSchema.partial().extend({
  role: z.enum(["SUPER_ADMIN", "MANAGER"]).optional(),
  isActive: z.boolean().optional(),
  password: passwordSchema.optional().or(z.literal("")),
  residenceIds: z.array(z.string()).optional(),
});

// --- Propriétaires -------------------------------------------------------------
export const ownerSchema = z.object({
  firstName: reqStr("Le prénom", 80),
  lastName: reqStr("Le nom", 80),
  phone,
  email: optEmail,
  address: reqStr("L'adresse", 255),
  notes: optStr(2000),
});

// --- Résidences --------------------------------------------------------------
export const residenceSchema = z.object({
  name: reqStr("Le nom", 120),
  address: reqStr("L'adresse", 255),
  city: reqStr("La ville", 80),
  commune: reqStr("La commune", 80),
  description: optStr(4000),
  coverUrl: optStr(1000),
  ownerId: id,
  managerId: optId,
});

// --- Appartements & pièces -----------------------------------------------------
export const apartmentStatus = z.enum(["AVAILABLE", "OCCUPIED", "RESERVED", "MAINTENANCE"]);
export const roomType = z.enum(["LIVING_ROOM", "BEDROOM", "KITCHEN", "TOILET", "SHOWER", "BALCONY", "OFFICE"]);

export const roomSchema = z.object({
  type: roomType,
  label: optStr(80),
  surface: z.coerce.number().min(0).max(10_000).optional().nullable(),
  description: optStr(500),
});

export const apartmentSchema = z.object({
  residenceId: id,
  number: reqStr("Le numéro", 20),
  floor: int(-5, 200),
  surface: z.coerce.number().positive("Surface requise").max(100_000),
  roomsCount: int(1, 100),
  status: apartmentStatus.default("AVAILABLE"),
  baseRent: money.default(0),
  description: optStr(2000),
  rooms: z.array(roomSchema).optional(),
});

// --- Locataires ----------------------------------------------------------------
export const tenantBaseSchema = z
  .object({
    photoUrl: optStr(1_500_000),
    firstName: reqStr("Le prénom", 80),
    lastName: reqStr("Le nom", 80),
    phone,
    email: optEmail,
    profession: optStr(120),
    idType: z.enum(["CNI", "PASSPORT", "RESIDENCE_PERMIT", "DRIVING_LICENSE", "OTHER"]).default("CNI"),
    idNumber: reqStr("Le numéro de pièce", 60),
    idDocumentUrl: optStr(1_500_000),
    entryDate: isoDate,
    exitDate: optIsoDate,
    adults: int(1, 50),
    children: int(0, 50),
    // Rattachement : résidence obligatoire, appartement facultatif
    residenceId: id,
    apartmentId: optId,
  });

export const tenantSchema = tenantBaseSchema
  .refine((d) => !d.exitDate || d.exitDate >= d.entryDate, { message: "La date de sortie doit suivre la date d'entrée", path: ["exitDate"] });

// --- Baux ----------------------------------------------------------------------
export const leaseSchema = z
  .object({
    tenantId: id,
    residenceId: id,
    apartmentId: optId,
    startDate: isoDate,
    durationMonths: int(1, 240),
    monthlyRent: positiveMoney,
    charges: money.default(0),
    dueDay: int(1, 28).default(5),
    depositAmount: money.default(0),
    clauses: optStr(20_000),
    activate: z.boolean().default(true),
  });

export const leaseUpdateSchema = z.object({
  clauses: optStr(20_000),
  charges: money.optional(),
  dueDay: int(1, 28).optional(),
  status: z.enum(["DRAFT", "ACTIVE", "TERMINATED", "EXPIRED"]).optional(),
});

export const terminateLeaseSchema = z.object({
  date: isoDate,
  reason: optStr(500),
  refundDeposit: money.optional(),
});

// --- Paiements -------------------------------------------------------------------
export const paymentMethod = z.enum(["CASH", "BANK_TRANSFER", "MOBILE_MONEY", "CHECK", "CARD"]);

export const paymentSchema = z.object({
  leaseId: id,
  type: z.enum(["RENT", "DEPOSIT"]).default("RENT"),
  amount: positiveMoney,
  method: paymentMethod.default("CASH"),
  paidAt: isoDate,
  reference: optStr(120),
  notes: optStr(1000),
  sendEmail: z.boolean().default(true),
});

export const settingsSchema = z.object({
  agencyName: reqStr("Le nom de l'agence", 120),
  agencyAddress: optStr(255),
  agencyPhone: optStr(40),
  agencyEmail: optEmail,
  currency: z.string().min(3).max(3).default("XOF"),
  defaultClauses: optStr(20_000),
  remindersEnabled: z.boolean().default(true),
});

export type LoginInput = z.infer<typeof loginSchema>;
export { phone };
