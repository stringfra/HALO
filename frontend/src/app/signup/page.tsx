"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  listSignupBusinessTypes,
  signupTenantOwner,
  type SignupBusinessType,
} from "@/features/auth/api";
import { getStoredSession } from "@/features/auth/session";

type SignupFormState = {
  nome: string;
  cognome: string;
  email: string;
  password: string;
  tenant_name: string;
  business_type: string;
};

const initialState: SignupFormState = {
  nome: "",
  cognome: "",
  email: "",
  password: "",
  tenant_name: "",
  business_type: "",
};

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState<SignupFormState>(initialState);
  const [businessTypes, setBusinessTypes] = useState<SignupBusinessType[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (getStoredSession()) {
      router.replace("/");
      return;
    }

    let cancelled = false;
    setLoadingCatalog(true);
    setError(null);

    void listSignupBusinessTypes()
      .then((items) => {
        if (cancelled) {
          return;
        }
        setBusinessTypes(items);
      })
      .catch((catalogError: Error) => {
        if (cancelled) {
          return;
        }
        setError(catalogError.message || "Errore caricando categorie attivita.");
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingCatalog(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [router]);

  const canSubmit = useMemo(
    () =>
      !loadingCatalog &&
      !loadingSubmit &&
      form.nome.trim().length > 0 &&
      form.cognome.trim().length > 0 &&
      form.email.trim().length > 0 &&
      form.password.trim().length > 0 &&
      form.tenant_name.trim().length > 0 &&
      form.business_type.trim().length > 0,
    [form, loadingCatalog, loadingSubmit],
  );

  function updateField<K extends keyof SignupFormState>(key: K, value: SignupFormState[K]) {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }

    setLoadingSubmit(true);
    setError(null);
    try {
      await signupTenantOwner({
        nome: form.nome.trim(),
        cognome: form.cognome.trim(),
        email: form.email.trim(),
        password: form.password,
        tenant_name: form.tenant_name.trim(),
        business_type: form.business_type.trim(),
      });
      router.replace("/");
    } catch (submitError) {
      const message =
        submitError instanceof Error ? submitError.message : "Errore durante la registrazione.";
      setError(message);
    } finally {
      setLoadingSubmit(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-8">
      <section className="grid w-full max-w-[1080px] overflow-hidden rounded-[1.3rem] border border-[var(--ui-border)] bg-[var(--ui-panel-solid)] shadow-[var(--shadow-panel)] md:grid-cols-[1.1fr_1fr]">
        <aside className="hidden bg-[linear-gradient(160deg,#0b4f6c,#176087)] p-8 text-white md:block">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/70">
            HALO Onboarding
          </p>
          <h1 className="mt-3 text-[1.7rem] font-semibold leading-tight">
            Crea il tuo tenant
            <br />
            con categoria attivita
          </h1>
          <p className="mt-4 max-w-[34ch] text-sm text-white/80">
            Registri azienda e owner in un unico passaggio. La categoria scelta attiva il bundle
            funzionale iniziale.
          </p>
        </aside>

        <div className="p-6 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--ui-muted)]">
            Registrazione
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--ui-text)]">
            Nuova azienda
          </h2>
          <p className="mt-2 text-sm text-[var(--ui-muted)]">
            Compila tutti i campi. La categoria attivita e obbligatoria.
          </p>

          <form className="mt-5 space-y-4" onSubmit={onSubmit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="signup-nome">
                  Nome
                </label>
                <input
                  id="signup-nome"
                  type="text"
                  className="halo-input"
                  value={form.nome}
                  onChange={(event) => updateField("nome", event.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="signup-cognome">
                  Cognome
                </label>
                <input
                  id="signup-cognome"
                  type="text"
                  className="halo-input"
                  value={form.cognome}
                  onChange={(event) => updateField("cognome", event.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="signup-tenant-name">
                Nome azienda
              </label>
              <input
                id="signup-tenant-name"
                type="text"
                className="halo-input"
                value={form.tenant_name}
                onChange={(event) => updateField("tenant_name", event.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="signup-business-type">
                Categoria attivita
              </label>
              <select
                id="signup-business-type"
                className="halo-select"
                value={form.business_type}
                onChange={(event) => updateField("business_type", event.target.value)}
                required
                disabled={loadingCatalog}
              >
                <option value="">
                  {loadingCatalog ? "Caricamento categorie..." : "Seleziona categoria"}
                </option>
                {businessTypes.map((entry) => (
                  <option key={entry.key} value={entry.key}>
                    {entry.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="signup-email">
                Email
              </label>
              <input
                id="signup-email"
                type="email"
                className="halo-input"
                value={form.email}
                onChange={(event) => updateField("email", event.target.value)}
                autoComplete="email"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="signup-password">
                Password
              </label>
              <input
                id="signup-password"
                type="password"
                className="halo-input"
                value={form.password}
                onChange={(event) => updateField("password", event.target.value)}
                autoComplete="new-password"
                required
              />
              <p className="text-xs text-[var(--ui-muted)]">
                Minimo 8 caratteri con maiuscola, minuscola, numero e simbolo.
              </p>
            </div>

            {error ? <p className="halo-alert halo-alert-danger">{error}</p> : null}

            <button
              type="submit"
              className="halo-btn-primary w-full px-4 py-2.5"
              disabled={!canSubmit}
            >
              {loadingSubmit ? "Creazione account..." : "Crea azienda e accedi"}
            </button>
          </form>

          <p className="mt-4 text-sm text-[var(--ui-muted)]">
            Hai gia un account?{" "}
            <Link href="/login" className="font-semibold text-[var(--ui-accent)]">
              Torna al login
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
