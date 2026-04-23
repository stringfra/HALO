const express = require("express");
const { verifyToken, requirePermission } = require("../../middlewares/authMiddleware");
const { requireFeature } = require("../middleware/feature-flags");
const { serializeAppointment } = require("../services/domain-aliases.service");
const {
  createAppointmentInLegacyStorage,
  deleteAppointmentFromLegacyStorage,
  findAssignedOwnerForClient,
  listAppointmentsFromLegacyStorage,
  updateAppointmentInLegacyStorage,
} = require("../services/domain-entity-adapters.service");
const {
  enqueueAppointmentSyncMutation,
  resolveDeleteAppointmentSyncHint,
} = require("../services/appointment-google-sync-enqueue.service");
const {
  hasOnlyKeys,
  normalizeRequiredText,
  parseDateDmyOrIso,
  parseEnum,
  parsePositiveInt,
  parseTime,
} = require("../validation/input");

const router = express.Router();

const allowedStates = new Set(["in_attesa", "confermato", "completato", "annullato"]);
const allowedKeys = [
  "paziente_id",
  "data",
  "ora",
  "medico",
  "stato",
  "client_id",
  "appointment_date",
  "appointment_time",
  "owner_display_name",
  "appointment_status",
];

async function enqueueSyncWithoutBlockingResponse({
  req,
  studioId,
  appointmentId,
  operation,
  snapshot = {},
  connectionId = null,
  googleEventId = null,
}) {
  try {
    return await enqueueAppointmentSyncMutation({
      studioId,
      appointmentId,
      operation,
      requestId: req.requestId || null,
      actorUserId: req.user?.id || null,
      snapshot,
      connectionId,
      googleEventId,
    });
  } catch (error) {
    console.warn(
      `[APPOINTMENT_SYNC_ENQUEUE] requestId=${req.requestId || "n/a"} studioId=${studioId || "n/a"} appointmentId=${appointmentId || "n/a"} operation=${operation} status=${error?.statusCode || "n/a"} error=${error?.message || "unknown_error"}`,
    );
    return {
      enqueued: false,
      reason: "enqueue_failed",
      error: error?.message || "unknown_error",
    };
  }
}

function isPractitionerRole(role) {
  const normalizedRole = String(role || "").trim().toUpperCase();
  return normalizedRole === "DENTISTA" || normalizedRole === "DIPENDENTE";
}

function getTodayIsoLocal() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function resolveAppointmentPayload(body) {
  return {
    client_id: body?.client_id ?? body?.paziente_id,
    appointment_date: body?.appointment_date ?? body?.data,
    appointment_time: body?.appointment_time ?? body?.ora,
    owner_display_name: body?.owner_display_name ?? body?.medico,
    appointment_status: body?.appointment_status ?? body?.stato,
  };
}

router.use(verifyToken);
router.use(requireFeature("agenda.enabled"));

router.get("/", requirePermission("appointments.read"), async (req, res) => {
  try {
    const studioId = Number(req.user?.studio_id);
    const ownerUserId = isPractitionerRole(req.user?.ruolo) ? Number(req.user?.id) : null;
    const appointments = await listAppointmentsFromLegacyStorage({
      studioId,
      ownerUserId,
    });

    return res.status(200).json(appointments.map(serializeAppointment));
  } catch (error) {
    return res.status(500).json({
      message: "Errore nel recupero appuntamenti.",
      detail: error.message,
    });
  }
});

router.post("/", requirePermission("appointments.write"), async (req, res) => {
  if (!hasOnlyKeys(req.body, allowedKeys)) {
    return res.status(400).json({ message: "Payload non valido." });
  }

  const payload = resolveAppointmentPayload(req.body);
  const clientId = parsePositiveInt(payload?.client_id);
  const appointmentDate = parseDateDmyOrIso(payload?.appointment_date, { allowIso: true });
  const appointmentTime = parseTime(payload?.appointment_time);
  const ownerDisplayName = normalizeRequiredText(payload?.owner_display_name, { min: 2, max: 120 });
  const appointmentStatus = parseEnum(payload?.appointment_status, allowedStates, { allowUndefined: true });

  if (!clientId || !appointmentDate || !appointmentTime) {
    return res.status(400).json({
      message: "Campi richiesti: client_id, appointment_date DD MM YYYY, appointment_time.",
    });
  }
  if (payload?.owner_display_name !== undefined && !ownerDisplayName) {
    return res.status(400).json({
      message: "Owner display name non valido.",
    });
  }
  if (appointmentDate < getTodayIsoLocal()) {
    return res.status(400).json({
      message: "Non puoi creare appuntamenti con data passata.",
    });
  }
  if (appointmentStatus === null) {
    return res.status(400).json({ message: "Stato non valido." });
  }

  try {
    const studioId = Number(req.user?.studio_id);
    const clientAssignment = await findAssignedOwnerForClient({
      studioId,
      clientId,
    });

    if (!clientAssignment) {
      return res.status(400).json({
        message: "Il client selezionato non esiste.",
      });
    }

    const resolvedOwnerDisplayName = clientAssignment.owner_display_name ?? ownerDisplayName;
    if (!resolvedOwnerDisplayName) {
      return res.status(400).json({
        message: "Il client selezionato non ha un owner assegnato.",
      });
    }

    const created = await createAppointmentInLegacyStorage({
      studioId,
      clientId,
      appointmentDate,
      appointmentTime,
      ownerDisplayName: resolvedOwnerDisplayName,
      appointmentStatus,
    });

    if (!created) {
      return res.status(400).json({
        message: "Il client selezionato non esiste.",
      });
    }

    const createdAppointment = serializeAppointment(created);
    await enqueueSyncWithoutBlockingResponse({
      req,
      studioId,
      appointmentId: createdAppointment.id,
      operation: "create",
      snapshot: createdAppointment,
    });

    return res.status(201).json(createdAppointment);
  } catch (error) {
    return res.status(500).json({
      message: "Errore nella creazione appuntamento.",
      detail: error.message,
    });
  }
});

router.put("/:id", requirePermission("appointments.write"), async (req, res) => {
  const studioId = Number(req.user?.studio_id);
  const appointmentId = parsePositiveInt(req.params.id);
  if (!appointmentId) {
    return res.status(400).json({ message: "ID appuntamento non valido." });
  }

  if (!hasOnlyKeys(req.body, allowedKeys)) {
    return res.status(400).json({ message: "Payload non valido." });
  }

  const payload = resolveAppointmentPayload(req.body);
  const updates = {};

  if (payload?.client_id !== undefined) {
    const clientId = parsePositiveInt(payload.client_id);
    if (!clientId) {
      return res.status(400).json({ message: "client_id non valido." });
    }
    updates.client_id = clientId;
  }

  if (payload?.appointment_date !== undefined) {
    const appointmentDate = parseDateDmyOrIso(payload.appointment_date, { allowIso: true });
    if (!appointmentDate) {
      return res.status(400).json({
        message: "Data non valida. Formato richiesto DD MM YYYY o YYYY-MM-DD.",
      });
    }
    if (appointmentDate < getTodayIsoLocal()) {
      return res.status(400).json({
        message: "Non puoi impostare una data passata.",
      });
    }
    updates.appointment_date = appointmentDate;
  }

  if (payload?.appointment_time !== undefined) {
    const appointmentTime = parseTime(payload.appointment_time);
    if (!appointmentTime) {
      return res.status(400).json({
        message: "Ora non valida. Formato richiesto HH:mm o HH:mm:ss.",
      });
    }
    updates.appointment_time = appointmentTime;
  }

  if (payload?.owner_display_name !== undefined) {
    const ownerDisplayName = normalizeRequiredText(payload.owner_display_name, { min: 2, max: 120 });
    if (!ownerDisplayName) {
      return res.status(400).json({
        message: "Owner display name non valido.",
      });
    }
    updates.owner_display_name = ownerDisplayName;
  }

  if (payload?.appointment_status !== undefined) {
    const appointmentStatus = parseEnum(payload.appointment_status, allowedStates, { allowUndefined: false });
    if (!appointmentStatus) {
      return res.status(400).json({ message: "Stato non valido." });
    }
    updates.appointment_status = appointmentStatus;
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({
      message: "Nessun campo valido da aggiornare.",
    });
  }

  try {
    const updated = await updateAppointmentInLegacyStorage({
      studioId,
      appointmentId,
      updates,
    });

    if (!updated) {
      return res.status(404).json({
        message: "Appuntamento non trovato.",
      });
    }

    const updatedAppointment = serializeAppointment(updated);
    await enqueueSyncWithoutBlockingResponse({
      req,
      studioId,
      appointmentId: updatedAppointment.id,
      operation: "update",
      snapshot: updatedAppointment,
    });

    return res.status(200).json(updatedAppointment);
  } catch (error) {
    if (error?.code === "APPOINTMENT_CLIENT_NOT_FOUND") {
      return res.status(400).json({ message: error.message });
    }

    return res.status(500).json({
      message: "Errore nell'aggiornamento appuntamento.",
      detail: error.message,
    });
  }
});

router.delete("/:id", requirePermission("appointments.write"), async (req, res) => {
  const studioId = Number(req.user?.studio_id);
  const appointmentId = parsePositiveInt(req.params.id);
  if (!appointmentId) {
    return res.status(400).json({
      message: "ID appuntamento non valido.",
    });
  }

  let deleteSyncHint = null;
  try {
    deleteSyncHint = await resolveDeleteAppointmentSyncHint({
      studioId,
      appointmentId,
    });
  } catch (error) {
    console.warn(
      `[APPOINTMENT_SYNC_DELETE_HINT] requestId=${req.requestId || "n/a"} studioId=${studioId || "n/a"} appointmentId=${appointmentId || "n/a"} error=${error?.message || "unknown_error"}`,
    );
  }

  try {
    const deleted = await deleteAppointmentFromLegacyStorage({
      studioId,
      appointmentId,
    });

    if (!deleted) {
      return res.status(404).json({
        message: "Appuntamento non trovato.",
      });
    }

    await enqueueSyncWithoutBlockingResponse({
      req,
      studioId,
      appointmentId,
      operation: "delete",
      snapshot: {
        id: appointmentId,
        deleted: true,
      },
      connectionId: deleteSyncHint?.connectionId || null,
      googleEventId: deleteSyncHint?.googleEventId || null,
    });

    return res.status(200).json({
      message: "Appuntamento eliminato con successo.",
      id: deleted.id,
      appointment_id: deleted.appointment_id,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Errore nell'eliminazione appuntamento.",
      detail: error.message,
    });
  }
});

module.exports = router;
