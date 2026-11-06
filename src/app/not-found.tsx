import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-grid px-6 text-center">
      <p className="font-display text-7xl font-bold text-gradient">404</p>
      <h1 className="text-xl font-semibold">Page introuvable</h1>
      <p className="max-w-sm text-sm text-muted-foreground">La page demandée n'existe pas ou vous n'y avez pas accès.</p>
      <Button asChild><Link href="/dashboard">Retour au tableau de bord</Link></Button>
    </div>
  );
}
