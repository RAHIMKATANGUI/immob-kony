/** Libellés FR des énumérations (partagés client / serveur). */

export const APARTMENT_STATUS = {
  AVAILABLE: "Disponible",
  OCCUPIED: "Occupé",
  RESERVED: "Réservé",
  MAINTENANCE: "En maintenance",
} as const;

export const ROOM_TYPES = {
  LIVING_ROOM: "Salon",
  BEDROOM: "Chambre",
  KITCHEN: "Cuisine",
  TOILET: "Toilette",
  SHOWER: "Douche",
  BALCONY: "Balcon",
  OFFICE: "Bureau",
} as const;

export const RENT_STATUS = {
  PAID: "Payé",
  PARTIAL: "Partiellement payé",
  LATE: "En retard",
  UNPAID: "Non payé",
} as const;

export const LEASE_STATUS = {
  DRAFT: "Brouillon",
  ACTIVE: "Actif",
  TERMINATED: "Résilié",
  EXPIRED: "Expiré",
} as const;

export const DEPOSIT_STATUS = {
  PENDING: "Non versée",
  PARTIAL: "Partielle",
  PAID: "Soldée",
  REFUNDED: "Restituée",
} as const;

export const PAYMENT_TYPES = {
  RENT: "Loyer",
  DEPOSIT: "Caution",
  ADVANCE: "Loyer + avance",
  RENT_ADVANCE: "Avance sur loyer",
} as const;

export const PAYMENT_METHODS = {
  CASH: "Espèces",
  BANK_TRANSFER: "Virement",
  MOBILE_MONEY: "Mobile Money",
  CHECK: "Chèque",
  CARD: "Carte",
} as const;

export const ID_TYPES = {
  CNI: "CNI",
  PASSPORT: "Passeport",
  RESIDENCE_PERMIT: "Titre de séjour",
  DRIVING_LICENSE: "Permis de conduire",
  OTHER: "Autre pièce",
} as const;

export const ROLES = { SUPER_ADMIN: "Super administrateur", MANAGER: "Gestionnaire" } as const;

export const AUDIT_ACTIONS = {
  CREATE: "Création",
  UPDATE: "Modification",
  DELETE: "Suppression",
  LOGIN: "Connexion",
  LOGOUT: "Déconnexion",
  EXPORT: "Export",
  PAYMENT: "Paiement",
} as const;

export const NOTIFICATION_STATUS = { PENDING: "En attente", SENT: "Envoyée", FAILED: "Échec", SKIPPED: "Ignorée" } as const;
export const NOTIFICATION_CHANNELS = { EMAIL: "Email", SMS: "SMS", IN_APP: "Application" } as const;

export const ENTITY_LABELS: Record<string, string> = {
  User: "Utilisateur",
  Owner: "Propriétaire",
  Residence: "Résidence",
  Apartment: "Appartement",
  Room: "Pièce",
  Tenant: "Locataire",
  Lease: "Bail",
  Payment: "Paiement",
  Deposit: "Caution",
  Setting: "Paramètres",
  Export: "Export",
};
