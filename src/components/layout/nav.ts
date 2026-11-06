import {
  LayoutDashboard, Building2, DoorOpen, Users, FileSignature, Wallet, CalendarClock, ShieldCheck, Receipt, BellRing, History, UserCog, Settings, Landmark,
} from "lucide-react";

export const NAV = [
  {
    label: "Pilotage",
    items: [{ href: "/dashboard", label: "Tableau de bord", icon: LayoutDashboard }],
  },
  {
    label: "Patrimoine",
    items: [
      { href: "/owners", label: "Propriétaires", icon: Landmark },
      { href: "/residences", label: "Résidences", icon: Building2 },
      { href: "/apartments", label: "Appartements", icon: DoorOpen },
    ],
  },
  {
    label: "Location",
    items: [
      { href: "/tenants", label: "Locataires", icon: Users },
      { href: "/leases", label: "Contrats de bail", icon: FileSignature },
    ],
  },
  {
    label: "Finances",
    items: [
      { href: "/rents", label: "Loyers", icon: CalendarClock },
      { href: "/payments", label: "Paiements", icon: Wallet },
      { href: "/deposits", label: "Cautions", icon: ShieldCheck },
      { href: "/receipts", label: "Reçus", icon: Receipt },
      { href: "/reminders", label: "Relances", icon: BellRing },
    ],
  },
  {
    label: "Administration",
    items: [
      { href: "/audit", label: "Journal d'audit", icon: History },
      { href: "/users", label: "Utilisateurs", icon: UserCog, adminOnly: true },
      { href: "/settings", label: "Paramètres", icon: Settings },
    ],
  },
] as const;
