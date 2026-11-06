import { z } from "zod";

export const phoneRegex = /^\+?[0-9 ().-]{6,20}$/;

export const reqStr = (label: string, max = 120) =>
  z.string({ error: `${label} est requis` }).trim().min(1, `${label} est requis`).max(max, `${label} : ${max} caractères max.`);

export const optStr = (max = 255) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

export const phone = z.string().trim().regex(phoneRegex, "Numéro de téléphone invalide");
export const email = z.string().trim().toLowerCase().email("Email invalide");
export const optEmail = z
  .union([z.literal(""), email])
  .optional()
  .nullable()
  .transform((v) => (v ? v : null));

export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}/, "Date invalide (AAAA-MM-JJ)");
export const optIsoDate = z
  .union([z.literal(""), isoDate])
  .optional()
  .nullable()
  .transform((v) => (v ? v : null));

export const money = z.coerce.number({ error: "Montant invalide" }).min(0, "Montant positif requis").max(1_000_000_000_000);
export const positiveMoney = z.coerce.number({ error: "Montant invalide" }).positive("Le montant doit être supérieur à 0").max(1_000_000_000_000);
export const int = (min = 0, max = 10_000) => z.coerce.number().int().min(min).max(max);
export const id = z.string().min(1);
export const optId = z
  .string()
  .optional()
  .nullable()
  .transform((v) => (v ? v : null));

export const personSchema = z.object({
  firstName: reqStr("Le prénom", 80),
  lastName: reqStr("Le nom", 80),
  phone,
  email,
  address: reqStr("L'adresse", 255),
});
