-- =====================================================================
--  IMMOB KONY — Vues de reporting (facultatives, lecture seule)
--  psql "$DATABASE_URL" -f prisma/sql/02_reporting_views.sql
-- =====================================================================

-- Situation financière par bail : dû, encaissé, arriéré, solde disponible
CREATE OR REPLACE VIEW v_lease_balance AS
SELECT
  l.id                                    AS lease_id,
  l.reference,
  l.status,
  t."firstName" || ' ' || t."lastName"    AS tenant,
  r.name                                  AS residence,
  a.number                                AS apartment,
  (l."monthlyRent" + l.charges)           AS monthly_total,
  COALESCE(SUM(rt.amount), 0)             AS total_due,
  COALESCE(SUM(rt."amountPaid"), 0)       AS total_paid,
  COALESCE(SUM(CASE WHEN rt."dueDate" < CURRENT_DATE THEN rt.amount - rt."amountPaid" ELSE 0 END), 0) AS arrears,
  l."creditBalance"                       AS credit_balance,
  MIN(CASE WHEN rt."amountPaid" < rt.amount THEN rt."dueDate" END) AS next_due_date
FROM "Lease" l
JOIN "Tenant" t     ON t.id = l."tenantId"
JOIN "Residence" r  ON r.id = l."residenceId"
LEFT JOIN "Apartment" a ON a.id = l."apartmentId"
LEFT JOIN "Rent" rt ON rt."leaseId" = l.id
GROUP BY l.id, t."firstName", t."lastName", r.name, a.number;

-- Revenus encaissés par mois (loyers + avances, hors cautions)
CREATE OR REPLACE VIEW v_monthly_revenue AS
SELECT date_trunc('month', p."paidAt")::date AS month,
       SUM(p.amount)                         AS revenue,
       COUNT(*)                              AS payments
FROM "Payment" p
WHERE p.type IN ('RENT', 'ADVANCE')
GROUP BY 1
ORDER BY 1;

-- Taux d'occupation par résidence
CREATE OR REPLACE VIEW v_residence_occupancy AS
SELECT r.id, r.name, r.commune,
       COUNT(a.id)                                            AS apartments,
       COUNT(a.id) FILTER (WHERE a.status = 'OCCUPIED')       AS occupied,
       ROUND(100.0 * COUNT(a.id) FILTER (WHERE a.status = 'OCCUPIED') / NULLIF(COUNT(a.id), 0), 1) AS occupancy_rate
FROM "Residence" r
LEFT JOIN "Apartment" a ON a."residenceId" = r.id AND a."deletedAt" IS NULL
WHERE r."deletedAt" IS NULL
GROUP BY r.id;

-- Impayés en retard (pour relances manuelles / exports)
CREATE OR REPLACE VIEW v_late_rents AS
SELECT rt.id, l.reference, t."firstName" || ' ' || t."lastName" AS tenant, t.phone, t.email,
       rt.period, rt."dueDate", rt.amount - rt."amountPaid" AS remaining,
       CURRENT_DATE - rt."dueDate" AS days_late
FROM "Rent" rt
JOIN "Lease" l  ON l.id = rt."leaseId"
JOIN "Tenant" t ON t.id = l."tenantId"
WHERE rt.status = 'LATE'
ORDER BY days_late DESC;
