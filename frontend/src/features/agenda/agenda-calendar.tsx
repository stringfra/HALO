"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type FormEvent,
  type CSSProperties,
} from "react";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { formatDateToDmy, parseProjectDate } from "@/lib/date-utils";
import { ProjectDateField } from "@/components/forms/project-date-field";
import { useBootstrap } from "@/features/bootstrap/use-bootstrap";
import { listPazienti, type Paziente } from "@/features/pazienti/api";
import {
  getSessionSnapshot,
  subscribeToSession,
} from "@/features/auth/session";
import {
  createAppuntamento,
  deleteAppuntamento,
  listAppuntamenti,
  updateAppuntamento,
  type AppointmentPayload,
  type BackendAppointment,
} from "./api";

type AgendaStatus = "in_attesa" | "confermato" | "completato" | "annullato";

type FormState = {
  paziente_id: string;
  data: string;
  ora: string;
  stato: AgendaStatus;
};

function createInitialForm(): FormState {
  return {
    paziente_id: "",
    data: formatDateToDmy(new Date()),
    ora: "",
    stato: "in_attesa",
  };
}

type UpcomingAppointment = BackendAppointment & {
  startAt: Date;
  patientLabel: string;
};

const dmyDatePattern = /^\d{2}\s\d{2}\s\d{4}$/;
const timePattern = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/;

function statusLabel(status: AgendaStatus) {
  if (status === "confermato") {
    return "Confermato";
  }
  if (status === "completato") {
    return "Completato";
  }
  if (status === "annullato") {
    return "Annullato";
  }
  return "In attesa";
}

function makeDate(dateKey: string, timeKey: string) {
  const parsedDate = parseProjectDate(dateKey);
  if (!parsedDate) {
    return null;
  }

  const [hours, minutes] = timeKey.split(":").map(Number);
  return new Date(
    parsedDate.getFullYear(),
    parsedDate.getMonth(),
    parsedDate.getDate(),
    Number.isNaN(hours) ? 0 : hours,
    Number.isNaN(minutes) ? 0 : minutes,
  );
}

function displayPatientName(appointment: BackendAppointment, clientSingular: string) {
  const nome = appointment.nome?.trim();
  const cognome = appointment.cognome?.trim();
  const full = [nome, cognome].filter(Boolean).join(" ").trim();

  return full || `${clientSingular} #${appointment.paziente_id}`;
}

function statusChipClass(status: AgendaStatus) {
  if (status === "confermato") {
    return "bg-emerald-100 text-emerald-700";
  }
  if (status === "completato") {
    return "bg-slate-200 text-slate-700";
  }
  if (status === "annullato") {
    return "bg-rose-100 text-rose-700";
  }
  return "bg-amber-100 text-amber-700";
}

function relativeAppointmentLabel(startAt: Date, now: Date) {
  const diffMinutes = Math.round((startAt.getTime() - now.getTime()) / 60000);
  if (diffMinutes <= 0) {
    return "In corso / imminente";
  }
  if (diffMinutes < 60) {
    return `Tra ${diffMinutes} min`;
  }
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) {
    return `Tra ${diffHours} ore`;
  }
  const diffDays = Math.round(diffHours / 24);
  return `Tra ${diffDays} giorni`;
}

function isBeforeToday(date: Date) {
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const candidateStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return candidateStart.getTime() < todayStart.getTime();
}

function clampRgbChannel(value: number, fallback: number) {
  return Number.isInteger(value) && value >= 0 && value <= 255 ? value : fallback;
}

function resolveAgendaAccentStyle(bootstrap: ReturnType<typeof useBootstrap>["data"]) {
  const fallback = { r: 45, g: 141, b: 74 };
  const rgb = bootstrap?.tenant?.activity_style?.primary_rgb;
  const r = clampRgbChannel(Number(rgb?.r), fallback.r);
  const g = clampRgbChannel(Number(rgb?.g), fallback.g);
  const b = clampRgbChannel(Number(rgb?.b), fallback.b);

  return {
    "--agenda-accent": `rgb(${r}, ${g}, ${b})`,
    "--agenda-accent-soft": `rgba(${r}, ${g}, ${b}, 0.14)`,
    "--agenda-accent-border": `rgba(${r}, ${g}, ${b}, 0.34)`,
  } as CSSProperties;
}

export function AgendaCalendar() {
  const session = useSyncExternalStore(subscribeToSession, getSessionSnapshot, () => null);
  const { data: bootstrap } = useBootstrap();
  const role = session?.ruolo ?? null;
  const canManageAppointments = role === "ADMIN" || role === "SEGRETARIO";
  const [appointments, setAppointments] = useState<BackendAppointment[]>([]);
  const [patients, setPatients] = useState<Paziente[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusUpdatingId, setStatusUpdatingId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UpcomingAppointment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(() => createInitialForm());
  const clientSingular = bootstrap?.labels?.client_singular || "Paziente";
  const clientPlural = bootstrap?.labels?.client_plural || "Pazienti";
  const ownerSingular = bootstrap?.labels?.owner_singular || "Dottore";
  const agendaAccentStyle = useMemo(() => resolveAgendaAccentStyle(bootstrap), [bootstrap]);

  const selectedPatient = useMemo(
    () =>
      patients.find((patient) => String(patient.id) === form.paziente_id) ?? null,
    [patients, form.paziente_id],
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [appointmentsData, patientsData] = await Promise.all([
        listAppuntamenti(),
        listPazienti(),
      ]);
      setAppointments(appointmentsData);
      setPatients(patientsData);
    } catch (loadError) {
      const message =
        loadError instanceof Error
          ? loadError.message
          : "Errore caricando agenda e pazienti.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const upcomingAppointments = useMemo<UpcomingAppointment[]>(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    return appointments
      .map((appointment) => {
        const startAt = makeDate(appointment.data, appointment.ora);
        if (!startAt) {
          return null;
        }

        return {
          ...appointment,
          startAt,
          patientLabel: displayPatientName(appointment, clientSingular),
        };
      })
      .filter(
        (appointment): appointment is UpcomingAppointment => appointment !== null,
      )
      .filter(
        (appointment) =>
          appointment.startAt.getTime() >= todayStart.getTime() &&
          appointment.stato !== "annullato",
      )
      .sort((left, right) => left.startAt.getTime() - right.startAt.getTime());
  }, [appointments, clientSingular]);

  const groupedUpcomingAppointments = useMemo(
    () =>
      upcomingAppointments.reduce<Array<{ dateLabel: string; items: UpcomingAppointment[] }>>(
        (groups, appointment) => {
          const dateLabel = formatDateToDmy(appointment.startAt);
          const existing = groups.find((group) => group.dateLabel === dateLabel);
          if (existing) {
            existing.items.push(appointment);
          } else {
            groups.push({ dateLabel, items: [appointment] });
          }
          return groups;
        },
        [],
      ),
    [upcomingAppointments],
  );

  const todayUpcomingCount = useMemo(() => {
    const todayLabel = formatDateToDmy(new Date());
    return upcomingAppointments.filter(
      (appointment) => formatDateToDmy(appointment.startAt) === todayLabel,
    ).length;
  }, [upcomingAppointments]);

  const weekUpcomingCount = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const weekEnd = todayStart + 7 * 24 * 60 * 60 * 1000;
    return upcomingAppointments.filter((appointment) => {
      const time = appointment.startAt.getTime();
      return time >= todayStart && time <= weekEnd;
    }).length;
  }, [upcomingAppointments]);

  function handleChange<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleCreateAppointment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const pazienteId = Number.parseInt(form.paziente_id, 10);
    if (!Number.isInteger(pazienteId) || pazienteId <= 0) {
      setError(`Seleziona un ${clientSingular.toLowerCase()} valido.`);
      return;
    }
    if (!selectedPatient?.medico_id || !selectedPatient.medico_nome) {
      setError(`Il ${clientSingular.toLowerCase()} selezionato non ha un ${ownerSingular.toLowerCase()} assegnato.`);
      return;
    }
    const normalizedDate = form.data.trim();
    const parsedDate = parseProjectDate(normalizedDate);
    if (!dmyDatePattern.test(normalizedDate) || !parsedDate) {
      setError("Data non valida. Usa il formato DD MM YYYY.");
      return;
    }
    if (isBeforeToday(parsedDate)) {
      const today = formatDateToDmy(new Date());
      setForm((prev) => ({ ...prev, data: today }));
      setError("Non puoi creare appuntamenti con data passata. Data impostata a oggi.");
      return;
    }
    const normalizedTime = form.ora.trim();
    if (!timePattern.test(normalizedTime)) {
      setError("Ora non valida. Usa il formato HH:mm.");
      return;
    }
    const payload: AppointmentPayload = {
      paziente_id: pazienteId,
      data: normalizedDate,
      ora: normalizedTime,
      stato: form.stato,
    };

    setSaving(true);
    try {
      const created = await createAppuntamento(payload);
      setSuccess(`Appuntamento creato (ID ${created.id}).`);
      setForm(createInitialForm());
      await loadData();
    } catch (saveError) {
      const message =
        saveError instanceof Error
          ? saveError.message
          : "Creazione appuntamento non riuscita.";
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirmAppointment(appointmentId: number) {
    setError(null);
    setSuccess(null);
    setStatusUpdatingId(appointmentId);

    try {
      const updated = await updateAppuntamento(appointmentId, {
        stato: "confermato",
      });

      setAppointments((prev) =>
        prev.map((appointment) =>
          appointment.id === appointmentId
            ? { ...appointment, stato: updated.stato }
            : appointment,
        ),
      );
      setSuccess("Appuntamento confermato.");
    } catch (updateError) {
      const message =
        updateError instanceof Error
          ? updateError.message
          : "Aggiornamento stato non riuscito.";
      setError(message);
    } finally {
      setStatusUpdatingId(null);
    }
  }

  function openDeleteDialog(appointment: UpcomingAppointment) {
    setDeleteTarget(appointment);
  }

  function closeDeleteDialog() {
    if (deleting) {
      return;
    }
    setDeleteTarget(null);
  }

  async function handleConfirmDeleteAppointment() {
    if (!deleteTarget) {
      return;
    }

    const deleteId = deleteTarget.id;
    setError(null);
    setSuccess(null);
    setDeleting(true);

    try {
      await deleteAppuntamento(deleteId);
      setAppointments((prev) =>
        prev.filter((appointment) => appointment.id !== deleteId),
      );
      if (statusUpdatingId === deleteId) {
        setStatusUpdatingId(null);
      }
      setDeleteTarget(null);
      setSuccess("Appuntamento eliminato.");
    } catch (deleteError) {
      const message =
        deleteError instanceof Error
          ? deleteError.message
          : "Eliminazione appuntamento non riuscita.";
      setError(message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section className="halo-page halo-reveal" style={agendaAccentStyle}>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--ui-muted)]">
        Agenda
      </p>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight">
        {`Agenda ${bootstrap?.labels?.appointment_plural?.toLowerCase() || "appuntamenti"}`}
      </h2>

      <div className={`mt-5 grid gap-5 ${canManageAppointments ? "xl:grid-cols-[380px_1fr]" : ""}`}>
        {canManageAppointments ? (
          <article className="halo-panel">
            <h3 className="text-sm font-semibold">Nuovo appuntamento</h3>
            <p className="mt-1 text-xs text-[var(--ui-muted)]">
              {`Il ${ownerSingular.toLowerCase()} viene assegnato automaticamente in base al ${clientSingular.toLowerCase()} selezionato.`}
            </p>

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

            <form className="mt-4 grid gap-3" onSubmit={handleCreateAppointment}>
              <label className="grid gap-1 text-sm">
                <span className="font-medium">{clientSingular} *</span>
                <select
                  value={form.paziente_id}
                  onChange={(e) => handleChange("paziente_id", e.target.value)}
                  className="halo-select"
                >
                  <option value="">{`Seleziona ${clientSingular.toLowerCase()}`}</option>
                  {patients.map((patient) => (
                    <option key={patient.id} value={String(patient.id)}>
                      {patient.nome} {patient.cognome}
                    </option>
                  ))}
                </select>
              </label>

              <ProjectDateField
                label="Data"
                required
                value={form.data}
                onChange={(nextValue) => handleChange("data", nextValue)}
              />

              <div className="rounded-[var(--radius-md)] border border-[var(--ui-border)] bg-[var(--ui-panel-solid)] px-3 py-2 text-sm">
                <span className="font-medium">{ownerSingular}</span>
                <p className="mt-1 text-xs text-[var(--ui-muted)]">
                  {selectedPatient?.medico_nome
                    ? selectedPatient.medico_nome
                    : `Seleziona un ${clientSingular.toLowerCase()} con ${ownerSingular.toLowerCase()} assegnato.`}
                </p>
              </div>

              <label className="grid gap-1 text-sm">
                <span className="font-medium">Ora *</span>
                <input
                  type="time"
                  value={form.ora}
                  onChange={(e) => handleChange("ora", e.target.value)}
                  className="halo-input"
                />
              </label>

              <label className="grid gap-1 text-sm">
                <span className="font-medium">Stato</span>
                <select
                  value={form.stato}
                  onChange={(e) =>
                    handleChange("stato", e.target.value as AgendaStatus)
                  }
                  className="halo-select"
                >
                  <option value="in_attesa">In attesa</option>
                  <option value="confermato">Confermato</option>
                  <option value="completato">Completato</option>
                  <option value="annullato">Annullato</option>
                </select>
              </label>

              <button
                type="submit"
                disabled={saving || loading}
                className="halo-btn-primary mt-1 px-4 py-2 text-sm"
              >
                {saving ? "Salvataggio..." : "Crea appuntamento"}
              </button>
            </form>
          </article>
        ) : (
          <article className="halo-panel">
            <h3 className="text-sm font-semibold">Vista agenda personale</h3>
            <p className="mt-1 text-sm text-[var(--ui-muted)]">
              {`Come ${ownerSingular.toLowerCase()} puoi consultare appuntamenti e ${clientPlural.toLowerCase()} assegnati.`}
              Creazione, conferma ed eliminazione appuntamenti sono riservate a
              amministrazione e segreteria.
            </p>
            <Link href="/pazienti" className="halo-btn-secondary mt-4 inline-flex px-4 py-2 text-sm">
              {`Apri schede ${clientPlural.toLowerCase()}`}
            </Link>
          </article>
        )}

        <article className="halo-panel">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold">Prossimi appuntamenti</h3>
              <p className="mt-1 text-xs text-[var(--ui-muted)]">
                Vista rapida e ordinata per giornata. Mostra solo appuntamenti futuri non annullati.
              </p>
            </div>
            <span
              className="rounded-full px-2.5 py-1 text-xs font-semibold"
              style={{
                background: "var(--agenda-accent-soft)",
                color: "var(--agenda-accent)",
              }}
            >
              {upcomingAppointments.length} in programma
            </span>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <article className="rounded-[var(--radius-md)] border border-[var(--ui-border)] bg-white p-3">
              <p className="text-xs uppercase tracking-[0.1em] text-[var(--ui-muted)]">
                Oggi
              </p>
              <p className="mt-1 text-2xl font-semibold">{todayUpcomingCount}</p>
            </article>
            <article className="rounded-[var(--radius-md)] border border-[var(--ui-border)] bg-white p-3">
              <p className="text-xs uppercase tracking-[0.1em] text-[var(--ui-muted)]">
                7 Giorni
              </p>
              <p className="mt-1 text-2xl font-semibold">{weekUpcomingCount}</p>
            </article>
            <article className="rounded-[var(--radius-md)] border border-[var(--ui-border)] bg-white p-3">
              <p className="text-xs uppercase tracking-[0.1em] text-[var(--ui-muted)]">
                Totale
              </p>
              <p className="mt-1 text-2xl font-semibold">{upcomingAppointments.length}</p>
            </article>
          </div>

          <div className="mt-4 max-h-[620px] space-y-3 overflow-y-auto pr-1">
            {loading ? (
              <div className="rounded-[var(--radius-md)] border border-[var(--ui-border)] bg-white p-4 text-sm text-[var(--ui-muted)]">
                Caricamento prossimi appuntamenti...
              </div>
            ) : groupedUpcomingAppointments.length === 0 ? (
              <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--ui-border)] bg-white p-5 text-center">
                <p className="text-sm font-medium">Nessun prossimo appuntamento</p>
                <p className="mt-1 text-xs text-[var(--ui-muted)]">
                  {canManageAppointments
                    ? "Crea un appuntamento dal pannello a sinistra."
                    : "Nessun appuntamento personale in arrivo."}
                </p>
              </div>
            ) : (
              groupedUpcomingAppointments.map((group) => (
                <section
                  key={group.dateLabel}
                  className="rounded-[var(--radius-md)] border border-[var(--ui-border)] bg-white p-3"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold">{group.dateLabel}</h4>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                      {group.items.length}
                    </span>
                  </div>

                  <div className="mt-2 grid gap-2">
                    {group.items.map((appointment) => (
                      <article
                        key={appointment.id}
                        className="rounded-[var(--radius-md)] border border-[var(--ui-border)] bg-[var(--ui-panel-solid)] p-3 transition-all duration-200 hover:bg-white"
                        style={{
                          borderColor: "var(--ui-border)",
                          boxShadow: "inset 3px 0 0 0 var(--agenda-accent-soft)",
                        }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold">{appointment.patientLabel}</p>
                            <p className="mt-1 text-xs text-[var(--ui-muted)]">
                              {appointment.medico}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold">{appointment.ora}</p>
                            <p className="mt-1 text-xs text-[var(--ui-muted)]">
                              {relativeAppointmentLabel(appointment.startAt, new Date())}
                            </p>
                          </div>
                        </div>

                        <div className="mt-2 flex items-center justify-between">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusChipClass(
                              appointment.stato,
                            )}`}
                          >
                            {statusLabel(appointment.stato)}
                          </span>
                          <span className="text-xs text-[var(--ui-muted)]">
                            ID #{appointment.id}
                          </span>
                        </div>

                        {canManageAppointments && (
                          <div className="mt-2 flex justify-end gap-2">
                            {appointment.stato === "in_attesa" && (
                              <button
                                type="button"
                                onClick={() => void handleConfirmAppointment(appointment.id)}
                                disabled={statusUpdatingId === appointment.id}
                                className="px-3 py-1.5 text-xs font-semibold text-white"
                                style={{
                                  borderRadius: "999px",
                                  background: "var(--agenda-accent)",
                                }}
                              >
                                {statusUpdatingId === appointment.id
                                  ? "Conferma..."
                                  : "Conferma"}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => openDeleteDialog(appointment)}
                              disabled={deleting && deleteTarget?.id === appointment.id}
                              className="halo-btn-danger px-3 py-1.5 text-xs"
                            >
                              {deleting && deleteTarget?.id === appointment.id
                                ? "Eliminazione..."
                                : "Elimina"}
                            </button>
                          </div>
                        )}
                      </article>
                    ))}
                  </div>
                </section>
              ))
            )}
          </div>
        </article>
      </div>

      {canManageAppointments && (
        <ConfirmDialog
          open={Boolean(deleteTarget)}
          title="Conferma eliminazione appuntamento"
          description={
            deleteTarget
              ? `Vuoi eliminare l'appuntamento di ${deleteTarget.patientLabel} del ${formatDateToDmy(
                  deleteTarget.startAt,
                )} alle ${deleteTarget.ora}?`
              : ""
          }
          confirmLabel="Elimina appuntamento"
          isConfirming={deleting}
          onConfirm={() => void handleConfirmDeleteAppointment()}
          onCancel={closeDeleteDialog}
        />
      )}
    </section>
  );
}
