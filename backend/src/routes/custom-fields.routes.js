const express = require("express");
const { verifyToken, requirePermission } = require("../../middlewares/authMiddleware");
const { requireFeature } = require("../middleware/feature-flags");
const {
  deleteCustomFieldDefinition,
  isValidEntityKey,
  listCustomFieldDefinitions,
  listCustomFieldValues,
  saveCustomFieldValues,
  upsertCustomFieldDefinition,
} = require("../services/custom-fields.service");
const { parsePositiveInt } = require("../validation/input");

const router = express.Router();

router.use(verifyToken);
router.use(requireFeature("custom_fields.enabled"));

router.get("/definitions/:entityKey", requirePermission("settings.manage"), async (req, res) => {
  const studioId = Number(req.user?.studio_id);
  const entityKey = String(req.params?.entityKey || "").trim().toLowerCase();

  if (!isValidEntityKey(entityKey)) {
    return res.status(400).json({ message: "entityKey non valido." });
  }

  try {
    const definitions = await listCustomFieldDefinitions(studioId, entityKey);
    return res.status(200).json(definitions);
  } catch (error) {
    return res.status(500).json({
      message: "Errore nel recupero custom fields.",
      detail: error.message,
    });
  }
});

router.post("/definitions", requirePermission("settings.manage"), async (req, res) => {
  const studioId = Number(req.user?.studio_id);

  try {
    const definition = await upsertCustomFieldDefinition(studioId, req.body);
    return res.status(201).json(definition);
  } catch (error) {
    return res.status(400).json({
      message: error.message || "Custom field non valido.",
    });
  }
});

router.delete(
  "/definitions/:entityKey/:fieldKey",
  requirePermission("settings.manage"),
  async (req, res) => {
    const studioId = Number(req.user?.studio_id);
    const entityKey = String(req.params?.entityKey || "").trim().toLowerCase();
    const fieldKey = String(req.params?.fieldKey || "").trim().toLowerCase();

    if (!isValidEntityKey(entityKey) || !fieldKey) {
      return res.status(400).json({ message: "Parametri non validi." });
    }

    try {
      const deleted = await deleteCustomFieldDefinition(studioId, entityKey, fieldKey);
      if (!deleted) {
        return res.status(404).json({ message: "Custom field non trovato." });
      }

      return res.status(200).json({ deleted: true });
    } catch (error) {
      return res.status(500).json({
        message: "Errore nella cancellazione custom field.",
        detail: error.message,
      });
    }
  },
);

router.get("/:entityKey/:recordId", requirePermission("clients.read"), async (req, res) => {
  const studioId = Number(req.user?.studio_id);
  const entityKey = String(req.params?.entityKey || "").trim().toLowerCase();
  const recordId = parsePositiveInt(req.params?.recordId);

  if (!isValidEntityKey(entityKey) || !recordId) {
    return res.status(400).json({ message: "Parametri non validi." });
  }

  try {
    const values = await listCustomFieldValues(studioId, entityKey, recordId);
    return res.status(200).json(values);
  } catch (error) {
    return res.status(500).json({
      message: "Errore nel recupero valori custom field.",
      detail: error.message,
    });
  }
});

router.put("/:entityKey/:recordId", requirePermission("clients.write"), async (req, res) => {
  const studioId = Number(req.user?.studio_id);
  const entityKey = String(req.params?.entityKey || "").trim().toLowerCase();
  const recordId = parsePositiveInt(req.params?.recordId);

  if (!isValidEntityKey(entityKey) || !recordId) {
    return res.status(400).json({ message: "Parametri non validi." });
  }

  try {
    const values = await saveCustomFieldValues(studioId, entityKey, recordId, req.body);
    return res.status(200).json(values);
  } catch (error) {
    return res.status(400).json({
      message: error.message || "Errore nel salvataggio valori custom field.",
    });
  }
});

module.exports = router;
