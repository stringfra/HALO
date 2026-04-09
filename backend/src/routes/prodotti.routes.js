const express = require("express");
const { pool } = require("../config/db");
const { verifyToken, authorize, requirePermission } = require("../../middlewares/authMiddleware");
const { requireFeature } = require("../middleware/feature-flags");
const { serializeInventoryItem } = require("../services/domain-aliases.service");
const {
  hasOnlyKeys,
  normalizeRequiredText,
  parseNonNegativeInt,
  parsePositiveInt,
} = require("../validation/input");

const router = express.Router();

const createKeys = [
  "nome",
  "quantita",
  "soglia_minima",
  "name",
  "stock_quantity",
  "reorder_threshold",
];
const updateKeys = createKeys;
const adminRoles = ["ADMIN"];

function resolveInventoryPayload(body) {
  return {
    nome: body?.nome ?? body?.name,
    quantita: body?.quantita ?? body?.stock_quantity,
    soglia_minima: body?.soglia_minima ?? body?.reorder_threshold,
  };
}

router.use(verifyToken);
router.use(requireFeature("inventory.enabled"));
router.use(requirePermission("inventory.read"));

router.get("/", async (req, res) => {
  try {
    const studioId = Number(req.user?.studio_id);

    const result = await pool.query(
      `SELECT id,
              nome,
              quantita,
              soglia_minima,
              (quantita <= soglia_minima) AS sotto_soglia,
              GREATEST(soglia_minima - quantita, 0) AS da_riordinare
       FROM prodotti
       WHERE studio_id = $1
       ORDER BY id DESC`,
      [studioId],
    );

    return res.status(200).json(result.rows.map(serializeInventoryItem));
  } catch (error) {
    return res.status(500).json({
      message: "Errore nel recupero prodotti.",
      detail: error.message,
    });
  }
});

router.get("/sotto-soglia", async (req, res) => {
  try {
    const studioId = Number(req.user?.studio_id);

    const result = await pool.query(
      `SELECT id,
              nome,
              quantita,
              soglia_minima,
              (quantita <= soglia_minima) AS sotto_soglia,
              GREATEST(soglia_minima - quantita, 0) AS da_riordinare
       FROM prodotti
       WHERE studio_id = $1
         AND quantita <= soglia_minima
       ORDER BY da_riordinare DESC, id DESC`,
      [studioId],
    );

    return res.status(200).json(result.rows.map(serializeInventoryItem));
  } catch (error) {
    return res.status(500).json({
      message: "Errore nel recupero prodotti sotto soglia.",
      detail: error.message,
    });
  }
});

router.post("/", async (req, res) => {
  const canWriteInventory = req.user?.permissions?.includes("inventory.write");
  if (!canWriteInventory) {
    return res.status(403).json({
      message: "Accesso negato: permesso non autorizzato.",
    });
  }

  if (!hasOnlyKeys(req.body, createKeys)) {
    return res.status(400).json({ message: "Payload non valido." });
  }

  const payload = resolveInventoryPayload(req.body);
  const nome = normalizeRequiredText(payload?.nome, { min: 2, max: 120 });
  const quantita = parseNonNegativeInt(payload?.quantita, { max: 1000000 });
  const sogliaMinima = parseNonNegativeInt(payload?.soglia_minima, {
    max: 1000000,
  });

  if (!nome || quantita === null || sogliaMinima === null) {
    return res.status(400).json({
      message: "Campi richiesti: nome, quantita >= 0, soglia_minima >= 0.",
    });
  }

  try {
    const studioId = Number(req.user?.studio_id);

    const result = await pool.query(
      `INSERT INTO prodotti (studio_id, nome, quantita, soglia_minima)
       VALUES ($1, $2, $3, $4)
       RETURNING id,
                 nome,
                 quantita,
                 soglia_minima,
                 (quantita <= soglia_minima) AS sotto_soglia,
                 GREATEST(soglia_minima - quantita, 0) AS da_riordinare`,
      [studioId, nome, quantita, sogliaMinima],
    );

    return res.status(201).json(serializeInventoryItem(result.rows[0]));
  } catch (error) {
    return res.status(500).json({
      message: "Errore nella creazione prodotto.",
      detail: error.message,
    });
  }
});

router.put("/:id", async (req, res) => {
  const canWriteInventory = req.user?.permissions?.includes("inventory.write");
  if (!canWriteInventory) {
    return res.status(403).json({
      message: "Accesso negato: permesso non autorizzato.",
    });
  }

  const studioId = Number(req.user?.studio_id);
  const productId = parsePositiveInt(req.params.id);
  if (!productId) {
    return res.status(400).json({
      message: "ID prodotto non valido.",
    });
  }

  if (!hasOnlyKeys(req.body, updateKeys)) {
    return res.status(400).json({ message: "Payload non valido." });
  }

  const payload = resolveInventoryPayload(req.body);
  const fields = [];
  const values = [];
  let index = 1;

  if (payload?.nome !== undefined) {
    const nome = normalizeRequiredText(payload.nome, { min: 2, max: 120 });
    if (!nome) {
      return res.status(400).json({ message: "Nome prodotto non valido." });
    }
    fields.push(`nome = $${index++}`);
    values.push(nome);
  }

  if (payload?.quantita !== undefined) {
    const quantita = parseNonNegativeInt(payload.quantita, { max: 1000000 });
    if (quantita === null) {
      return res.status(400).json({
        message: "Quantita non valida. Deve essere un intero >= 0.",
      });
    }
    fields.push(`quantita = $${index++}`);
    values.push(quantita);
  }

  if (payload?.soglia_minima !== undefined) {
    const sogliaMinima = parseNonNegativeInt(payload.soglia_minima, {
      max: 1000000,
    });
    if (sogliaMinima === null) {
      return res.status(400).json({
        message: "Soglia minima non valida. Deve essere un intero >= 0.",
      });
    }
    fields.push(`soglia_minima = $${index++}`);
    values.push(sogliaMinima);
  }

  if (fields.length === 0) {
    return res.status(400).json({
      message: "Nessun campo valido da aggiornare.",
    });
  }

  values.push(productId);
  values.push(studioId);

  try {
    const result = await pool.query(
      `UPDATE prodotti
       SET ${fields.join(", ")}
       WHERE id = $${index}
         AND studio_id = $${index + 1}
       RETURNING id,
                 nome,
                 quantita,
                 soglia_minima,
                 (quantita <= soglia_minima) AS sotto_soglia,
                 GREATEST(soglia_minima - quantita, 0) AS da_riordinare`,
      values,
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        message: "Prodotto non trovato.",
      });
    }

    return res.status(200).json(serializeInventoryItem(result.rows[0]));
  } catch (error) {
    return res.status(500).json({
      message: "Errore nell'aggiornamento prodotto.",
      detail: error.message,
    });
  }
});

router.delete("/:id", async (req, res) => {
  const canWriteInventory = req.user?.permissions?.includes("inventory.write");
  if (!canWriteInventory) {
    return res.status(403).json({
      message: "Accesso negato: permesso non autorizzato.",
    });
  }

  const studioId = Number(req.user?.studio_id);
  const productId = parsePositiveInt(req.params.id);
  if (!productId) {
    return res.status(400).json({
      message: "ID prodotto non valido.",
    });
  }

  try {
    const result = await pool.query(
      `DELETE FROM prodotti
       WHERE id = $1
         AND studio_id = $2
       RETURNING id`,
      [productId, studioId],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        message: "Prodotto non trovato.",
      });
    }

    return res.status(200).json({
      message: "Prodotto eliminato con successo.",
      id: result.rows[0].id,
      inventory_item_id: result.rows[0].id,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Errore nell'eliminazione prodotto.",
      detail: error.message,
    });
  }
});

module.exports = router;
