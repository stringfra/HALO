"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from "react";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { getSessionSnapshot, subscribeToSession } from "@/features/auth/session";
import { useBootstrap } from "@/features/bootstrap/use-bootstrap";
import { listDentisti, type UserListItem } from "@/features/users/api";
import {
  createPaziente,
  deletePaziente,
  listPazienti,
  type Paziente,
  type PazientePayload,
  updatePaziente,
} from "./api";

type FormState = {
  nome: string;
  cognome: string;
  medico_id: string;
  telefono: string;
  email: string;
  note: string;
};

const emptyForm: FormState = {
  nome: "",
  cognome: "",
  medico_id: "",
  telefono: "",
  email: "",
  note: "",
};

const phonePattern = /^[+0-9()\-\s.]{6,30}$/;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizePayload(form: FormState): PazientePayload {
  return {
    nome: form.nome.trim(),
    cognome: form.cognome.trim(),
    medico_id: Number.parseInt(form.medico_id, 10),
    telefono: form.telefono.trim() || undefined,
    email: form.email.trim() || undefined,
    note: form.note.trim() || undefined,
  };
}

export function PazientiManager() {
  const session = useSyncExternalStore(subscribeToSession, getSessionSnapshot, () => null);
  const { data: bootstrap } = useBootstrap();
  const role = session?.ruolo ?? null;
  const canManagePatients = role === "ADMIN" || role === "SEGRETARIO";
  const canViewClinicalSheet = role === "DENTISTA" || role === "DIPENDENTE";
  const [pazienti, setPazienti] = useState<Paziente[]>([]);
  const [dentisti, setDentisti] = useState<UserListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Paziente | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);

  const sortedPazienti = useMemo(
    () => [...pazienti].sort((a, b) => b.id - a.id),
    [pazienti],
  );
  const selectedPatient = useMemo(
    () => sortedPazienti.find((item) => item.id === selectedPatientId) ?? null,
    [selectedPatientId, sortedPazienti],
  );
  const clientSingular = bootstrap?.labels?.client_singular || "Paziente";
  const clientPlural = bootstrap?.labels?.client_plural || "Pazienti";
  const ownerSingular = bootstrap?.labels?.owner_singular || "Dottore";
  const tableColumnCount = canManagePatients || canViewClinicalSheet ? 5 : 4;

  const loadPazienti = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await listPazienti();
      setPazienti(data);
    } catch (loadError) {
      const message =
        loadError instanceof Error
          ? loadError.message
          : "Errore caricando i pazienti.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDentisti = useCallback(async () => {
    if (!canManagePatients) {
      setDentisti([]);
      return;
    }

    try {
      const data = await listDentisti();
      setDentisti(data);
    } catch (loadError) {
      const message =
        loadError instanceof Error
          ? loadError.message
          : `Errore caricando i ${ownerSingular.toLowerCase()}.`;
      setError(message);
    }
  }, [canManagePatients, ownerSingular]);

  useEffect(() => {
    void loadPazienti();
  }, [loadPazienti]);

  useEffect(() => {
    void loadDentisti();
  }, [loadDentisti]);

  useEffect(() => {
    if (!canViewClinicalSheet) {
      setSelectedPatientId(null);
      return;
    }

    if (sortedPazienti.length === 0) {
      if (selectedPatientId !== null) {
        setSelectedPatientId(null);
      }
      return;
    }

    const hasSelected =
      selectedPatientId !== null &&
      sortedPazienti.some((patient) => patient.id === selectedPatientId);

    if (!hasSelected) {
      setSelectedPatientId(sortedPazienti[0].id);
    }
  }, [canViewClinicalSheet, selectedPatientId, sortedPazienti]);

  function handleChange<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function startEdit(paziente: Paziente) {
    setEditingId(paziente.id);
    setSuccess(null);
    setError(null);
    setForm({
      nome: paziente.nome ?? "",
      cognome: paziente.cognome ?? "",
      medico_id: paziente.medico_id ? String(paziente.medico_id) : "",
      telefono: paziente.telefono ?? "",
      email: paziente.email ?? "",
      note: paziente.note ?? "",
    });
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const payload = normalizePayload(form);
    if (!payload.nome || !payload.cognome) {
      setError("Nome e cognome sono obbligatori.");
      return;
    }
    if (!Number.isInteger(payload.medico_id) || payload.medico_id <= 0) {
      setError(`Seleziona un ${ownerSingular.toLowerCase()} valido.`);
      return;
    }
    if (payload.nome.length < 2 || payload.nome.length > 100) {
      setError("Nome non valido (2-100 caratteri).");
      return;
    }
    if (payload.cognome.length < 2 || payload.cognome.length > 100) {
      setError("Cognome non valido (2-100 caratteri).");
      return;
    }
    if (payload.telefono && !phonePattern.test(payload.telefono)) {
      setError("Telefono non valido.");
      return;
    }
    if (
      payload.email &&
      (payload.email.length > 255 || !emailPattern.test(payload.email))
    ) {
      setError("Email non valida.");
      return;
    }
    if (payload.note && payload.note.length > 2000) {
      setError("Note non valide (massimo 2000 caratteri).");
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        await updatePaziente(editingId, payload);
        setSuccess(`${clientSingular} aggiornato.`);
      } else {
        await createPaziente(payload);
        setSuccess(`${clientSingular} creato.`);
      }

      resetForm();
      await loadPazienti();
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : "Operazione non riuscita.";
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  function openDeleteDialog(paziente: Paziente) {
    setDeleteTarget(paziente);
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
      await deletePaziente(deleteId);
      if (editingId === deleteId) {
        resetForm();
      }
      setSuccess(`${clientSingular} eliminato.`);
      setDeleteTarget(null);
      await loadPazienti();
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
        {clientPlural}
      </p>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight">
        {`Anagrafica ${clientPlural.toLowerCase()}`}
      </h2>

      <div className={`mt-5 grid gap-5 ${canManagePatients ? "xl:grid-cols-[360px_1fr]" : ""}`}>
        {canManagePatients ? (
          <article className="halo-panel">
            <h3 className="text-sm font-semibold">
              {editingId ? `Modifica ${clientSingular.toLowerCase()}` : `Nuovo ${clientSingular.toLowerCase()}`}
            </h3>
            <form className="mt-4 grid gap-3" onSubmit={handleSubmit}>
              <label className="grid gap-1 text-sm">
                <span className="font-medium">Nome *</span>
                <input
                  value={form.nome}
                  onChange={(event) => handleChange("nome", event.target.value)}
                  className="halo-input"
                  placeholder="Nome"
                />
              </label>

              <label className="grid gap-1 text-sm">
                <span className="font-medium">Cognome *</span>
                <input
                  value={form.cognome}
                  onChange={(event) => handleChange("cognome", event.target.value)}
                  className="halo-input"
                  placeholder="Cognome"
                />
              </label>

              <label className="grid gap-1 text-sm">
                <span className="font-medium">{ownerSingular} *</span>
                <select
                  value={form.medico_id}
                  onChange={(event) => handleChange("medico_id", event.target.value)}
                  className="halo-input"
                >
                  <option value="">{`Seleziona un ${ownerSingular.toLowerCase()}`}</option>
                  {dentisti.map((dentista) => (
                    <option key={dentista.id} value={dentista.id}>
                      {dentista.nome}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1 text-sm">
                <span className="font-medium">Telefono</span>
                <input
                  value={form.telefono}
                  onChange={(event) => handleChange("telefono", event.target.value)}
                  className="halo-input"
                  placeholder="+39 ..."
                />
              </label>

              <label className="grid gap-1 text-sm">
                <span className="font-medium">Email</span>
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) => handleChange("email", event.target.value)}
                  className="halo-input"
                  placeholder="email@example.com"
                />
              </label>

              <label className="grid gap-1 text-sm">
                <span className="font-medium">Note</span>
                <textarea
                  value={form.note}
                  onChange={(event) => handleChange("note", event.target.value)}
                  rows={3}
                  className="halo-textarea"
                  placeholder="Annotazioni cliniche o amministrative"
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
        ) : (
          <article className="halo-panel">
            <h3 className="text-sm font-semibold">Vista schede pazienti</h3>
            <p className="mt-2 text-sm text-[var(--ui-muted)]">
              {`Come ${ownerSingular.toLowerCase()} puoi consultare i dati ${clientSingular.toLowerCase()} collegati alla tua agenda.`}
              Creazione, modifica ed eliminazione anagrafiche sono riservate a
              amministrazione e segreteria.
            </p>

            <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--ui-border)] bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--ui-muted)]">
                {`Scheda ${clientSingular.toLowerCase()}`}
              </p>
              {!selectedPatient ? (
                <p className="mt-2 text-sm text-[var(--ui-muted)]">
                  {`Seleziona un ${clientSingular.toLowerCase()} dalla tabella per visualizzare la scheda.`}
                </p>
              ) : (
                <div className="mt-3 space-y-2 text-sm">
                  <p>
                    <span className="font-semibold">{`${clientSingular}:`}</span>{" "}
                    {selectedPatient.nome} {selectedPatient.cognome}
                  </p>
                  <p>
                    <span className="font-semibold">Telefono:</span>{" "}
                    {selectedPatient.telefono || "-"}
                  </p>
                  <p>
                    <span className="font-semibold">{`${ownerSingular}:`}</span>{" "}
                    {selectedPatient.medico_nome || "-"}
                  </p>
                  <p>
                    <span className="font-semibold">Email:</span>{" "}
                    {selectedPatient.email || "-"}
                  </p>
                  <div className="rounded-[var(--radius-sm)] border border-[var(--ui-border)] bg-[var(--ui-panel-solid)] p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--ui-muted)]">
                      Note cliniche
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--ui-text)]">
                      {selectedPatient.note?.trim() || "Nessuna nota clinica disponibile."}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </article>
        )}

        <article className="halo-panel">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">{`Tabella ${clientPlural.toLowerCase()}`}</h3>
            <p className="text-xs text-[var(--ui-muted)]">{sortedPazienti.length} record</p>
          </div>

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
                  <th className="px-4 py-3 text-left font-semibold">{clientSingular}</th>
                  <th className="px-4 py-3 text-left font-semibold">{ownerSingular}</th>
                  <th className="px-4 py-3 text-left font-semibold">Contatti</th>
                  <th className="px-4 py-3 text-left font-semibold">Note</th>
                  {canManagePatients && (
                    <th className="px-4 py-3 text-left font-semibold">Azioni</th>
                  )}
                  {!canManagePatients && canViewClinicalSheet && (
                    <th className="px-4 py-3 text-left font-semibold">Scheda</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td className="px-4 py-6 text-[var(--ui-muted)]" colSpan={tableColumnCount}>
                      {`Caricamento ${clientPlural.toLowerCase()}...`}
                    </td>
                  </tr>
                ) : sortedPazienti.length === 0 ? (
                  <tr>
                    <td className="px-4 py-6 text-[var(--ui-muted)]" colSpan={tableColumnCount}>
                      {`Nessun ${clientSingular.toLowerCase()} presente.`}
                    </td>
                  </tr>
                ) : (
                  sortedPazienti.map((paziente) => (
                    <tr key={paziente.id}>
                      <td className="px-4 py-3">
                        <p className="font-medium">
                          {paziente.nome} {paziente.cognome}
                        </p>
                        <p className="text-xs text-[var(--ui-muted)]">ID: {paziente.id}</p>
                      </td>
                      <td className="px-4 py-3 text-[var(--ui-muted)]">
                        <p>{paziente.medico_nome || "-"}</p>
                      </td>
                      <td className="px-4 py-3 text-[var(--ui-muted)]">
                        <p>{paziente.telefono || "-"}</p>
                        <p>{paziente.email || "-"}</p>
                      </td>
                      <td className="max-w-[260px] px-4 py-3 text-[var(--ui-muted)]">
                        <p className="line-clamp-2">{paziente.note || "-"}</p>
                      </td>
                      {canManagePatients && (
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => startEdit(paziente)}
                              className="halo-btn-secondary px-3 py-1.5 text-xs"
                            >
                              Modifica
                            </button>
                            <button
                              type="button"
                              onClick={() => openDeleteDialog(paziente)}
                              className="halo-btn-danger px-3 py-1.5 text-xs"
                            >
                              Elimina
                            </button>
                          </div>
                        </td>
                      )}
                      {!canManagePatients && canViewClinicalSheet && (
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => setSelectedPatientId(paziente.id)}
                            className={`px-3 py-1.5 text-xs ${
                              selectedPatientId === paziente.id
                                ? "halo-btn-primary"
                                : "halo-btn-secondary"
                            }`}
                          >
                            {selectedPatientId === paziente.id ? "Scheda aperta" : "Apri scheda"}
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </article>
      </div>

      {canManagePatients && (
        <ConfirmDialog
          open={Boolean(deleteTarget)}
          title={`Conferma eliminazione ${clientSingular.toLowerCase()}`}
          description={
            deleteTarget
              ? `Vuoi eliminare ${deleteTarget.nome} ${deleteTarget.cognome}?`
              : ""
          }
          confirmLabel={`Elimina ${clientSingular.toLowerCase()}`}
          isConfirming={deleting}
          onConfirm={() => void handleConfirmDelete()}
          onCancel={closeDeleteDialog}
        />
      )}
    </section>
  );
}
