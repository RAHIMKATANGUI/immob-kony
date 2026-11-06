# Cahier des charges — IMMOB KONY

| | |
|---|---|
| **Produit** | IMMOB KONY — plateforme SaaS de gestion immobilière |
| **Version** | 1.0 |
| **Date** | Novembre 2026 |
| **Langue** | Français (interface, documents, emails) |
| **Devise par défaut** | Franc CFA (XOF) — paramétrable |

## 1. Contexte et objectifs

Les gestionnaires immobiliers suivent souvent loyers, cautions et relances dans des cahiers ou tableurs. Cela produit des oublis de relance, des erreurs d'arriérés, des reçus non numérotés et aucune vision consolidée.

IMMOB KONY centralise la gestion locative :

- **O1** — Disposer d'un référentiel fiable : propriétaires, résidences, appartements, pièces, locataires.
- **O2** — Automatiser le cycle financier : échéancier, encaissements, paiements anticipés, arriérés, reçus numérotés.
- **O3** — Réduire les impayés par des relances automatiques planifiées (J-7 → J+15).
- **O4** — Piloter l'activité : taux d'occupation, revenus mensuels / annuels, retards.
- **O5** — Garantir sécurité, traçabilité (audit) et cloisonnement des données par gestionnaire.

## 2. Acteurs et rôles

| Acteur | Description | Droits |
|---|---|---|
| **Super administrateur** (`SUPER_ADMIN`) | Dirigeant de l'agence | Tous les propriétaires, gestionnaires et résidences ; gestion des utilisateurs ; attribution des résidences ; paramètres globaux ; suppression des propriétaires / résidences ; journal d'audit complet |
| **Gestionnaire** (`MANAGER`) | Gestionnaire locatif | Uniquement les résidences qui lui sont attribuées (et les appartements, locataires, baux, paiements qui en dépendent) ; ses propres entrées d'audit |
| **Locataire** (destinataire) | Pas d'accès à l'application | Reçoit reçus et relances par email / SMS ; peut vérifier un reçu via le QR code |
| **Tâche planifiée** | Cron Render quotidien | Génération des loyers, statuts de retard, relances |

## 3. Périmètre fonctionnel

### 3.1 Authentification et paramétrage initial
- Connexion email + mot de passe ; session JWT (8 h) ; déconnexion.
- Verrouillage 15 min après 5 échecs ; limitation du nombre de tentatives.
- **Assistant de configuration** à la première connexion : informations gestionnaire (nom, prénom, téléphone, email, adresse) puis propriétaire (nom, prénom, téléphone, email, adresse), récapitulatif.

### 3.2 Propriétaires
- Ajouter, modifier, supprimer (suppression logique), consulter l'**historique**.
- Champs : identifiant unique (`PRO-00001`), nom, prénom, téléphone, email, adresse, date de création, notes.
- Règle : suppression impossible tant que le propriétaire possède des résidences actives.

### 3.3 Résidences
- Champs : nom, adresse, ville, commune, description, propriétaire, gestionnaire attribué.
- Une résidence contient plusieurs appartements (vue par étage).
- Règle : suppression impossible si un bail actif y est rattaché.

### 3.4 Appartements et pièces
- Champs : numéro (unique par résidence), étage, surface, nombre de pièces, loyer de référence, statut.
- Statuts : **Disponible, Occupé, Réservé, En maintenance**. Le statut Occupé / Disponible est recalculé automatiquement à l'entrée / sortie d'un locataire ou à l'activation / résiliation d'un bail.
- Pièces : **Salon, Chambre, Cuisine, Toilette, Douche, Balcon, Bureau**, avec libellé et surface — détail complet par appartement.

### 3.5 Locataires
- Champs : photo, nom, prénom, téléphone, email, profession, pièce d'identité (type, numéro, scan), date d'entrée, date de sortie, nombre d'adultes, nombre d'enfants, **total d'occupants (calculé)**.
- Rattachement au choix : **à une résidence** ou **à un appartement** précis.
- **Fiche individuelle PDF** générée automatiquement : photo, informations personnelles, appartement occupé, historique des paiements, caution, contrat, dates d'entrée / sortie, QR code, signature.

### 3.6 Contrats de bail
- Création : locataire, résidence, appartement (facultatif), date de début, durée (mois), loyer, charges, jour d'échéance (1-28), caution, clauses (pré-remplies depuis les paramètres).
- **Contrat PDF** intégrant propriétaire, gestionnaire, locataire, résidence, appartement, loyer, durée, clauses.
- Règles : un locataire et un appartement n'ont qu'un seul bail actif à la fois ; fin = début + durée − 1 jour ; un bail échu passe automatiquement en « Expiré ».
- Résiliation : date effective, motif, restitution de la caution, suppression des échéances futures non réglées, sortie du locataire, libération du logement.

### 3.7 Cautions
- Suivi : montant, date du (premier) versement, total versé, **restant à payer**, historique des versements, restitution.
- Chaque versement génère un **reçu PDF** ; relevé de caution PDF.
- Règle : un versement ne peut dépasser le restant dû.

### 3.8 Loyers
- Pour chaque bail, une échéance mensuelle : montant (loyer + charges), date d'échéance, date de paiement, montant payé, **avance**, **arriéré**.
- Statuts : **Payé** (montant atteint), **En retard** (échéance dépassée et non soldée), **Partiellement payé** (acompte avant échéance), **Non payé**.
- Un paiement est ventilé de l'échéance la plus ancienne à la plus récente (traçabilité par `RentAllocation`).

### 3.9 Paiements anticipés
- Un montant supérieur aux échéances ouvertes couvre automatiquement les **mois suivants complets**.
- Le reliquat inférieur à une mensualité est conservé comme **solde disponible** et imputé automatiquement à la prochaine échéance générée.
- Calcul automatique : nombre de mois couverts, période couverte, **solde disponible**, **date de prochaine échéance**.

### 3.10 Reçus
- Générés automatiquement à chaque paiement : **numéro unique** séquentiel par année (`REC-2026-000001`), **QR code** renvoyant vers une page publique de vérification (sans données sensibles), formats **PDF** et **impression**, envoi par email.

### 3.11 Relances automatiques
- Avant échéance : **J-7, J-3, J-1** ; après échéance : **J+1, J+7, J+15**.
- Canaux : **Email** (Resend) et **SMS** (intégration préparée : Twilio ou passerelle HTTP), plus notification interne au gestionnaire.
- Idempotence : une seule relance par échéance, décalage et canal. Historique consultable, lancement manuel possible.

### 3.12 Tableau de bord
- KPI : total résidences, appartements, locataires, loyers encaissés, impayés, en retard, taux d'occupation, revenus mensuels, revenus annuels, taux de recouvrement.
- Graphiques : évolution des revenus (12 mois), taux d'occupation, statut des paiements, occupation par résidence ; prochaines échéances ; derniers encaissements.

### 3.13 Recherche, exports, audit
- **Recherche globale** (raccourci Ctrl/⌘ K) : locataire, appartement, résidence, bail, reçu.
- **Exports** PDF, Excel, CSV : propriétaires, résidences, appartements, locataires, baux, loyers, paiements, reçus, cautions.
- **Audit** : qui a créé, qui a modifié, quand, ancienne valeur, nouvelle valeur (+ IP, navigateur) ; connexions, exports et paiements tracés.

## 4. Exigences non fonctionnelles

| Domaine | Exigence |
|---|---|
| Sécurité | JWT, bcrypt, Zod, CSRF, rate limiting, RBAC, logs (cf. architecture) |
| Performance | Pages < 2 s sur 4G ; listes paginées (20 par défaut, 200 max) ; index SQL sur les colonnes filtrées |
| Disponibilité | Hébergement Render, health check `/api/health`, redémarrage automatique |
| Ergonomie | Responsive mobile-first, mode clair / sombre, accessibilité clavier (Radix), retours visuels (toasts) |
| Traçabilité | Journal d'audit non modifiable depuis l'interface ; suppression logique des référentiels |
| Qualité | TypeScript strict, lint, tests unitaires du moteur de loyers, CI GitHub Actions |
| Données | PostgreSQL, montants `DECIMAL(14,2)`, dates d'échéance en `DATE` (UTC) |
| Évolutivité | Passerelle SMS interchangeable ; limiteur de débit remplaçable par Redis ; API REST documentée |

## 5. Règles de gestion clés

| Code | Règle |
|---|---|
| RG-01 | Codes uniques : `PRO-`, `RES-`, `LOC-` (5 chiffres), `BAIL-AAAA-` (5), `REC-AAAA-` (6) — compteurs atomiques en base |
| RG-02 | Mensualité = loyer + charges ; échéance = jour J du mois (plafonné au 28) |
| RG-03 | Un paiement solde d'abord les échéances les plus anciennes |
| RG-04 | Reliquat ≥ mensualité → mois futurs payés ; reliquat < mensualité → solde disponible |
| RG-05 | Statut « En retard » dès le lendemain de l'échéance si non soldée |
| RG-06 | Un gestionnaire n'accède qu'aux résidences dont il est gestionnaire attribué |
| RG-07 | Un appartement en maintenance ne peut recevoir de nouveau locataire |
| RG-08 | Les relances ne sont envoyées que pour les baux actifs et les échéances non soldées |

## 6. Livrables

1. Cahier des charges (ce document) · 2. Architecture · 3. Schéma Prisma · 4. Structure des dossiers · 5. Code backend · 6. Code frontend · 7. API REST · 8. Interface complète · 9. Tableau de bord analytique · 10. Scripts SQL · 11. Docker · 12. GitHub Actions · 13. Configuration Render · 14. Jeu de données de démonstration · 15. Guide de déploiement.
