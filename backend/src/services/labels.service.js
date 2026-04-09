const { getTenantConfigById } = require("./tenant-config.service");

async function getLabelsForStudio(studioId) {
  const tenant = await getTenantConfigById(studioId);
  return tenant?.labels || {};
}

function getEntityDisplayName(labels, entityKey, { plural = false } = {}) {
  const safeLabels = labels && typeof labels === "object" ? labels : {};

  if (entityKey === "clients") {
    return plural ? safeLabels.client_plural || "Clienti" : safeLabels.client_singular || "Cliente";
  }
  if (entityKey === "appointments") {
    return plural
      ? safeLabels.appointment_plural || "Appuntamenti"
      : safeLabels.appointment_singular || "Appuntamento";
  }
  if (entityKey === "billing") {
    return plural ? safeLabels.invoice_plural || "Fatture" : safeLabels.invoice_singular || "Fattura";
  }
  if (entityKey === "inventory") {
    return plural
      ? safeLabels.inventory_plural || "Magazzino"
      : safeLabels.inventory_singular || "Prodotto";
  }

  return plural ? entityKey : entityKey;
}

module.exports = {
  getEntityDisplayName,
  getLabelsForStudio,
};
