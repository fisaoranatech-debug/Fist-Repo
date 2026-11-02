"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { AuthShell } from "@/components/AuthShell";
import { Alert, Button, Field, Input } from "@/components/ui";
import { api, ApiError } from "@/lib/api-client";

function ResetForm() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") ?? "";
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    setError(null);
    setFieldError(null);
    if (f.password !== f.confirm) return setFieldError("Les deux mots de passe ne sont pas identiques.");
    setLoading(true);
    try {
      await api("/api/auth/reset", { body: { token, password: f.password } });
      router.replace("/appareils");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      if (err instanceof ApiError) setFieldError(err.details?.password?.[0] ?? null);
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <Alert>
        Lien incomplet. <Link href="/mot-de-passe-oublie" className="font-semibold underline">Refaire une demande</Link>
      </Alert>
    );
  }
  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {error && (
        <Alert>
          {error}{" "}
          {error.includes("plus valable") && <Link href="/mot-de-passe-oublie" className="font-semibold underline">Nouvelle demande</Link>}
        </Alert>
      )}
      <Field label="Nouveau mot de passe" hint="8 caractères minimum" error={fieldError ?? undefined}>
        <Input name="password" type="password" autoComplete="new-password" required />
      </Field>
      <Field label="Confirmez le mot de passe">
        <Input name="confirm" type="password" autoComplete="new-password" required />
      </Field>
      <Button type="submit" className="w-full" loading={loading}>Enregistrer et me connecter</Button>
      <p className="text-xs text-muted">Vos autres appareils connectés au site seront déconnectés.</p>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthShell title="Nouveau mot de passe">
      <Suspense>
        <ResetForm />
      </Suspense>
    </AuthShell>
  );
}
