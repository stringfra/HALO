"use client";

import Link from "next/link";
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
      router.replace("/");
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
      router.replace("/");
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
      <section className="grid w-full max-w-[980px] overflow-hidden rounded-[1.3rem] border border-[var(--ui-border)] bg-[var(--ui-panel-solid)] shadow-[var(--shadow-panel)] md:grid-cols-[1.05fr_1fr]">
        <aside className="hidden bg-[linear-gradient(160deg,#0f3d5e,#1d5c86)] p-8 text-white md:block">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/70">
            HALO Platform
          </p>
          <h1 className="mt-3 text-[1.75rem] font-semibold leading-tight">
            Gestionale studio
            <br />
            con vista operativa unica
          </h1>
          <p className="mt-4 max-w-[32ch] text-sm text-white/80">
            Agenda, pazienti, fatture e configurazioni aziendali in un unico workspace.
          </p>
          <div className="mt-8 grid gap-3">
            <div className="rounded-[0.85rem] border border-white/20 bg-white/10 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-white/70">Sicurezza</p>
              <p className="mt-1 text-sm">Sessione JWT e controllo permessi per ruolo.</p>
            </div>
            <div className="rounded-[0.85rem] border border-white/20 bg-white/10 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-white/70">Multi modulo</p>
              <p className="mt-1 text-sm">Flussi clinici e amministrativi collegati al backend esistente.</p>
            </div>
          </div>
        </aside>

        <div className="p-6 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--ui-muted)]">
            Accesso
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--ui-text)]">
            Bentornato
          </h2>
          <p className="mt-2 text-sm text-[var(--ui-muted)]">
            Inserisci le credenziali per entrare nell&apos;area operativa.
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
              {loading ? "Accesso in corso..." : "Accedi al gestionale"}
            </button>
          </form>

          <p className="mt-4 text-sm text-[var(--ui-muted)]">
            Non hai ancora un account?{" "}
            <Link href="/signup" className="font-semibold text-[var(--ui-accent)]">
              Crea nuova azienda
            </Link>
          </p>
        </div>
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
