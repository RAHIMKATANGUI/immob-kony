import * as React from "react";
import { Label } from "./label";
import { cn } from "@/lib/utils";

/** Champ de formulaire : libellé + contrôle + message d'erreur. */
export function FormField({ label, error, hint, required, className, children, htmlFor }: { label: string; error?: string; hint?: string; required?: boolean; className?: string; children: React.ReactNode; htmlFor?: string }) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {required && <span className="ml-0.5 text-brand">*</span>}
      </Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
