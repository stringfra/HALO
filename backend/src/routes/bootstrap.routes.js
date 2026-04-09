const express = require("express");
const { verifyToken } = require("../../middlewares/authMiddleware");
const { getTenantBootstrap } = require("../services/feature-flags.service");

const router = express.Router();

router.get("/bootstrap", verifyToken, async (req, res) => {
  try {
    const bootstrap = await getTenantBootstrap(req.user);

    if (!bootstrap) {
      return res.status(404).json({
        message: "Configurazione tenant non trovata.",
      });
    }

    return res.status(200).json(bootstrap);
  } catch (error) {
    return res.status(500).json({
      message: "Errore nel bootstrap tenant.",
      detail: error.message,
    });
  }
});

module.exports = router;
