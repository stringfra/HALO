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
import {
  createUser,
  deleteUser,
  listUsers,
  updateUser,
  type UserListItem,
} from "./api";

type UserRole = "ADMIN" | "DENTISTA" | "DIPENDENTE" | "SEGRETARIO";

type UserFormState = {
  nome: string;
  email: string;
  password: string;
  ruolo: UserRole;
};

const initialForm: UserFormState = {
  nome: "",
  email: "",
  password: "",
  ruolo: "DIPENDENTE",
};

function isStrongPassword(value: string) {
  const normalized = value.trim();
  if (normalized.length < 8 || normalized.length > 255) {
    return false;
  }

  return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])\S+$/.test(normalized);
}

function formatCreatedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function UsersListPanel() {
  const session = useSyncExternalStore(subscribeToSession, getSessionSnapshot, () => null);
  const currentUserId = session?.userId ?? null;
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [form, setForm] = useState<UserFormState>(initialForm);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UserListItem | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await listUsers();
      setUsers(data);
    } catch (loadError) {
      const message =
        loadError instanceof Error ? loadError.message : "Errore caricando utenti.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const sortedUsers = useMemo(() => [...users].sort((a, b) => a.id - b.id), [users]);

  function handleChange<K extends keyof UserFormState>(key: K, value: UserFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function startEditUser(user: UserListItem) {
    setEditingUserId(user.id);
    setSubmitError(null);
    setSubmitSuccess(null);
    setForm({
      nome: user.nome,
      email: user.email,
      password: "",
      ruolo: user.ruolo,
    });
  }

  function cancelEdit() {
    setEditingUserId(null);
    setForm(initialForm);
    setSubmitError(null);
    setSubmitSuccess(null);
  }

  function openDeleteDialog(user: UserListItem) {
    if (currentUserId === user.id) {
      setSubmitError("Non puoi eliminare il tuo utente corrente.");
      return;
    }

    setDeleteTarget(user);
    setSubmitError(null);
    setSubmitSuccess(null);
  }

  function closeDeleteDialog() {
    if (deleting) {
      return;
    }
    setDeleteTarget(null);
  }

  async function handleSaveUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);
    setSubmitSuccess(null);

    const nome = form.nome.trim();
    const email = form.email.trim();
    const password = form.password.trim();

    if (nome.length < 2) {
      setSubmitError("Nome non valido (minimo 2 caratteri).");
      return;
    }
    if (!email || !email.includes("@")) {
      setSubmitError("Email non valida.");
      return;
    }
    if (!editingUserId && !isStrongPassword(password)) {
      setSubmitError(
        "Password debole: usa almeno 8 caratteri con maiuscola, minuscola, numero e simbolo.",
      );
      return;
    }
    if (editingUserId && password.length > 0 && !isStrongPassword(password)) {
      setSubmitError(
        "Password debole: usa almeno 8 caratteri con maiuscola, minuscola, numero e simbolo.",
      );
      return;
    }

    setSaving(true);
    try {
      if (editingUserId) {
        const payload: {
          nome: string;
          email: string;
          ruolo: UserRole;
          password?: string;
        } = {
          nome,
          email,
          ruolo: form.ruolo,
        };

        if (password.length > 0) {
          payload.password = password;
        }

        const updated = await updateUser(editingUserId, payload);
        setSubmitSuccess(`Utente aggiornato con successo (ID ${updated.id}).`);
      } else {
        const created = await createUser({
          nome,
          email,
          password,
          ruolo: form.ruolo,
        });
        setSubmitSuccess(`Utente creato con successo (ID ${created.id}).`);
      }

      setEditingUserId(null);
      setForm(initialForm);
      await loadUsers();
    } catch (saveError) {
      const message =
        saveError instanceof Error ? saveError.message : "Operazione utente non riuscita.";
      setSubmitError(message);
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) {
      return;
    }

    setDeleting(true);
    setSubmitError(null);
    setSubmitSuccess(null);

    try {
      const result = await deleteUser(deleteTarget.id);
      if (editingUserId === deleteTarget.id) {
        cancelEdit();
      }
      setSubmitSuccess(result.message);
      setDeleteTarget(null);
      await loadUsers();
    } catch (deleteError) {
      const message =
        deleteError instanceof Error ? deleteError.message : "Eliminazione utente non riuscita.";
      setSubmitError(message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <article className="halo-panel mt-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Utenti studio</h3>
        <button
          type="button"
          onClick={() => void loadUsers()}
          className="halo-btn-secondary px-3 py-1.5 text-xs"
        >
          Aggiorna
        </button>
      </div>

      {error && <p className="halo-alert halo-alert-danger mt-3">{error}</p>}
      {submitError && <p className="halo-alert halo-alert-danger mt-3">{submitError}</p>}
      {submitSuccess && <p className="halo-alert halo-alert-success mt-3">{submitSuccess}</p>}

      <form
        className="mt-4 grid gap-3 rounded-[var(--radius-md)] border border-[var(--ui-border)] bg-white p-4 sm:grid-cols-2"
        onSubmit={handleSaveUser}
      >
        <p className="sm:col-span-2 text-xs font-semibold uppercase tracking-[0.1em] text-[var(--ui-muted)]">
          {editingUserId ? `Modifica utente #${editingUserId}` : "Crea nuovo utente"}
        </p>

        <label className="grid gap-1 text-sm">
          <span className="font-medium">Nome *</span>
          <input
            value={form.nome}
            onChange={(event) => handleChange("nome", event.target.value)}
            className="halo-input"
            placeholder="Nome utente"
          />
        </label>

        <label className="grid gap-1 text-sm">
          <span className="font-medium">Email *</span>
          <input
            type="email"
            value={form.email}
            onChange={(event) => handleChange("email", event.target.value)}
            className="halo-input"
            placeholder="utente@studio.com"
          />
        </label>

        <label className="grid gap-1 text-sm">
          <span className="font-medium">Password {editingUserId ? "(opzionale)" : "*"}</span>
          <input
            type="password"
            value={form.password}
            onChange={(event) => handleChange("password", event.target.value)}
            className="halo-input"
            placeholder={
              editingUserId
                ? "Lascia vuoto per non cambiarla"
                : "Min 8 con A-z, 0-9 e simbolo"
            }
          />
          <span className="text-xs text-[var(--ui-muted)]">
            Regola: almeno 8 caratteri, 1 maiuscola, 1 minuscola, 1 numero, 1 simbolo.
          </span>
        </label>

        <label className="grid gap-1 text-sm">
          <span className="font-medium">Ruolo *</span>
          <select
            value={form.ruolo}
            onChange={(event) => handleChange("ruolo", event.target.value as UserRole)}
            className="halo-select"
          >
            <option value="ADMIN">ADMIN</option>
            <option value="DIPENDENTE">DIPENDENTE</option>
            <option value="SEGRETARIO">SEGRETARIO</option>
          </select>
        </label>

        <div className="sm:col-span-2">
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={saving} className="halo-btn-primary px-4 py-2 text-sm">
              {saving
                ? editingUserId
                  ? "Aggiornamento..."
                  : "Creazione..."
                : editingUserId
                  ? "Salva modifiche"
                  : "Crea utente"}
            </button>
            {editingUserId && (
              <button type="button" onClick={cancelEdit} className="halo-btn-secondary px-4 py-2 text-sm">
                Annulla modifica
              </button>
            )}
          </div>
        </div>
      </form>

      <div className="halo-table-wrap mt-4">
        <table className="halo-table">
          <thead>
            <tr>
              <th className="px-4 py-3 text-left font-semibold">ID</th>
              <th className="px-4 py-3 text-left font-semibold">Nome</th>
              <th className="px-4 py-3 text-left font-semibold">Email</th>
              <th className="px-4 py-3 text-left font-semibold">Ruolo</th>
              <th className="px-4 py-3 text-left font-semibold">Creato il</th>
              <th className="px-4 py-3 text-left font-semibold">Azioni</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="px-4 py-3 text-[var(--ui-muted)]" colSpan={6}>
                  Caricamento utenti...
                </td>
              </tr>
            ) : sortedUsers.length === 0 ? (
              <tr>
                <td className="px-4 py-3 text-[var(--ui-muted)]" colSpan={6}>
                  Nessun utente disponibile.
                </td>
              </tr>
            ) : (
              sortedUsers.map((user) => (
                <tr key={user.id}>
                  <td className="px-4 py-3 font-medium">{user.id}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span>{user.nome}</span>
                      {currentUserId === user.id && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                          tu
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">{user.email}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-[var(--ui-accent-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--ui-accent)]">
                      {user.ruolo}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[var(--ui-muted)]">
                    {formatCreatedAt(user.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => startEditUser(user)}
                        className="halo-btn-secondary px-3 py-1.5 text-xs"
                      >
                        Modifica
                      </button>
                      <button
                        type="button"
                        onClick={() => openDeleteDialog(user)}
                        className="halo-btn-danger px-3 py-1.5 text-xs"
                        disabled={currentUserId === user.id || (deleting && deleteTarget?.id === user.id)}
                      >
                        {currentUserId === user.id
                          ? "Utente corrente"
                          : deleting && deleteTarget?.id === user.id
                            ? "Eliminazione..."
                            : "Elimina"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Conferma eliminazione utente"
        description={
          deleteTarget
            ? `Vuoi eliminare l'utente ${deleteTarget.nome} (${deleteTarget.email})?`
            : ""
        }
        confirmLabel="Elimina utente"
        isConfirming={deleting}
        onConfirm={() => void handleConfirmDelete()}
        onCancel={closeDeleteDialog}
      />
    </article>
  );
}
