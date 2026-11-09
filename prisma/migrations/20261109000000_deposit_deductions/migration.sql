-- Caution : retenues pour dégâts à la sortie du locataire
ALTER TABLE "Deposit" ADD COLUMN "deductedAmount" DECIMAL(14,2);
ALTER TABLE "Deposit" ADD COLUMN "deductions" JSONB;
