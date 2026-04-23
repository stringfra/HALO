const { pool } = require("../config/db");

const PRACTITIONER_ROLES = Object.freeze(["DENTISTA", "DIPENDENTE"]);

function resolveDbClient(dbClient) {
  return dbClient && typeof dbClient.query === "function" ? dbClient : pool;
}

async function findPractitionerById({ studioId, ownerUserId, dbClient }) {
  const client = resolveDbClient(dbClient);
  const result = await client.query(
    `SELECT id,
            nome AS owner_display_name
     FROM users
     WHERE id = $1
       AND studio_id = $2
       AND ruolo = ANY($3::text[])
     LIMIT 1`,
    [ownerUserId, studioId, PRACTITIONER_ROLES],
  );

  return result.rows[0] ?? null;
}

async function findAssignedOwnerForClient({ studioId, clientId, dbClient }) {
  const client = resolveDbClient(dbClient);
  const result = await client.query(
    `SELECT p.id AS client_id,
            p.medico_id AS owner_user_id,
            u.nome AS owner_display_name
     FROM pazienti p
     LEFT JOIN users u ON u.id = p.medico_id
                      AND u.studio_id = p.studio_id
                      AND u.ruolo = ANY($3::text[])
     WHERE p.id = $1
       AND p.studio_id = $2
     LIMIT 1`,
    [clientId, studioId, PRACTITIONER_ROLES],
  );

  return result.rows[0] ?? null;
}

async function clientExistsInLegacyStorage({ studioId, clientId, dbClient }) {
  const client = resolveDbClient(dbClient);
  const result = await client.query(
    `SELECT 1
     FROM pazienti
     WHERE id = $1
       AND studio_id = $2
     LIMIT 1`,
    [clientId, studioId],
  );
  return result.rowCount > 0;
}

async function listClientsFromLegacyStorage({ studioId, ownerUserId = null, dbClient }) {
  const client = resolveDbClient(dbClient);
  const params = [studioId];
  let query = `SELECT p.id,
                      p.id AS client_id,
                      p.nome AS first_name,
                      p.cognome AS last_name,
                      p.telefono AS phone,
                      p.email,
                      p.note AS notes,
                      (to_jsonb(p)->>'created_at')::timestamptz AS created_at,
                      p.medico_id AS owner_user_id,
                      u.nome AS owner_display_name
               FROM pazienti p
               LEFT JOIN users u ON u.id = p.medico_id
                                AND u.studio_id = p.studio_id
               WHERE p.studio_id = $1`;

  if (ownerUserId) {
    params.push(ownerUserId);
    query += " AND p.medico_id = $2";
  }

  query += " ORDER BY p.id DESC";
  const result = await client.query(query, params);
  return result.rows;
}

async function createClientInLegacyStorage({
  studioId,
  firstName,
  lastName,
  phone = null,
  email = null,
  notes = null,
  ownerUserId,
  dbClient,
}) {
  const client = resolveDbClient(dbClient);
  const result = await client.query(
    `INSERT INTO pazienti (studio_id, medico_id, nome, cognome, telefono, email, note)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id,
               id AS client_id,
               nome AS first_name,
               cognome AS last_name,
               telefono AS phone,
               email,
               note AS notes,
               (to_jsonb(pazienti)->>'created_at')::timestamptz AS created_at,
               medico_id AS owner_user_id`,
    [studioId, ownerUserId, firstName, lastName, phone, email, notes],
  );

  return result.rows[0] ?? null;
}

async function updateClientInLegacyStorage({ studioId, clientId, updates, dbClient }) {
  const client = resolveDbClient(dbClient);
  const mappings = [
    ["first_name", "nome"],
    ["last_name", "cognome"],
    ["phone", "telefono"],
    ["email", "email"],
    ["notes", "note"],
    ["owner_user_id", "medico_id"],
  ];

  const fields = [];
  const values = [];
  let index = 1;

  for (const [dtoKey, storageColumn] of mappings) {
    if (!Object.prototype.hasOwnProperty.call(updates || {}, dtoKey)) {
      continue;
    }
    fields.push(`${storageColumn} = $${index++}`);
    values.push(updates[dtoKey]);
  }

  if (fields.length === 0) {
    const error = new Error("Nessun campo client valido da aggiornare.");
    error.code = "CLIENT_NO_FIELDS";
    throw error;
  }

  values.push(clientId);
  values.push(studioId);

  const result = await client.query(
    `UPDATE pazienti
     SET ${fields.join(", ")}
     WHERE id = $${index}
       AND studio_id = $${index + 1}
     RETURNING id,
               id AS client_id,
               nome AS first_name,
               cognome AS last_name,
               telefono AS phone,
               email,
               note AS notes,
               (to_jsonb(pazienti)->>'created_at')::timestamptz AS created_at,
               medico_id AS owner_user_id`,
    values,
  );

  return result.rows[0] ?? null;
}

async function deleteClientFromLegacyStorage({ studioId, clientId, dbClient }) {
  const hasExternalClient = Boolean(dbClient && typeof dbClient.query === "function");
  const client = hasExternalClient ? dbClient : await pool.connect();

  try {
    if (!hasExternalClient) {
      await client.query("BEGIN");
    }

    // Remove invoice data first because fatture.paziente_id uses ON DELETE RESTRICT.
    await client.query(
      `DELETE FROM fatture
       WHERE studio_id = $1
         AND paziente_id = $2`,
      [studioId, clientId],
    );

    const result = await client.query(
      `DELETE FROM pazienti
       WHERE id = $1
         AND studio_id = $2
       RETURNING id, id AS client_id`,
      [clientId, studioId],
    );

    if (!hasExternalClient) {
      await client.query("COMMIT");
    }

    return result.rows[0] ?? null;
  } catch (error) {
    if (!hasExternalClient) {
      await client.query("ROLLBACK");
    }
    throw error;
  } finally {
    if (!hasExternalClient) {
      client.release();
    }
  }
}

async function listAppointmentsFromLegacyStorage({ studioId, ownerUserId = null, dbClient }) {
  const client = resolveDbClient(dbClient);
  const params = [studioId];
  let query = `SELECT a.id,
                      a.id AS appointment_id,
                      a.paziente_id AS client_id,
                      p.nome AS first_name,
                      p.cognome AS last_name,
                      TO_CHAR(a.data, 'DD MM YYYY') AS appointment_date,
                      a.ora AS appointment_time,
                      a.medico AS owner_display_name,
                      a.stato AS appointment_status
               FROM appuntamenti a
               LEFT JOIN pazienti p ON p.id = a.paziente_id
                                    AND p.studio_id = a.studio_id
               WHERE a.studio_id = $1`;

  if (ownerUserId) {
    params.push(ownerUserId);
    query += " AND p.medico_id = $2";
  }

  query += " ORDER BY a.data DESC, a.ora DESC, a.id DESC";
  const result = await client.query(query, params);
  return result.rows;
}

async function createAppointmentInLegacyStorage({
  studioId,
  clientId,
  appointmentDate,
  appointmentTime,
  ownerDisplayName,
  appointmentStatus = null,
  dbClient,
}) {
  const client = resolveDbClient(dbClient);
  const result = await client.query(
    `INSERT INTO appuntamenti (studio_id, paziente_id, data, ora, medico, stato)
     SELECT $1, p.id, $3, $4, $5, COALESCE($6, 'in_attesa')
     FROM pazienti p
     WHERE p.id = $2
       AND p.studio_id = $1
     RETURNING id,
               id AS appointment_id,
               paziente_id AS client_id,
               TO_CHAR(data, 'DD MM YYYY') AS appointment_date,
               ora AS appointment_time,
               medico AS owner_display_name,
               stato AS appointment_status`,
    [studioId, clientId, appointmentDate, appointmentTime, ownerDisplayName, appointmentStatus],
  );

  return result.rows[0] ?? null;
}

async function updateAppointmentInLegacyStorage({
  studioId,
  appointmentId,
  updates,
  dbClient,
}) {
  const client = resolveDbClient(dbClient);

  if (Object.prototype.hasOwnProperty.call(updates || {}, "client_id")) {
    const exists = await clientExistsInLegacyStorage({
      studioId,
      clientId: updates.client_id,
      dbClient: client,
    });
    if (!exists) {
      const error = new Error("Il client selezionato non esiste.");
      error.code = "APPOINTMENT_CLIENT_NOT_FOUND";
      throw error;
    }
  }

  const mappings = [
    ["client_id", "paziente_id"],
    ["appointment_date", "data"],
    ["appointment_time", "ora"],
    ["owner_display_name", "medico"],
    ["appointment_status", "stato"],
  ];

  const fields = [];
  const values = [];
  let index = 1;

  for (const [dtoKey, storageColumn] of mappings) {
    if (!Object.prototype.hasOwnProperty.call(updates || {}, dtoKey)) {
      continue;
    }
    fields.push(`${storageColumn} = $${index++}`);
    values.push(updates[dtoKey]);
  }

  if (fields.length === 0) {
    const error = new Error("Nessun campo appointment valido da aggiornare.");
    error.code = "APPOINTMENT_NO_FIELDS";
    throw error;
  }

  values.push(appointmentId);
  values.push(studioId);

  const result = await client.query(
    `UPDATE appuntamenti
     SET ${fields.join(", ")}
     WHERE id = $${index}
       AND studio_id = $${index + 1}
     RETURNING id,
               id AS appointment_id,
               paziente_id AS client_id,
               TO_CHAR(data, 'DD MM YYYY') AS appointment_date,
               ora AS appointment_time,
               medico AS owner_display_name,
               stato AS appointment_status`,
    values,
  );

  return result.rows[0] ?? null;
}

async function deleteAppointmentFromLegacyStorage({ studioId, appointmentId, dbClient }) {
  const client = resolveDbClient(dbClient);
  const result = await client.query(
    `DELETE FROM appuntamenti
     WHERE id = $1
       AND studio_id = $2
     RETURNING id, id AS appointment_id`,
    [appointmentId, studioId],
  );

  return result.rows[0] ?? null;
}

module.exports = {
  createAppointmentInLegacyStorage,
  createClientInLegacyStorage,
  deleteAppointmentFromLegacyStorage,
  deleteClientFromLegacyStorage,
  findAssignedOwnerForClient,
  findPractitionerById,
  listAppointmentsFromLegacyStorage,
  listClientsFromLegacyStorage,
  updateAppointmentInLegacyStorage,
  updateClientInLegacyStorage,
};
