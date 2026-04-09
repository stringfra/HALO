"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { useBootstrap } from "@/features/bootstrap/use-bootstrap";
import {
  createProdotto,
  deleteProdotto,
  listProdotti,
  type Prodotto,
  updateProdotto,
} from "./api";

type FormState = {
  nome: string;
  quantita: string;
  sogliaMinima: string;
};

const emptyForm: FormState = {
  nome: "",
  quantita: "",
  sogliaMinima: "",
};

function parseStrictNonNegativeInt(value: string) {
  const normalized = value.trim();
  if (!/^\d+$/.test(normalized)) {
    return null;
  }

  const parsed = Number.parseInt(normalized, 10);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 1000000) {
    return null;
  }

  return parsed;
}

export function MagazzinoManager() {
  const { data: bootstrap } = useBootstrap();
  const [prodotti, setProdotti] = useState<Prodotto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Prodotto | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const inventorySingular = bootstrap?.labels?.inventory_singular || "Prodotto";
  const inventoryPlural = bootstrap?.labels?.inventory_plural || "Magazzino";

  const sortedProducts = useMemo(
    () => [...prodotti].sort((a, b) => b.id - a.id),
    [prodotti],
  );

  const sottoSogliaCount = useMemo(
    () => prodotti.filter((product) => product.sotto_soglia).length,
    [prodotti],
  );

  const prodottiSottoSoglia = useMemo(
    () =>
      prodotti
        .filter((product) => product.sotto_soglia)
        .sort((a, b) => b.da_riordinare - a.da_riordinare),
    [prodotti],
  );
  const totalUnits = useMemo(
    () => prodotti.reduce((total, product) => total + product.quantita, 0),
    [prodotti],
  );

  const loadProdotti = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listProdotti();
      setProdotti(data);
    } catch (loadError) {
      const message =
        loadError instanceof Error
          ? loadError.message
          : "Errore caricando i prodotti.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProdotti();
  }, [loadProdotti]);

  function handleChange<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
  }

  function startEdit(product: Prodotto) {
    setEditingId(product.id);
    setError(null);
    setSuccess(null);
    setForm({
      nome: product.nome,
      quantita: String(product.quantita),
      sogliaMinima: String(product.soglia_minima),
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const nome = form.nome.trim().replace(/\s+/g, " ");
    const quantita = parseStrictNonNegativeInt(form.quantita);
    const sogliaMinima = parseStrictNonNegativeInt(form.sogliaMinima);

    if (nome.length < 2 || nome.length > 120) {
      setError(`Nome ${inventorySingular.toLowerCase()} non valido (2-120 caratteri).`);
      return;
    }
    if (quantita === null) {
      setError("La quantita deve essere un intero >= 0.");
      return;
    }
    if (sogliaMinima === null) {
      setError("La soglia minima deve essere un intero >= 0.");
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        await updateProdotto(editingId, {
          nome,
          quantita,
          soglia_minima: sogliaMinima,
        });
        setSuccess(`${inventorySingular} aggiornato.`);
      } else {
        await createProdotto({
          nome,
          quantita,
          soglia_minima: sogliaMinima,
        });
        setSuccess(`${inventorySingular} creato.`);
      }

      resetForm();
      await loadProdotti();
    } catch (saveError) {
      const message =
        saveError instanceof Error
          ? saveError.message
          : "Operazione non riuscita.";
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  function openDeleteDialog(prodotto: Prodotto) {
    setDeleteTarget(prodotto);
  }

  function closeDeleteDialog() {
    if (deleting) {
      return;
    }
    setDeleteTarget(null);
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) {
      return;
    }

    const deleteId = deleteTarget.id;
    setDeleting(true);
    setError(null);
    setSuccess(null);
    try {
      await deleteProdotto(deleteId);
      if (editingId === deleteId) {
        resetForm();
      }
      setSuccess(`${inventorySingular} eliminato.`);
      setDeleteTarget(null);
      await loadProdotti();
    } catch (deleteError) {
      const message =
        deleteError instanceof Error
          ? deleteError.message
          : "Eliminazione non riuscita.";
      setError(message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section className="halo-page halo-reveal">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--ui-muted)]">
        {`${inventoryPlural} · controllo admin`}
      </p>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight">
        {`Gestione ${inventoryPlural.toLowerCase()}`}
      </h2>
      <p className="mt-2 max-w-[70ch] text-sm text-[var(--ui-muted)]">
        Monitoraggio scorte, priorita di riordino e aggiornamento inventario centrale dello studio.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <article className="rounded-[var(--radius-md)] border border-[var(--ui-border)] bg-white p-3">
          <p className="text-xs uppercase tracking-[0.1em] text-[var(--ui-muted)]">{inventoryPlural}</p>
          <p className="mt-1 text-2xl font-semibold">{sortedProducts.length}</p>
        </article>
        <article className="rounded-[var(--radius-md)] border border-[var(--ui-border)] bg-white p-3">
          <p className="text-xs uppercase tracking-[0.1em] text-[var(--ui-muted)]">Unita totali</p>
          <p className="mt-1 text-2xl font-semibold">{totalUnits}</p>
        </article>
        <article className="rounded-[var(--radius-md)] border border-[var(--ui-border)] bg-white p-3">
          <p className="text-xs uppercase tracking-[0.1em] text-[var(--ui-muted)]">Sotto soglia</p>
          <p className="mt-1 text-2xl font-semibold">{sottoSogliaCount}</p>
        </article>
      </div>

      <div className="mt-4">
        <Link href="/impostazioni" className="halo-btn-secondary px-4 py-2 text-sm">
          Torna a impostazioni admin
        </Link>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[380px_1fr]">
        <article className="halo-panel">
          <h3 className="text-sm font-semibold">
            {editingId ? `Modifica ${inventorySingular.toLowerCase()}` : `Nuovo ${inventorySingular.toLowerCase()}`}
          </h3>

          <form className="mt-4 grid gap-3" onSubmit={handleSubmit}>
            <label className="grid gap-1 text-sm">
              <span className="font-medium">{`Nome ${inventorySingular.toLowerCase()} *`}</span>
              <input
                value={form.nome}
                onChange={(e) => handleChange("nome", e.target.value)}
                placeholder="es. Guanti nitrile M"
                className="halo-input"
              />
            </label>

            <label className="grid gap-1 text-sm">
              <span className="font-medium">Quantita *</span>
              <input
                type="number"
                min={0}
                value={form.quantita}
                onChange={(e) => handleChange("quantita", e.target.value)}
                className="halo-input"
              />
            </label>

            <label className="grid gap-1 text-sm">
              <span className="font-medium">Soglia minima *</span>
              <input
                type="number"
                min={0}
                value={form.sogliaMinima}
                onChange={(e) => handleChange("sogliaMinima", e.target.value)}
                className="halo-input"
              />
            </label>

            <div className="mt-1 flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={saving}
                className="halo-btn-primary px-4 py-2 text-sm"
              >
                {saving ? "Salvataggio..." : editingId ? "Aggiorna" : "Crea"}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="halo-btn-secondary px-4 py-2 text-sm"
              >
                Reset
              </button>
            </div>
          </form>
        </article>

        <article className="halo-panel">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">{`Lista ${inventoryPlural.toLowerCase()}`}</h3>
            <p className="text-xs text-[var(--ui-muted)]">{sortedProducts.length} record</p>
          </div>

          {sottoSogliaCount > 0 && (
            <div className="halo-alert halo-alert-warning mt-3">
              <p className="font-semibold">
                {`Attenzione: ${sottoSogliaCount} ${inventorySingular.toLowerCase()}/i ordinare.`}
              </p>
              <p className="mt-1 text-xs">
                Priorita riordino:{" "}
                {prodottiSottoSoglia
                  .slice(0, 3)
                  .map((item) => `${item.nome} (+${item.da_riordinare})`)
                  .join(", ")}
              </p>
            </div>
          )}

          {error && (
            <p className="halo-alert halo-alert-danger mt-3">
              {error}
            </p>
          )}
          {success && (
            <p className="halo-alert halo-alert-success mt-3">
              {success}
            </p>
          )}

          <div className="halo-table-wrap mt-4">
            <table className="halo-table">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">ID</th>
                  <th className="px-4 py-3 text-left font-semibold">{inventorySingular}</th>
                  <th className="px-4 py-3 text-left font-semibold">Quantita</th>
                  <th className="px-4 py-3 text-left font-semibold">Soglia</th>
                  <th className="px-4 py-3 text-left font-semibold">Riordino</th>
                  <th className="px-4 py-3 text-left font-semibold">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td className="px-4 py-6 text-[var(--ui-muted)]" colSpan={6}>
                      {`Caricamento ${inventoryPlural.toLowerCase()}...`}
                    </td>
                  </tr>
                ) : sortedProducts.length === 0 ? (
                  <tr>
                    <td className="px-4 py-6 text-[var(--ui-muted)]" colSpan={6}>
                      {`Nessun ${inventorySingular.toLowerCase()} presente.`}
                    </td>
                  </tr>
                ) : (
                  sortedProducts.map((product) => (
                    <tr
                      key={product.id}
                      className={`${
                        product.sotto_soglia ? "bg-amber-50/70" : ""
                      }`}
                    >
                      <td className="px-4 py-3 font-medium">{product.id}</td>
                      <td className="px-4 py-3">{product.nome}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span>{product.quantita}</span>
                          {product.sotto_soglia && (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                              ordinare
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">{product.soglia_minima}</td>
                      <td className="px-4 py-3">
                        {product.da_riordinare > 0 ? `+${product.da_riordinare}` : "-"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => startEdit(product)}
                            className="halo-btn-secondary px-3 py-1.5 text-xs"
                          >
                            Modifica
                          </button>
                          <button
                            type="button"
                            onClick={() => openDeleteDialog(product)}
                            className="halo-btn-danger px-3 py-1.5 text-xs"
                          >
                            Elimina
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </article>
      </div>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={`Conferma eliminazione ${inventorySingular.toLowerCase()}`}
        description={
          deleteTarget
            ? `Vuoi eliminare il ${inventorySingular.toLowerCase()} ${deleteTarget.nome}?`
            : ""
        }
        confirmLabel={`Elimina ${inventorySingular.toLowerCase()}`}
        isConfirming={deleting}
        onConfirm={() => void handleConfirmDelete()}
        onCancel={closeDeleteDialog}
      />
    </section>
  );
}
