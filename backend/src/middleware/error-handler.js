const crypto = require("crypto");

function attachRequestId(req, res, next) {
  const incomingId = req.headers["x-request-id"];
  const requestId =
    typeof incomingId === "string" && incomingId.trim().length > 0
      ? incomingId.trim()
      : crypto.randomUUID();

  req.requestId = requestId;
  res.setHeader("x-request-id", requestId);
  next();
}

function notFoundHandler(req, res) {
  return res.status(404).json({
    message: "Endpoint non trovato.",
    method: req.method,
    path: req.originalUrl,
    requestId: req.requestId,
  });
}

function errorHandler(err, req, res, _next) {
  if (res.headersSent) {
    return;
  }

  if (err?.type === "entity.parse.failed") {
    return res.status(400).json({
      message: "Payload JSON non valido.",
      requestId: req.requestId,
    });
  }

  const status =
    Number.isInteger(err?.statusCode) && err.statusCode >= 400 && err.statusCode < 600
      ? err.statusCode
      : 500;

  const isDevelopment = process.env.NODE_ENV !== "production";
  const safeMessage =
    status >= 500
      ? "Errore interno del server."
      : typeof err?.message === "string" && err.message
        ? err.message
        : "Richiesta non valida.";

  const body = {
    message: safeMessage,
    requestId: req.requestId,
  };

  if (isDevelopment && status >= 500) {
    body.detail = err?.message || "Unknown error";
  }

  return res.status(status).json(body);
}

module.exports = {
  attachRequestId,
  notFoundHandler,
  errorHandler,
};
