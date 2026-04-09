"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { loginWithPassword } from "@/features/auth/api";
import { getStoredSession } from "@/features/auth/session";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("admin@studio.com");
  const [password, setPassword] = useState("Admin123!");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);

  useEffect(() => {
    if (getStoredSession()) {
      router.replace("/dashboard");
    }
  }, [router]);

  useEffect(() => {
    const reason = searchParams.get("reason");
    if (reason === "expired") {
      setSessionNotice("Sessione scaduta. Effettua di nuovo il login.");
      return;
    }
    if (reason === "invalid") {
      setSessionNotice("Sessione non valida. Effettua di nuovo il login.");
      return;
    }
    if (reason === "unauthorized") {
      setSessionNotice("Autenticazione richiesta. Effettua il login.");
      return;
    }
    setSessionNotice(null);
  }, [searchParams]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await loginWithPassword(email.trim(), password);
      router.replace("/dashboard");
    } catch (submitError) {
      const message =
        submitError instanceof Error ? submitError.message : "Errore durante il login.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-8">
      <section className="w-full max-w-md rounded-[var(--radius-xl)] border border-[var(--ui-border)] bg-[var(--ui-panel-solid)] p-6 shadow-[var(--shadow-soft)] sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--ui-muted)]">
          HALO
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Accesso gestionale studio
        </h1>
        <p className="mt-2 text-sm text-[var(--ui-muted)]">
          Inserisci le credenziali per accedere all&apos;area operativa.
        </p>

        {sessionNotice && <p className="halo-alert halo-alert-warning mt-4">{sessionNotice}</p>}

        <form className="mt-5 space-y-4" onSubmit={onSubmit}>
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="login-email">
              Email
            </label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="halo-input"
              autoComplete="email"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="login-password">
              Password
            </label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="halo-input"
              autoComplete="current-password"
              required
            />
          </div>

          {error && <p className="halo-alert halo-alert-danger">{error}</p>}

          <button type="submit" className="halo-btn-primary w-full px-4 py-2.5" disabled={loading}>
            {loading ? "Accesso in corso..." : "Accedi"}
          </button>
        </form>
      </section>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center px-4 py-8">
          <p className="text-sm text-[var(--ui-muted)]">Caricamento accesso...</p>
        </main>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
