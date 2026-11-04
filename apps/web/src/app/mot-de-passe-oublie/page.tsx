"use client";

import { useState, type FormEvent } from "react";
import { AuthShell } from "@/components/AuthShell";
import { Alert, Button, Field, Input } from "@/components/ui";
import { api } from "@/lib/api-client";

export default function ForgotPasswordPage() {
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const r = await api<{ message: string }>("/api/auth/forgot", { body: Object.fromEntries(new FormData(e.currentTarget)) });
      setDone(r.message);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Mot de passe oublié">
      {done ? (
        <div className="space-y-3">
          <Alert tone="green">{done}</Alert>
          <p className="text-sm text-muted">Pensez à regarder dans les spams. Le lien est valable 1 heure.</p>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <p className="text-sm text-muted">Indiquez l&apos;email de votre compte : nous vous enverrons un lien pour choisir un nouveau mot de passe.</p>
          {error && <Alert>{error}</Alert>}
          <Field label="Email">
            <Input name="email" type="email" autoComplete="email" required />
          </Field>
          <Button type="submit" className="w-full" loading={loading}>Envoyer le lien</Button>
        </form>
      )}
    </AuthShell>
  );
}
