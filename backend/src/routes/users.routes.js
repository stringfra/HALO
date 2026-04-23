const express = require("express");
const bcrypt = require("bcrypt");
const { pool } = require("../config/db");
const { verifyToken, requirePermission } = require("../../middlewares/authMiddleware");
const { serializeUser } = require("../services/domain-aliases.service");
const { countTenantAdmins, createTenantUser, updateTenantUserProfile } = require("../services/tenant-user-management.service");
const { listTenantAssignableSystemRoleKeys } = require("../services/platform-rbac-tools.service");
const {
  hasOnlyKeys,
  isStrongPassword,
  normalizeEmailIdentity,
  normalizeRequiredText,
  parsePositiveInt,
} = require("../validation/input");

const router = express.Router();

const createKeys = ["nome", "email", "password", "ruolo", "display_name", "role_key"];
const updateKeys = createKeys;

function resolveUserPayload(body) {
  return {
    nome: body?.nome ?? body?.display_name,
    email: body?.email,
    password: body?.password,
    ruolo: body?.ruolo ?? body?.role_key,
  };
}

router.use(verifyToken);

async function getAllowedRoleKeysForTenant(studioId) {
  const roleKeys = await listTenantAssignableSystemRoleKeys(studioId);
  return new Set(roleKeys);
}

router.get("/", requirePermission("users.read"), async (req, res) => {
  try {
    const studioId = Number(req.user?.studio_id);
    const allowedRoles = await getAllowedRoleKeysForTenant(studioId);
    const requestedRole =
      typeof (req.query?.ruolo ?? req.query?.role_key) === "string"
        ? String(req.query?.ruolo ?? req.query?.role_key)
            .trim()
            .toUpperCase()
        : null;

    if (requestedRole && !allowedRoles.has(requestedRole)) {
      return res.status(400).json({
        message: "Ruolo non valido.",
      });
    }

    const params = [studioId];
    let query = `SELECT id,
                        nome,
                        email,
                        ruolo,
                        created_at
                 FROM users
                 WHERE studio_id = $1`;

    if (requestedRole) {
      params.push(requestedRole);
      query += " AND ruolo = $2";
    }

    query += " ORDER BY id ASC";

    const result = await pool.query(query, params);

    return res.status(200).json(result.rows.map(serializeUser));
  } catch (error) {
    return res.status(500).json({
      message: "Errore nel recupero utenti.",
      detail: error.message,
    });
  }
});

router.post("/", requirePermission("users.write"), async (req, res) => {
  if (!hasOnlyKeys(req.body, createKeys)) {
    return res.status(400).json({
      message: "Payload non valido.",
    });
  }

  const payload = resolveUserPayload(req.body);
  const nome = normalizeRequiredText(payload?.nome, { min: 2, max: 120 });
  const email = normalizeEmailIdentity(payload?.email);
  const password = normalizeRequiredText(payload?.password, { min: 8, max: 255 });
  const ruolo = typeof payload?.ruolo === "string" ? payload.ruolo.trim().toUpperCase() : "";

  if (!nome || !email || !password || !isStrongPassword(password)) {
    return res.status(400).json({
      message:
        "Campi non validi. Password richiesta: minimo 8, maiuscola, minuscola, numero e simbolo.",
    });
  }

  const saltRounds = Number.parseInt(process.env.SALT_ROUNDS || "10", 10);
  if (!Number.isInteger(saltRounds) || saltRounds < 4 || saltRounds > 15) {
    return res.status(500).json({
      message: "Configurazione SALT_ROUNDS non valida.",
    });
  }

  try {
    const studioId = Number(req.user?.studio_id);
    const allowedRoles = await getAllowedRoleKeysForTenant(studioId);

    if (!allowedRoles.has(ruolo)) {
      return res.status(400).json({
        message: "Ruolo non valido per il tenant corrente.",
      });
    }

    const passwordHash = await bcrypt.hash(password, saltRounds);
    const client = await pool.connect();

    try {
      await client.query("BEGIN");
      const created = await createTenantUser(client, {
        studioId,
        nome,
        email,
        passwordHash,
        ruolo,
      });
      const result = await client.query(
        `SELECT id, nome, email, ruolo, created_at
         FROM users
         WHERE id = $1
           AND studio_id = $2
         LIMIT 1`,
        [created.userId, studioId],
      );

      const createdUser = result.rows[0];
      if (!createdUser) {
        await client.query("ROLLBACK");
        return res.status(500).json({
          message: "Utente creato ma non rileggibile.",
        });
      }

      await client.query("COMMIT");
      return res.status(201).json(serializeUser(createdUser));
    } catch (error) {
      await client.query("ROLLBACK");

      if (error?.code === "TENANT_SYSTEM_ROLE_NOT_AVAILABLE") {
        return res.status(409).json({
          message: "Ruolo di sistema tenant non disponibile.",
        });
      }
      if (error?.code === "TENANT_USER_INVALID_EMAIL") {
        return res.status(400).json({
          message: "Email non valida.",
        });
      }

      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        message: "Email gia in uso.",
      });
    }

    return res.status(500).json({
      message: "Errore nella creazione utente.",
      detail: error.message,
    });
  }
});

router.put("/:id", requirePermission("users.write"), async (req, res) => {
  const studioId = Number(req.user?.studio_id);
  const userId = parsePositiveInt(req.params.id);
  if (!userId) {
    return res.status(400).json({
      message: "ID utente non valido.",
    });
  }

  if (!hasOnlyKeys(req.body, updateKeys)) {
    return res.status(400).json({
      message: "Payload non valido.",
    });
  }

  const payload = resolveUserPayload(req.body);
  let nextRole;
  const updates = {};

  if (payload?.nome !== undefined) {
    const nome = normalizeRequiredText(payload.nome, { min: 2, max: 120 });
    if (!nome) {
      return res.status(400).json({
        message: "Nome non valido (2-120 caratteri).",
      });
    }
    updates.nome = nome;
  }

  if (payload?.email !== undefined) {
    const email = normalizeEmailIdentity(payload.email);
    if (!email) {
      return res.status(400).json({
        message: "Email non valida.",
      });
    }
    updates.email = email;
  }

  if (payload?.ruolo !== undefined) {
    const ruolo =
      typeof payload.ruolo === "string" ? payload.ruolo.trim().toUpperCase() : "";
    const allowedRoles = await getAllowedRoleKeysForTenant(studioId);
    if (!allowedRoles.has(ruolo)) {
      return res.status(400).json({
        message: "Ruolo non valido per il tenant corrente.",
      });
    }
    nextRole = ruolo;
    updates.nextRole = ruolo;
  }

  if (payload?.password !== undefined) {
    const password = normalizeRequiredText(payload.password, { min: 8, max: 255 });
    if (!password || !isStrongPassword(password)) {
      return res.status(400).json({
        message:
          "Password non valida. Usa almeno 8 caratteri con maiuscola, minuscola, numero e simbolo.",
      });
    }

    const saltRounds = Number.parseInt(process.env.SALT_ROUNDS || "10", 10);
    if (!Number.isInteger(saltRounds) || saltRounds < 4 || saltRounds > 15) {
      return res.status(500).json({
        message: "Configurazione SALT_ROUNDS non valida.",
      });
    }

    updates.passwordHash = await bcrypt.hash(password, saltRounds);
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({
      message: "Nessun campo valido da aggiornare.",
    });
  }

  try {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const updateResult = await updateTenantUserProfile(client, {
        client,
        studioId,
        userId,
        updates,
      });
      const result = await client.query(
        `SELECT id, nome, email, ruolo, created_at
         FROM users
         WHERE id = $1
           AND studio_id = $2
         LIMIT 1`,
        [updateResult.updatedUserId, studioId],
      );

      if (!result.rows[0]) {
        await client.query("ROLLBACK");
        return res.status(500).json({
          message: "Utente aggiornato ma non rileggibile.",
        });
      }

      await client.query("COMMIT");
      return res.status(200).json(serializeUser(result.rows[0]));
    } catch (error) {
      await client.query("ROLLBACK");
      if (error?.code === "TENANT_USER_NOT_FOUND") {
        return res.status(404).json({
          message: "Utente non trovato.",
        });
      }
      if (error?.code === "TENANT_LAST_ADMIN_CONFLICT") {
        return res.status(409).json({
          message: "Non puoi rimuovere l'ultimo ADMIN del tenant.",
        });
      }
      if (error?.code === "TENANT_SYSTEM_ROLE_NOT_AVAILABLE") {
        return res.status(409).json({
          message: "Ruolo di sistema tenant non disponibile.",
        });
      }
      if (error?.code === "TENANT_USER_INVALID_EMAIL") {
        return res.status(400).json({
          message: "Email non valida.",
        });
      }
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        message: "Email gia in uso.",
      });
    }

    return res.status(500).json({
      message: "Errore nell'aggiornamento utente.",
      detail: error.message,
    });
  }
});

router.delete("/:id", requirePermission("users.write"), async (req, res) => {
  const studioId = Number(req.user?.studio_id);
  const userId = parsePositiveInt(req.params.id);
  if (!userId) {
    return res.status(400).json({
      message: "ID utente non valido.",
    });
  }

  if (Number(req.user?.id) === userId) {
    return res.status(400).json({
      message: "Non puoi eliminare il tuo utente corrente.",
    });
  }

  try {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");
      const currentUserResult = await client.query(
        `SELECT id, ruolo
         FROM users
         WHERE id = $1
           AND studio_id = $2
         LIMIT 1`,
        [userId, studioId],
      );

      if (currentUserResult.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({
          message: "Utente non trovato.",
        });
      }

      const currentUser = currentUserResult.rows[0];
      if (currentUser.ruolo === "ADMIN") {
        const adminCount = await countTenantAdmins(client, studioId);
        if (adminCount <= 1) {
          await client.query("ROLLBACK");
          return res.status(409).json({
            message: "Non puoi eliminare l'ultimo ADMIN del tenant.",
          });
        }
      }

      const result = await client.query(
        `DELETE FROM users
         WHERE id = $1
           AND studio_id = $2
         RETURNING id`,
        [userId, studioId],
      );

      await client.query("COMMIT");

      return res.status(200).json({
        message: "Utente eliminato con successo.",
        id: result.rows[0].id,
        user_id: result.rows[0].id,
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    return res.status(500).json({
      message: "Errore nell'eliminazione utente.",
      detail: error.message,
    });
  }
});

module.exports = router;
