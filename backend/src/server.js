const express = require("express");
const { testDatabaseConnection } = require("./config/db");
const pazientiRoutes = require("./routes/pazienti.routes");
const appuntamentiRoutes = require("./routes/appuntamenti.routes");
const fattureRoutes = require("./routes/fatture.routes");
const statsRoutes = require("./routes/stats.routes");
const prodottiRoutes = require("./routes/prodotti.routes");
const automazioniRoutes = require("./routes/automazioni.routes");
const stripeRoutes = require("./routes/stripe.routes");
const usersRoutes = require("./routes/users.routes");
const bootstrapRoutes = require("./routes/bootstrap.routes");
const customFieldsRoutes = require("./routes/custom-fields.routes");
const tenantConfigRoutes = require("./routes/tenant-config.routes");
const googleCalendarRoutes = require("./routes/google-calendar.routes");
const {
  startAppointmentSyncWorker,
  stopAppointmentSyncWorker,
} = require("./services/appointment-sync-worker.service");
const authRoutes = require("../routes/authRoutes");
const {
  attachRequestId,
  notFoundHandler,
  errorHandler,
} = require("./middleware/error-handler");

const app = express();
const port = Number(process.env.PORT || 4000);
const clientUrl = process.env.CLIENT_URL || "*";

app.use(attachRequestId);
app.use("/stripe", stripeRoutes);
app.use(express.json({ limit: "1mb" }));
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", clientUrl);
  res.header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.header(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization",
  );

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  return next();
});

app.get("/", (_req, res) => {
  res.status(200).json({
    app: "HALO Backend",
    status: "online",
  });
});

app.get("/api/test", (_req, res) => {
  res.status(200).json({
    ok: true,
    message: "API test endpoint attivo",
    timestamp: new Date().toISOString(),
  });
});

app.use("/pazienti", pazientiRoutes);
app.use("/appuntamenti", appuntamentiRoutes);
app.use("/fatture", fattureRoutes);
app.use("/stats", statsRoutes);
app.use("/prodotti", prodottiRoutes);
app.use("/automazioni", automazioniRoutes);
app.use("/api", authRoutes);
app.use("/api", bootstrapRoutes);
app.use("/api/v2/clients", pazientiRoutes);
app.use("/api/v2/appointments", appuntamentiRoutes);
app.use("/api/v2/invoices", fattureRoutes);
app.use("/api/v2/inventory-items", prodottiRoutes);
app.use("/api/v2/users", usersRoutes);
app.use("/api/custom-fields", customFieldsRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/admin", tenantConfigRoutes);
app.use("/api/v3/integrations/google-calendar", googleCalendarRoutes);
app.use(notFoundHandler);
app.use(errorHandler);

async function bootstrapServer() {
  await testDatabaseConnection();
  startAppointmentSyncWorker();

  app.listen(port, () => {
    console.log(`HALO backend in ascolto su http://localhost:${port}`);
  });
}

bootstrapServer();

process.on("SIGINT", () => {
  stopAppointmentSyncWorker();
  process.exit(0);
});

process.on("SIGTERM", () => {
  stopAppointmentSyncWorker();
  process.exit(0);
});
