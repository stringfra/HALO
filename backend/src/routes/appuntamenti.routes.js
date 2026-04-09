const express = require("express");
const { pool } = require("../config/db");
const { verifyToken, authorize, requirePermission } = require("../../middlewares/authMiddleware");
const { requireFeature } = require("../middleware/feature-flags");
const { serializeAppointment } = require("../services/domain-aliases.service");
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
const allRoles = ["ADMIN", "DENTISTA", "SEGRETARIO", "DIPENDENTE"];
const adminSegretarioRoles = ["ADMIN", "SEGRETARIO"];

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
    paziente_id: body?.paziente_id ?? body?.client_id,
    data: body?.data ?? body?.appointment_date,
    ora: body?.ora ?? body?.appointment_time,
    medico: body?.medico ?? body?.owner_display_name,
    stato: body?.stato ?? body?.appointment_status,
  };
}

async function findPatientAssignedDentist(studioId, pazienteId) {
  const result = await pool.query(
    `SELECT p.id,
            p.medico_id,
            u.nome AS medico_nome
     FROM pazienti p
     LEFT JOIN users u ON u.id = p.medico_id
                      AND u.studio_id = p.studio_id
                      AND u.ruolo IN ('DENTISTA', 'DIPENDENTE')
     WHERE p.id = $1
       AND p.studio_id = $2
     LIMIT 1`,
    [pazienteId, studioId],
  );

  return result.rows[0] ?? null;
}

router.use(verifyToken);
router.use(requireFeature("agenda.enabled"));

router.get("/", requirePermission("appointments.read"), async (req, res) => {
  try {
    const studioId = Number(req.user?.studio_id);
    const params = [studioId];
    let query = `SELECT a.id,
                        a.paziente_id,
                        p.nome,
                        p.cognome,
                        TO_CHAR(a.data, 'DD MM YYYY') AS data,
                        a.ora,
                        a.medico,
                        a.stato
                 FROM appuntamenti a
                 LEFT JOIN pazienti p ON p.id = a.paziente_id
                                      AND p.studio_id = a.studio_id
                 WHERE a.studio_id = $1`;

    if (isPractitionerRole(req.user?.ruolo)) {
      params.push(req.user.id);
      query += " AND p.medico_id = $2";
    }

    query += " ORDER BY a.data DESC, a.ora DESC, a.id DESC";

    const result = await pool.query(query, params);

    return res.status(200).json(result.rows.map(serializeAppointment));
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
  const pazienteId = parsePositiveInt(payload?.paziente_id);
  const data = parseDateDmyOrIso(payload?.data, { allowIso: true });
  const ora = parseTime(payload?.ora);
  const medico = normalizeRequiredText(payload?.medico, { min: 2, max: 120 });
  const stato = parseEnum(payload?.stato, allowedStates, { allowUndefined: true });

  if (!pazienteId || !data || !ora) {
    return res.status(400).json({
      message: "Campi richiesti: paziente_id, data DD MM YYYY, ora.",
    });
  }
  if (payload?.medico !== undefined && !medico) {
    return res.status(400).json({
      message: "Medico non valido.",
    });
  }
  if (data < getTodayIsoLocal()) {
    return res.status(400).json({
      message: "Non puoi creare appuntamenti con data passata.",
    });
  }
  if (stato === null) {
    return res.status(400).json({ message: "Stato non valido." });
  }

  try {
    const studioId = Number(req.user?.studio_id);
    const patientAssignment = await findPatientAssignedDentist(studioId, pazienteId);

    if (!patientAssignment) {
      return res.status(400).json({
        message: "Il paziente selezionato non esiste.",
      });
    }

    const resolvedMedico = patientAssignment.medico_nome ?? medico;
    if (!resolvedMedico) {
      return res.status(400).json({
        message: "Il paziente selezionato non ha un dottore assegnato.",
      });
    }

    const result = await pool.query(
      `INSERT INTO appuntamenti (studio_id, paziente_id, data, ora, medico, stato)
       SELECT $1, p.id, $3, $4, $5, COALESCE($6, 'in_attesa')
       FROM pazienti p
       WHERE p.id = $2
         AND p.studio_id = $1
       RETURNING id,
                 paziente_id,
                 TO_CHAR(data, 'DD MM YYYY') AS data,
                 ora,
                 medico,
                 stato`,
      [studioId, pazienteId, data, ora, resolvedMedico, stato],
    );

    if (result.rowCount === 0) {
      return res.status(400).json({
        message: "Il paziente selezionato non esiste.",
      });
    }

    const createdAppointment = serializeAppointment(result.rows[0]);
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
  const fields = [];
  const values = [];
  let index = 1;

  if (payload?.paziente_id !== undefined) {
    const pazienteId = parsePositiveInt(payload.paziente_id);
    if (!pazienteId) {
      return res.status(400).json({ message: "paziente_id non valido." });
    }

    const patientExists = await pool.query(
      `SELECT 1
       FROM pazienti
       WHERE id = $1
         AND studio_id = $2
       LIMIT 1`,
      [pazienteId, studioId],
    );
    if (patientExists.rowCount === 0) {
      return res.status(400).json({
        message: "Il paziente selezionato non esiste.",
      });
    }

    fields.push(`paziente_id = $${index++}`);
    values.push(pazienteId);
  }

  if (payload?.data !== undefined) {
    const data = parseDateDmyOrIso(payload.data, { allowIso: true });
    if (!data) {
      return res.status(400).json({
        message: "Data non valida. Formato richiesto DD MM YYYY o YYYY-MM-DD.",
      });
    }
    if (data < getTodayIsoLocal()) {
      return res.status(400).json({
        message: "Non puoi impostare una data passata.",
      });
    }
    fields.push(`data = $${index++}`);
    values.push(data);
  }

  if (payload?.ora !== undefined) {
    const ora = parseTime(payload.ora);
    if (!ora) {
      return res.status(400).json({
        message: "Ora non valida. Formato richiesto HH:mm o HH:mm:ss.",
      });
    }
    fields.push(`ora = $${index++}`);
    values.push(ora);
  }

  if (payload?.medico !== undefined) {
    const medico = normalizeRequiredText(payload.medico, { min: 2, max: 120 });
    if (!medico) {
      return res.status(400).json({
        message: "Medico non valido.",
      });
    }
    fields.push(`medico = $${index++}`);
    values.push(medico);
  }

  if (payload?.stato !== undefined) {
    const stato = parseEnum(payload.stato, allowedStates, { allowUndefined: false });
    if (!stato) {
      return res.status(400).json({ message: "Stato non valido." });
    }
    fields.push(`stato = $${index++}`);
    values.push(stato);
  }

  if (fields.length === 0) {
    return res.status(400).json({
      message: "Nessun campo valido da aggiornare.",
    });
  }

  values.push(appointmentId);
  values.push(studioId);

  try {
    const result = await pool.query(
      `UPDATE appuntamenti
       SET ${fields.join(", ")}
       WHERE id = $${index}
         AND studio_id = $${index + 1}
       RETURNING id,
                 paziente_id,
                 TO_CHAR(data, 'DD MM YYYY') AS data,
                 ora,
                 medico,
                 stato`,
      values,
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        message: "Appuntamento non trovato.",
      });
    }

    const updatedAppointment = serializeAppointment(result.rows[0]);
    await enqueueSyncWithoutBlockingResponse({
      req,
      studioId,
      appointmentId: updatedAppointment.id,
      operation: "update",
      snapshot: updatedAppointment,
    });

    return res.status(200).json(updatedAppointment);
  } catch (error) {
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
    const result = await pool.query(
      `DELETE FROM appuntamenti
       WHERE id = $1
         AND studio_id = $2
       RETURNING id`,
      [appointmentId, studioId],
    );

    if (result.rowCount === 0) {
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
      id: result.rows[0].id,
      appointment_id: result.rows[0].id,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Errore nell'eliminazione appuntamento.",
      detail: error.message,
    });
  }
});

module.exports = router;
