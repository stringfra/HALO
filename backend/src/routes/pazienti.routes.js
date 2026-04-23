const express = require("express");
const { pool } = require("../config/db");
const { verifyToken, requirePermission } = require("../../middlewares/authMiddleware");
const { requireFeature } = require("../middleware/feature-flags");
const { listCustomFieldValues } = require("../services/custom-fields.service");
const { serializeClient } = require("../services/domain-aliases.service");
const {
  createClientInLegacyStorage,
  deleteClientFromLegacyStorage,
  findPractitionerById,
  listClientsFromLegacyStorage,
  updateClientInLegacyStorage,
} = require("../services/domain-entity-adapters.service");
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

function isPractitionerRole(role) {
  const normalizedRole = String(role || "").trim().toUpperCase();
  return normalizedRole === "DENTISTA" || normalizedRole === "DIPENDENTE";
}

function resolveClientCreatePayload(body) {
  return {
    first_name: body?.first_name ?? body?.nome,
    last_name: body?.last_name ?? body?.cognome,
    phone: body?.phone ?? body?.telefono,
    email: body?.email,
    notes: body?.notes ?? body?.note,
    owner_user_id: body?.owner_user_id ?? body?.medico_id,
  };
}

function resolveClientUpdatePayload(body) {
  const payload = {};

  if (Object.prototype.hasOwnProperty.call(body, "first_name") || Object.prototype.hasOwnProperty.call(body, "nome")) {
    payload.first_name = body?.first_name ?? body?.nome;
  }
  if (Object.prototype.hasOwnProperty.call(body, "last_name") || Object.prototype.hasOwnProperty.call(body, "cognome")) {
    payload.last_name = body?.last_name ?? body?.cognome;
  }
  if (Object.prototype.hasOwnProperty.call(body, "phone") || Object.prototype.hasOwnProperty.call(body, "telefono")) {
    payload.phone = body?.phone ?? body?.telefono;
  }
  if (Object.prototype.hasOwnProperty.call(body, "email")) {
    payload.email = body?.email;
  }
  if (Object.prototype.hasOwnProperty.call(body, "notes") || Object.prototype.hasOwnProperty.call(body, "note")) {
    payload.notes = body?.notes ?? body?.note;
  }
  if (Object.prototype.hasOwnProperty.call(body, "owner_user_id") || Object.prototype.hasOwnProperty.call(body, "medico_id")) {
    payload.owner_user_id = body?.owner_user_id ?? body?.medico_id;
  }

  return payload;
}

async function findOwnerById(studioId, ownerUserId) {
  if (!ownerUserId) {
    return null;
  }

  return findPractitionerById({ studioId, ownerUserId });
}

async function listTenantPractitioners(studioId) {
  const result = await pool.query(
    `SELECT id,
            nome AS owner_display_name
     FROM users
     WHERE studio_id = $1
       AND ruolo IN ('DENTISTA', 'DIPENDENTE')
     ORDER BY id ASC`,
    [studioId],
  );

  return result.rows.map((row) => ({
    id: Number(row.id),
    owner_display_name: row.owner_display_name || null,
  }));
}

async function resolveOwnerForCreate({
  studioId,
  requestedOwnerUserId,
  actorUserId,
  actorRole,
}) {
  if (requestedOwnerUserId) {
    const owner = await findOwnerById(studioId, requestedOwnerUserId);
    if (!owner) {
      const error = new Error("Il responsabile selezionato non esiste o non appartiene allo studio.");
      error.statusCode = 400;
      throw error;
    }
    return {
      id: Number(owner.id),
      owner_display_name: owner.owner_display_name || null,
    };
  }

  if (isPractitionerRole(actorRole)) {
    const owner = await findOwnerById(studioId, Number(actorUserId));
    if (owner) {
      return {
        id: Number(owner.id),
        owner_display_name: owner.owner_display_name || null,
      };
    }
  }

  const practitioners = await listTenantPractitioners(studioId);
  if (practitioners.length === 0) {
    const error = new Error("Nessun responsabile disponibile nel tenant.");
    error.statusCode = 409;
    throw error;
  }

  return practitioners[0];
}

router.use(verifyToken);
router.use(requireFeature("clients.enabled"));

router.get("/", requirePermission("clients.read"), async (req, res) => {
  try {
    const studioId = Number(req.user?.studio_id);
    const ownerUserId = isPractitionerRole(req.user?.ruolo) ? Number(req.user?.id) : null;
    const rawClients = await listClientsFromLegacyStorage({
      studioId,
      ownerUserId,
    });
    const rows = await Promise.all(
      rawClients.map(async (row) =>
        serializeClient({
          ...row,
          custom_fields: await listCustomFieldValues(studioId, "clients", Number(row.id)),
        }),
      ),
    );
    return res.status(200).json(rows);
  } catch (error) {
    return res.status(500).json({
      message: "Errore nel recupero clienti.",
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
  const firstName = normalizeRequiredText(payload?.first_name, { min: 2, max: 100 });
  const lastName = normalizeRequiredText(payload?.last_name, { min: 2, max: 100 });
  const phoneInput = payload?.phone;
  const emailInput = payload?.email;
  const notesInput = payload?.notes;
  const ownerUserId = parsePositiveInt(payload?.owner_user_id);
  const phone = normalizeOptionalText(payload?.phone, { max: 30 });
  const email = normalizeOptionalText(payload?.email, { max: 255 });
  const notes = normalizeOptionalText(payload?.notes, { max: 2000, multiline: true });

  if (!firstName || !lastName) {
    return res.status(400).json({
      message: "Nome e cognome sono obbligatori (2-100 caratteri).",
    });
  }
  if (phoneInput !== undefined && phoneInput !== null && typeof phoneInput !== "string") {
    return res.status(400).json({
      message: "Telefono non valido.",
    });
  }
  if (emailInput !== undefined && emailInput !== null && typeof emailInput !== "string") {
    return res.status(400).json({
      message: "Email non valida.",
    });
  }
  if (notesInput !== undefined && notesInput !== null && typeof notesInput !== "string") {
    return res.status(400).json({
      message: "Note non valide.",
    });
  }
  if (typeof notesInput === "string" && notesInput.trim().length > 0 && notes === null) {
    return res.status(400).json({
      message: "Note non valide (massimo 2000 caratteri).",
    });
  }
  if (
    payload?.owner_user_id !== undefined &&
    payload?.owner_user_id !== null &&
    !ownerUserId
  ) {
    return res.status(400).json({
      message: "owner_user_id/medico_id non valido.",
    });
  }
  if (phone && !isValidPhone(phone)) {
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
    const owner = await resolveOwnerForCreate({
      studioId,
      requestedOwnerUserId: ownerUserId,
      actorUserId: req.user?.id,
      actorRole: req.user?.ruolo,
    });

    const createdClient = await createClientInLegacyStorage({
      studioId,
      firstName,
      lastName,
      phone,
      email,
      notes,
      ownerUserId: owner.id,
    });
    return res.status(201).json(serializeClient({
      ...createdClient,
      owner_display_name: owner.owner_display_name,
      custom_fields: {},
    }));
  } catch (error) {
    if (Number.isInteger(error?.statusCode)) {
      return res.status(error.statusCode).json({
        message: error.message,
      });
    }

    return res.status(500).json({
      message: "Errore nella creazione cliente.",
      detail: error.message,
    });
  }
});

router.put("/:id", requirePermission("clients.write"), async (req, res) => {
  const studioId = Number(req.user?.studio_id);
  const clientId = parsePositiveInt(req.params.id);
  if (!clientId) {
    return res.status(400).json({
      message: "ID client non valido.",
    });
  }

  if (!hasOnlyKeys(req.body, updateKeys)) {
    return res.status(400).json({
      message: "Payload non valido.",
    });
  }

  const payload = resolveClientUpdatePayload(req.body);
  const updates = {};

  if (payload?.first_name !== undefined) {
    const firstName = normalizeRequiredText(payload.first_name, { min: 2, max: 100 });
    if (!firstName) {
      return res.status(400).json({ message: "Nome non valido (2-100 caratteri)." });
    }
    updates.first_name = firstName;
  }

  if (payload?.last_name !== undefined) {
    const lastName = normalizeRequiredText(payload.last_name, { min: 2, max: 100 });
    if (!lastName) {
      return res.status(400).json({ message: "Cognome non valido (2-100 caratteri)." });
    }
    updates.last_name = lastName;
  }

  if (payload?.phone !== undefined) {
    const phoneInput = payload.phone;
    if (phoneInput !== null && typeof phoneInput !== "string") {
      return res.status(400).json({ message: "Telefono non valido." });
    }
    const phone = normalizeOptionalText(phoneInput, { max: 30 });
    if (phone && !isValidPhone(phone)) {
      return res.status(400).json({ message: "Telefono non valido." });
    }
    updates.phone = phone;
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
    updates.email = email;
  }

  if (payload?.notes !== undefined) {
    const notesInput = payload.notes;
    if (notesInput !== null && typeof notesInput !== "string") {
      return res.status(400).json({ message: "Note non valide." });
    }
    const notes = normalizeOptionalText(notesInput, { max: 2000, multiline: true });
    if (typeof notesInput === "string" && notesInput.trim().length > 0 && notes === null) {
      return res.status(400).json({
        message: "Note non valide (massimo 2000 caratteri).",
      });
    }
    updates.notes = notes;
  }

  try {
    if (payload?.owner_user_id !== undefined) {
      const ownerUserId = parsePositiveInt(payload.owner_user_id);
      if (!ownerUserId) {
        return res.status(400).json({ message: "owner_user_id non valido." });
      }

      const owner = await findOwnerById(studioId, ownerUserId);
      if (!owner) {
        return res.status(400).json({
          message: "Il responsabile selezionato non esiste o non appartiene allo studio.",
        });
      }
      updates.owner_user_id = ownerUserId;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        message: "Nessun campo valido da aggiornare.",
      });
    }

    const updatedClient = await updateClientInLegacyStorage({
      studioId,
      clientId,
      updates,
    });

    if (!updatedClient) {
      return res.status(404).json({ message: "Client non trovato." });
    }

    let ownerDisplayName = null;

    if (updatedClient.owner_user_id) {
      const owner = await findOwnerById(studioId, updatedClient.owner_user_id);
      ownerDisplayName = owner?.owner_display_name ?? null;
    }

    return res.status(200).json(serializeClient({
      ...updatedClient,
      owner_display_name: ownerDisplayName,
      custom_fields: await listCustomFieldValues(studioId, "clients", Number(updatedClient.id)),
    }));
  } catch (error) {
    return res.status(500).json({
      message: "Errore nell'aggiornamento client.",
      detail: error.message,
    });
  }
});

router.delete("/:id", requirePermission("clients.write"), async (req, res) => {
  const studioId = Number(req.user?.studio_id);
  const clientId = parsePositiveInt(req.params.id);
  if (!clientId) {
    return res.status(400).json({
      message: "ID client non valido.",
    });
  }

  try {
    const deletedClient = await deleteClientFromLegacyStorage({
      studioId,
      clientId,
    });

    if (!deletedClient) {
      return res.status(404).json({ message: "Client non trovato." });
    }

    return res.status(200).json({
      message: "Client eliminato con successo.",
      id: deletedClient.id,
      client_id: deletedClient.client_id,
    });
  } catch (error) {
    if (error?.code === "23503") {
      return res.status(409).json({
        message: "Impossibile eliminare il paziente: esistono record collegati (es. fatture).",
      });
    }

    return res.status(500).json({
      message: "Errore nell'eliminazione client.",
      detail: error.message,
    });
  }
});

module.exports = router;
