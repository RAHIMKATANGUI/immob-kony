"use client";
import { Button } from "@/components/ui/button";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
      <h2 className="text-lg font-semibold">Une erreur est survenue</h2>
      <p className="max-w-md text-sm text-muted-foreground">{error.message || "Erreur inattendue"}</p>
      <Button onClick={reset}>Réessayer</Button>
    </div>
  );
}
