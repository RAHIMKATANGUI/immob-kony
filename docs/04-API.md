# API REST — IMMOB KONY

Base : `https://<votre-domaine>/api` · Format : JSON · Langue des messages : français

## Conventions

| Sujet | Règle |
|---|---|
| Authentification | Cookie `ik_session` (JWT httpOnly) posé par `POST /api/auth/login` |
| CSRF | Toute requête `POST/PUT/PATCH/DELETE` doit envoyer l'en-tête `x-csrf-token` égal au cookie `ik_csrf` (posé à la première visite) |
| Pagination | `?page=1&pageSize=20` (max 200) → `{ items, total, page, pageSize, pages }` |
| Recherche | `?q=texte` sur les listes |
| Erreurs | `{ "error": "message", "details": … }` — 400, 401, 403, 404, 409, 422 (validation Zod), 423 (compte verrouillé), 429 (quota), 500 |
| Périmètre | Un gestionnaire ne reçoit que les données de ses résidences ; une ressource hors périmètre renvoie 404 |
| Dates | `AAAA-MM-JJ` en entrée ; ISO 8601 en sortie |
| Montants | nombres (devise de l'agence, XOF par défaut) |

## Authentification & profil

| Méthode | Route | Description |
|---|---|---|
| POST | `/auth/login` | `{ email, password }` → cookie de session. Limité à 20 tentatives / 15 min / IP ; verrouillage 15 min après 5 échecs |
| POST | `/auth/logout` | Supprime la session |
| GET | `/auth/me` | Utilisateur connecté |
| POST | `/auth/password` | `{ currentPassword, newPassword, confirm }` |
| POST | `/onboarding` | Assistant : `{ manager: {…}, owner: {…} }` |

## Référentiel

| Méthode | Route | Permission | Description |
|---|---|---|---|
| GET / POST | `/owners` | owners:read / write | Liste / création (code `PRO-` généré) |
| GET / PATCH / DELETE | `/owners/{id}` | read / write / **delete (admin)** | Détail + résidences + **historique** / modification / suppression logique |
| GET / POST | `/residences` | residences:read / write | `?ownerId=` ; stats d'occupation incluses |
| GET / PATCH / DELETE | `/residences/{id}` | | Détail (appartements, locataires) ; `managerId` modifiable par l'admin uniquement |
| GET / POST | `/apartments` | apartments:read / write | `?status=&residenceId=` ; création avec `rooms[]` |
| GET / PATCH / DELETE | `/apartments/{id}` | | Détail (pièces, occupants, baux) |
| POST | `/apartments/{id}/rooms` | apartments:write | Ajout d'une pièce `{ type, label, surface }` |
| PATCH / DELETE | `/rooms/{id}` | apartments:write | |
| GET | `/managers` | admin | Gestionnaires actifs (attribution) |

## Locataires & baux

| Méthode | Route | Description |
|---|---|---|
| GET / POST | `/tenants` | `?state=active|left&residenceId=` ; `totalOccupants` calculé |
| GET / PATCH / DELETE | `/tenants/{id}` | Détail (baux, paiements, échéances, solde, historique) |
| GET | `/tenants/{id}/pdf` | **Fiche individuelle PDF** (`?download=1` pour forcer le téléchargement) |
| GET / POST | `/leases` | `?status=ACTIVE` ; création + caution + échéancier |
| GET / PATCH | `/leases/{id}` | Détail + `balance` (arriéré, solde disponible, prochaine échéance, payé jusqu'à) |
| GET | `/leases/{id}/contract` | **Contrat de bail PDF** |
| POST | `/leases/{id}/terminate` | `{ date, reason?, refundDeposit? }` |

Exemple de création de bail :

```http
POST /api/leases
x-csrf-token: <jeton>
Content-Type: application/json

{
  "tenantId": "cm…", "residenceId": "cm…", "apartmentId": "cm…",
  "startDate": "2026-11-01", "durationMonths": 12,
  "monthlyRent": 250000, "charges": 10000, "dueDay": 5,
  "depositAmount": 500000, "activate": true
}
```

## Finances

| Méthode | Route | Description |
|---|---|---|
| GET | `/rents` | Échéancier global `?status=LATE&month=2026-11` + totaux |
| GET | `/payments` | `?type=&from=&to=&leaseId=` + `totalAmount` |
| POST | `/payments` | **Encaissement** → reçu automatique (voir ci-dessous) |
| GET | `/deposits` | Cautions + totaux |
| GET | `/deposits/{id}/pdf` | Relevé de caution PDF |
| POST | `/deposits/{id}/refund` | `{ amount, date, notes? }` |
| GET | `/receipts` | Reçus |
| GET | `/receipts/{id}/pdf` | Reçu PDF (QR code) |
| POST | `/receipts/{id}/email` | Envoi du reçu au locataire |

### `POST /payments`

```json
{
  "leaseId": "cm…",
  "type": "RENT",              // RENT (avance gérée automatiquement) | DEPOSIT
  "amount": 1310000,
  "method": "MOBILE_MONEY",    // CASH | BANK_TRANSFER | MOBILE_MONEY | CHECK | CARD
  "paidAt": "2026-11-05",
  "reference": "OM-123456",
  "sendEmail": true
}
```

Réponse :

```json
{
  "payment": { "id": "…", "type": "ADVANCE", "amount": "1310000" },
  "receipt": { "id": "…", "number": "REC-2026-000230", "verifyToken": "…" },
  "advance": { "monthsCovered": 3, "coveredFrom": "2026-12-01", "coveredTo": "2027-02-01", "remainingBalance": "50000", "nextDueDate": "2027-03-05" },
  "creditBalance": 50000,
  "monthsCovered": 3
}
```

## Relances & notifications

| Méthode | Route | Description |
|---|---|---|
| GET | `/reminders` | Historique des relances email / SMS + statistiques |
| POST | `/reminders` | Lancement manuel (périmètre de l'utilisateur) |
| GET / POST | `/cron/reminders` | **Tâche planifiée** — en-tête `Authorization: Bearer $CRON_SECRET` |
| GET / PATCH | `/notifications` | Notifications internes ; `{ all: true }` ou `{ ids: [] }` pour marquer comme lues |

## Pilotage & administration

| Méthode | Route | Description |
|---|---|---|
| GET | `/dashboard` | KPI, séries (revenus 12 mois, occupation, paiements), échéances, encaissements |
| GET | `/search?q=` | Recherche globale (locataires, appartements, résidences, baux, reçus) |
| GET | `/exports/{entity}?format=csv|xlsx|pdf` | `owners, residences, apartments, tenants, leases, rents, payments, receipts, deposits` |
| GET | `/audit` | `?entity=&action=&entityId=` |
| GET / POST | `/users` | Admin : gestionnaires `{ …, password, residenceIds[] }` |
| PATCH / DELETE | `/users/{id}` | Admin : modification / désactivation |
| GET / PUT | `/settings` | Paramètres de l'agence (écriture admin) |
| POST | `/upload` | `multipart/form-data` `file`, `folder` (tenants, documents, residences, signatures, avatars) → `{ url }` |
| GET | `/health` | Santé (base de données) — utilisé par Render |

## Matrice des permissions

| Permission | SUPER_ADMIN | MANAGER |
|---|:-:|:-:|
| owners:read / write | ✓ | ✓ (ses propriétaires) |
| owners:delete, residences:delete, residences:assign | ✓ | — |
| residences, apartments, tenants, leases, payments (lecture / écriture) | ✓ | ✓ (ses résidences) |
| reminders:run, exports:run, audit:read | ✓ | ✓ (son périmètre / ses actions) |
| users:manage, settings:write | ✓ | — |
