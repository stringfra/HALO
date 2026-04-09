const CORE_ENTITY_SOURCES = Object.freeze({
  clients: {
    sourceName: "core_clients",
    legacySourceName: "pazienti",
    primaryKey: "id",
  },
  appointments: {
    sourceName: "core_appointments",
    legacySourceName: "appuntamenti",
    primaryKey: "id",
  },
  billing: {
    sourceName: "core_invoices",
    legacySourceName: "fatture",
    primaryKey: "id",
  },
  inventory: {
    sourceName: "core_inventory_items",
    legacySourceName: "prodotti",
    primaryKey: "id",
  },
});

function getCoreEntitySource(entityKey) {
  return CORE_ENTITY_SOURCES[entityKey] || null;
}

module.exports = {
  CORE_ENTITY_SOURCES,
  getCoreEntitySource,
};
