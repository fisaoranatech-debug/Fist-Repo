"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { api, ApiError } from "@/lib/api-client";
import { Alert, Button, Card, Field, Input } from "./ui";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setFieldErrors({});
    const body = Object.fromEntries(new FormData(e.currentTarget));
    try {
      await api(mode === "login" ? "/api/auth/login" : "/api/auth/register", { body });
      const next = params.get("suite");
      router.replace(next && next.startsWith("/") && !next.startsWith("//") ? next : "/appareils");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
      if (err instanceof ApiError && err.details) setFieldErrors(err.details);
      setLoading(false);
    }
  }

  const fe = (k: string) => fieldErrors[k]?.[0];

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-10">
      <Link href="/" className="mb-6 flex items-center justify-center gap-2 text-lg font-bold">
        <span className="grid size-9 place-items-center rounded-xl bg-brand-600 text-white">◎</span> Retrouve
      </Link>
      <Card>
        <h1 className="text-xl font-bold">{mode === "login" ? "Connexion" : "Créer un compte"}</h1>
        <form onSubmit={onSubmit} className="mt-5 space-y-4" noValidate>
          {error && <Alert>{error}</Alert>}
          {mode === "register" && (
            <Field label="Votre nom" error={fe("name")}>
              <Input name="name" autoComplete="name" required />
            </Field>
          )}
          <Field label="Email" error={fe("email")}>
            <Input name="email" type="email" autoComplete="email" required />
          </Field>
          <Field label="Mot de passe" error={fe("password")} hint={mode === "register" ? "8 caractères minimum" : undefined}>
            <Input
              name="password"
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              required
            />
          </Field>
          {mode === "register" && (
            <Field
              label="Téléphone de contact (optionnel)"
              error={fe("contactPhone")}
              hint="Affiché sur l'écran d'un appareil en mode perdu, pour qu'on puisse vous appeler. Mettez un numéro joignable sur un autre téléphone."
            >
              <Input name="contactPhone" type="tel" autoComplete="tel" placeholder="+261 34 00 000 00" />
            </Field>
          )}
          <Button type="submit" className="w-full" loading={loading}>
            {mode === "login" ? "Se connecter" : "Créer mon compte"}
          </Button>
        </form>
      </Card>
      <p className="mt-4 text-center text-sm text-muted">
        {mode === "login" ? (
          <>Pas encore de compte ? <Link className="font-semibold text-brand-600" href="/inscription">Inscription</Link></>
        ) : (
          <>Déjà inscrit ? <Link className="font-semibold text-brand-600" href="/connexion">Connexion</Link></>
        )}
      </p>
    </main>
  );
}
