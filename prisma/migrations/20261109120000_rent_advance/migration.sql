-- Avance sur loyer : montant libre déduit chaque mois du loyer dû
ALTER TYPE "PaymentType" ADD VALUE IF NOT EXISTS 'RENT_ADVANCE';
ALTER TABLE "Lease" ADD COLUMN "advanceBalance" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "Lease" ADD COLUMN "advanceMonthly" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "Rent" ADD COLUMN "advanceApplied" DECIMAL(14,2) NOT NULL DEFAULT 0;
