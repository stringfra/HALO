const express = require("express");
const { pool } = require("../config/db");
const { verifyToken, authorize, requirePermission } = require("../../middlewares/authMiddleware");
const { requireFeature } = require("../middleware/feature-flags");
const { listCustomFieldValues } = require("../services/custom-fields.service");
const { serializeClient } = require("../services/domain-aliases.service");
const {
  hasOnlyKeys,
  isValidEmail,
  isValidPhone,
  normalizeOptionalText,
  normalizeRequiredText,
  parsePositiveInt,
} = require("../validation/input");

const router = express.Router();

const createKeys = [
  "nome",
  "cognome",
  "telefono",
  "email",
  "note",
  "medico_id",
  "first_name",
  "last_name",
  "phone",
  "notes",
  "owner_user_id",
];
const updateKeys = createKeys;
const allRoles = ["ADMIN", "DENTISTA", "SEGRETARIO", "DIPENDENTE"];
const adminSegretarioRoles = ["ADMIN", "SEGRETARIO"];

function isPractitionerRole(role) {
  const normalizedRole = String(role || "").trim().toUpperCase();
  return normalizedRole === "DENTISTA" || normalizedRole === "DIPENDENTE";
}

function resolveClientCreatePayload(body) {
  return {
    nome: body?.nome ?? body?.first_name,
    cognome: body?.cognome ?? body?.last_name,
    telefono: body?.telefono ?? body?.phone,
    email: body?.email,
    note: body?.note ?? body?.notes,
    medico_id: body?.medico_id ?? body?.owner_user_id,
  };
}

function resolveClientUpdatePayload(body) {
  const payload = {};

  if (Object.prototype.hasOwnProperty.call(body, "nome") || Object.prototype.hasOwnProperty.call(body, "first_name")) {
    payload.nome = body?.nome ?? body?.first_name;
  }
  if (Object.prototype.hasOwnProperty.call(body, "cognome") || Object.prototype.hasOwnProperty.call(body, "last_name")) {
    payload.cognome = body?.cognome ?? body?.last_name;
  }
  if (Object.prototype.hasOwnProperty.call(body, "telefono") || Object.prototype.hasOwnProperty.call(body, "phone")) {
    payload.telefono = body?.telefono ?? body?.phone;
  }
  if (Object.prototype.hasOwnProperty.call(body, "email")) {
    payload.email = body?.email;
  }
  if (Object.prototype.hasOwnProperty.call(body, "note") || Object.prototype.hasOwnProperty.call(body, "notes")) {
    payload.note = body?.note ?? body?.notes;
  }
  if (Object.prototype.hasOwnProperty.call(body, "medico_id") || Object.prototype.hasOwnProperty.call(body, "owner_user_id")) {
    payload.medico_id = body?.medico_id ?? body?.owner_user_id;
  }

  return payload;
}

async function findDentistById(studioId, medicoId) {
  if (!medicoId) {
    return null;
  }

  const result = await pool.query(
    `SELECT id, nome
     FROM users
     WHERE id = $1
       AND studio_id = $2
       AND ruolo IN ('DENTISTA', 'DIPENDENTE')
     LIMIT 1`,
    [medicoId, studioId],
  );

  return result.rows[0] ?? null;
}

router.use(verifyToken);
router.use(requireFeature("clients.enabled"));

router.get("/", requirePermission("clients.read"), async (req, res) => {
  try {
    const studioId = Number(req.user?.studio_id);
    const params = [studioId];
    let query = `SELECT p.id,
                        p.nome,
                        p.cognome,
                        p.telefono,
                        p.email,
                        p.note,
                        p.medico_id,
                        u.nome AS medico_nome
                 FROM pazienti p
                 LEFT JOIN users u ON u.id = p.medico_id
                                  AND u.studio_id = p.studio_id
                 WHERE p.studio_id = $1`;

    if (isPractitionerRole(req.user?.ruolo)) {
      params.push(req.user.id);
      query += " AND p.medico_id = $2";
    }

    query += " ORDER BY p.id DESC";

    const result = await pool.query(query, params);
    const rows = await Promise.all(
      result.rows.map(async (row) =>
        serializeClient({
          ...row,
          custom_fields: await listCustomFieldValues(studioId, "clients", Number(row.id)),
        }),
      ),
    );
    return res.status(200).json(rows);
  } catch (error) {
    return res.status(500).json({
      message: "Errore nel recupero pazienti.",
      detail: error.message,
    });
  }
});

router.post("/", requirePermission("clients.write"), async (req, res) => {
  if (!hasOnlyKeys(req.body, createKeys)) {
    return res.status(400).json({
      message: "Payload non valido.",
    });
  }

  const payload = resolveClientCreatePayload(req.body);
  const nome = normalizeRequiredText(payload?.nome, { min: 2, max: 100 });
  const cognome = normalizeRequiredText(payload?.cognome, { min: 2, max: 100 });
  const telefonoInput = payload?.telefono;
  const emailInput = payload?.email;
  const noteInput = payload?.note;
  const medicoId = parsePositiveInt(payload?.medico_id);
  const telefono = normalizeOptionalText(payload?.telefono, { max: 30 });
  const email = normalizeOptionalText(payload?.email, { max: 255 });
  const note = normalizeOptionalText(payload?.note, { max: 2000, multiline: true });

  if (!nome || !cognome) {
    return res.status(400).json({
      message: "Nome e cognome sono obbligatori (2-100 caratteri).",
    });
  }
  if (telefonoInput !== undefined && telefonoInput !== null && typeof telefonoInput !== "string") {
    return res.status(400).json({
      message: "Telefono non valido.",
    });
  }
  if (emailInput !== undefined && emailInput !== null && typeof emailInput !== "string") {
    return res.status(400).json({
      message: "Email non valida.",
    });
  }
  if (noteInput !== undefined && noteInput !== null && typeof noteInput !== "string") {
    return res.status(400).json({
      message: "Note non valide.",
    });
  }
  if (typeof noteInput === "string" && noteInput.trim().length > 0 && note === null) {
    return res.status(400).json({
      message: "Note non valide (massimo 2000 caratteri).",
    });
  }
  if (!medicoId) {
    return res.status(400).json({
      message: "medico_id non valido.",
    });
  }
  if (telefono && !isValidPhone(telefono)) {
    return res.status(400).json({
      message: "Telefono non valido.",
    });
  }
  if (email && !isValidEmail(email)) {
    return res.status(400).json({
      message: "Email non valida.",
    });
  }

  try {
    const studioId = Number(req.user?.studio_id);
    const dentist = await findDentistById(studioId, medicoId);

    if (!dentist) {
      return res.status(400).json({
        message: "Il dottore selezionato non esiste o non appartiene allo studio.",
      });
    }

    const result = await pool.query(
      `INSERT INTO pazienti (studio_id, medico_id, nome, cognome, telefono, email, note)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, nome, cognome, telefono, email, note, medico_id`,
      [studioId, medicoId, nome, cognome, telefono, email, note],
    );
    return res.status(201).json(serializeClient({
      ...result.rows[0],
      medico_nome: dentist.nome,
      custom_fields: {},
    }));
  } catch (error) {
    return res.status(500).json({
      message: "Errore nella creazione paziente.",
      detail: error.message,
    });
  }
});

router.put("/:id", requirePermission("clients.write"), async (req, res) => {
  const studioId = Number(req.user?.studio_id);
  const patientId = parsePositiveInt(req.params.id);
  if (!patientId) {
    return res.status(400).json({
      message: "ID paziente non valido.",
    });
  }

  if (!hasOnlyKeys(req.body, updateKeys)) {
    return res.status(400).json({
      message: "Payload non valido.",
    });
  }

  const payload = resolveClientUpdatePayload(req.body);
  const fields = [];
  const values = [];
  let index = 1;

  if (payload?.nome !== undefined) {
    const nome = normalizeRequiredText(payload.nome, { min: 2, max: 100 });
    if (!nome) {
      return res.status(400).json({ message: "Nome non valido (2-100 caratteri)." });
    }
    fields.push(`nome = $${index++}`);
    values.push(nome);
  }

  if (payload?.cognome !== undefined) {
    const cognome = normalizeRequiredText(payload.cognome, { min: 2, max: 100 });
    if (!cognome) {
      return res.status(400).json({ message: "Cognome non valido (2-100 caratteri)." });
    }
    fields.push(`cognome = $${index++}`);
    values.push(cognome);
  }

  if (payload?.telefono !== undefined) {
    const telefonoInput = payload.telefono;
    if (telefonoInput !== null && typeof telefonoInput !== "string") {
      return res.status(400).json({ message: "Telefono non valido." });
    }
    const telefono = normalizeOptionalText(telefonoInput, { max: 30 });
    if (telefono && !isValidPhone(telefono)) {
      return res.status(400).json({ message: "Telefono non valido." });
    }
    fields.push(`telefono = $${index++}`);
    values.push(telefono);
  }

  if (payload?.email !== undefined) {
    const emailInput = payload.email;
    if (emailInput !== null && typeof emailInput !== "string") {
      return res.status(400).json({ message: "Email non valida." });
    }
    const email = normalizeOptionalText(emailInput, { max: 255 });
    if (email && !isValidEmail(email)) {
      return res.status(400).json({ message: "Email non valida." });
    }
    fields.push(`email = $${index++}`);
    values.push(email);
  }

  if (payload?.note !== undefined) {
    const noteInput = payload.note;
    if (noteInput !== null && typeof noteInput !== "string") {
      return res.status(400).json({ message: "Note non valide." });
    }
    const note = normalizeOptionalText(noteInput, { max: 2000, multiline: true });
    if (typeof noteInput === "string" && noteInput.trim().length > 0 && note === null) {
      return res.status(400).json({
        message: "Note non valide (massimo 2000 caratteri).",
      });
    }
    fields.push(`note = $${index++}`);
    values.push(note);
  }

  let nextMedicoId = null;
  if (payload?.medico_id !== undefined) {
    nextMedicoId = parsePositiveInt(payload.medico_id);
    if (!nextMedicoId) {
      return res.status(400).json({ message: "medico_id non valido." });
    }
  }

  if (fields.length === 0 && nextMedicoId === null) {
    return res.status(400).json({
      message: "Nessun campo valido da aggiornare.",
    });
  }

  values.push(patientId);
  values.push(studioId);

  try {
    if (nextMedicoId !== null) {
      const dentist = await findDentistById(studioId, nextMedicoId);
      if (!dentist) {
        return res.status(400).json({
          message: "Il dottore selezionato non esiste o non appartiene allo studio.",
        });
      }

      fields.push(`medico_id = $${index++}`);
      values.splice(values.length - 2, 0, nextMedicoId);
    }

    const result = await pool.query(
      `UPDATE pazienti
       SET ${fields.join(", ")}
       WHERE id = $${index}
         AND studio_id = $${index + 1}
       RETURNING id, nome, cognome, telefono, email, note, medico_id`,
      values,
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Paziente non trovato." });
    }

    const updatedPatient = result.rows[0];
    let medicoNome = null;

    if (updatedPatient.medico_id) {
      const dentist = await findDentistById(studioId, updatedPatient.medico_id);
      medicoNome = dentist?.nome ?? null;
    }

    return res.status(200).json(serializeClient({
      ...updatedPatient,
      medico_nome: medicoNome,
      custom_fields: await listCustomFieldValues(studioId, "clients", Number(updatedPatient.id)),
    }));
  } catch (error) {
    return res.status(500).json({
      message: "Errore nell'aggiornamento paziente.",
      detail: error.message,
    });
  }
});

router.delete("/:id", requirePermission("clients.write"), async (req, res) => {
  const studioId = Number(req.user?.studio_id);
  const patientId = parsePositiveInt(req.params.id);
  if (!patientId) {
    return res.status(400).json({
      message: "ID paziente non valido.",
    });
  }

  try {
    const result = await pool.query(
      `DELETE FROM pazienti
       WHERE id = $1
         AND studio_id = $2
       RETURNING id`,
      [patientId, studioId],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Paziente non trovato." });
    }

    return res.status(200).json({
      message: "Paziente eliminato con successo.",
      id: result.rows[0].id,
      client_id: result.rows[0].id,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Errore nell'eliminazione paziente.",
      detail: error.message,
    });
  }
});

module.exports = router;
