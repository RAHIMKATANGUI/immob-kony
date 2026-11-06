import { Badge } from "@/components/ui/badge";
import { APARTMENT_STATUS, DEPOSIT_STATUS, LEASE_STATUS, NOTIFICATION_STATUS, PAYMENT_TYPES, RENT_STATUS } from "@/lib/labels";

type V = "success" | "warning" | "danger" | "info" | "muted" | "default";

export function RentStatusBadge({ status }: { status: keyof typeof RENT_STATUS }) {
  const v: Record<string, V> = { PAID: "success", PARTIAL: "warning", LATE: "danger", UNPAID: "muted" };
  return <Badge variant={v[status]} dot>{RENT_STATUS[status]}</Badge>;
}

export function ApartmentStatusBadge({ status }: { status: keyof typeof APARTMENT_STATUS }) {
  const v: Record<string, V> = { AVAILABLE: "success", OCCUPIED: "info", RESERVED: "warning", MAINTENANCE: "danger" };
  return <Badge variant={v[status]} dot>{APARTMENT_STATUS[status]}</Badge>;
}

export function LeaseStatusBadge({ status }: { status: keyof typeof LEASE_STATUS }) {
  const v: Record<string, V> = { ACTIVE: "success", DRAFT: "muted", TERMINATED: "danger", EXPIRED: "warning" };
  return <Badge variant={v[status]} dot>{LEASE_STATUS[status]}</Badge>;
}

export function DepositStatusBadge({ status }: { status: keyof typeof DEPOSIT_STATUS }) {
  const v: Record<string, V> = { PAID: "success", PARTIAL: "warning", PENDING: "danger", REFUNDED: "muted" };
  return <Badge variant={v[status]} dot>{DEPOSIT_STATUS[status]}</Badge>;
}

export function PaymentTypeBadge({ type }: { type: keyof typeof PAYMENT_TYPES }) {
  const v: Record<string, V> = { RENT: "info", DEPOSIT: "default", ADVANCE: "success" };
  return <Badge variant={v[type]}>{PAYMENT_TYPES[type]}</Badge>;
}

export function NotificationStatusBadge({ status }: { status: keyof typeof NOTIFICATION_STATUS }) {
  const v: Record<string, V> = { SENT: "success", PENDING: "warning", FAILED: "danger", SKIPPED: "muted" };
  return <Badge variant={v[status]} dot>{NOTIFICATION_STATUS[status]}</Badge>;
}
