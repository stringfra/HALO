const express = require("express");
const { generateAppointmentReminders } = require("../services/reminder.service");
const { generatePatientRecalls } = require("../services/recall.service");
const { verifyToken, requirePermission } = require("../../middlewares/authMiddleware");
const { requireFeature } = require("../middleware/feature-flags");
const { attachRequestContext } = require("../middleware/request-context");

const router = express.Router();

router.use(verifyToken);
router.use(attachRequestContext);
router.use(requireFeature("automation.enabled"));

router.get("/reminder-appuntamenti", requirePermission("automations.read"), async (req, res) => {
  try {
    const reminders = await generateAppointmentReminders({
      studioId: Number(req.user?.studio_id),
      daysAhead: req.query?.daysAhead ?? 1,
      labels: req.tenant?.labels || {},
    });

    return res.status(200).json(reminders);
  } catch (error) {
    const statusCode =
      Number.isInteger(error?.statusCode) && error.statusCode >= 400
        ? error.statusCode
        : 500;

    return res.status(statusCode).json({
      message:
        statusCode === 400
          ? error.message
          : "Errore nella generazione reminder appuntamenti.",
      detail: statusCode >= 500 ? error.message : undefined,
    });
  }
});

router.get("/richiami-pazienti", requirePermission("automations.read"), async (req, res) => {
  try {
    const recalls = await generatePatientRecalls({
      studioId: Number(req.user?.studio_id),
      labels: req.tenant?.labels || {},
      daysWithoutVisit: req.query?.daysWithoutVisit,
      upcomingWindowDays: req.query?.upcomingWindowDays,
      limit: req.query?.limit,
    });

    return res.status(200).json(recalls);
  } catch (error) {
    const statusCode =
      Number.isInteger(error?.statusCode) && error.statusCode >= 400
        ? error.statusCode
        : 500;

    return res.status(statusCode).json({
      message:
        statusCode === 400
          ? error.message
          : "Errore nella generazione richiami pazienti.",
      detail: statusCode >= 500 ? error.message : undefined,
    });
  }
});

module.exports = router;
