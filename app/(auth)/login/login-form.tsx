"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { loginSchema, type LoginInput } from "@/lib/validations";
import { apiPost, HttpError } from "@/lib/api-client";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (data: LoginInput) => {
    setError(null);
    try {
      const res = await apiPost<{ user: { onboarded: boolean; name: string } }>("/api/auth/login", data);
      toast.success(`Bienvenue ${res.user.name}`);
      const next = params.get("next");
      router.replace(!res.user.onboarded ? "/onboarding" : next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard");
      router.refresh();
    } catch (e) {
      setError(e instanceof HttpError ? e.message : "Connexion impossible");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-4" noValidate>
      {error && <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">{error}</div>}
      <FormField label="Email" error={errors.email?.message} htmlFor="email">
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input id="email" type="email" autoComplete="email" placeholder="vous@agence.com" className="pl-9" {...register("email")} aria-invalid={!!errors.email} />
        </div>
      </FormField>
      <FormField label="Mot de passe" error={errors.password?.message} htmlFor="password">
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input id="password" type={show ? "text" : "password"} autoComplete="current-password" placeholder="••••••••••" className="px-9" {...register("password")} aria-invalid={!!errors.password} />
          <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label={show ? "Masquer" : "Afficher"}>
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </FormField>
      <Button type="submit" variant="brand" className="w-full" size="lg" loading={isSubmitting}>Se connecter</Button>
      <p className="pt-2 text-center text-xs text-muted-foreground">Accès réservé aux gestionnaires autorisés. Toutes les connexions sont journalisées.</p>
    </form>
  );
}
