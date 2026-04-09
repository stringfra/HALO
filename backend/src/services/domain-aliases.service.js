const { LEGACY_ROLE_ALIASES } = require("../config/multi-sector");

function toPlainObject(record) {
  return record && typeof record === "object" ? { ...record } : {};
}

function serializeClient(record) {
  const entity = toPlainObject(record);

  return {
    ...entity,
    client_id: entity.id ?? null,
    owner_user_id: entity.medico_id ?? null,
    owner_display_name: entity.medico_nome ?? null,
    first_name: entity.nome ?? null,
    last_name: entity.cognome ?? null,
  };
}

function serializeAppointment(record) {
  const entity = toPlainObject(record);

  return {
    ...entity,
    appointment_id: entity.id ?? null,
    client_id: entity.paziente_id ?? null,
    owner_display_name: entity.medico ?? null,
    appointment_status: entity.stato ?? null,
    appointment_date: entity.data ?? null,
  };
}

function serializeInvoice(record) {
  const entity = toPlainObject(record);

  return {
    ...entity,
    invoice_id: entity.fattura_id ?? entity.id ?? null,
    client_id: entity.paziente_id ?? null,
    invoice_status: entity.stato ?? null,
    payment_provider_status: entity.stripe_status ?? null,
    payment_checkout_url: entity.stripe_checkout_url ?? entity.stripe_payment_link ?? null,
  };
}

function serializeInventoryItem(record) {
  const entity = toPlainObject(record);

  return {
    ...entity,
    inventory_item_id: entity.id ?? null,
    stock_quantity: entity.quantita ?? null,
    reorder_threshold: entity.soglia_minima ?? null,
  };
}

function serializeUser(record) {
  const entity = toPlainObject(record);
  const roleKey = typeof entity.ruolo === "string" ? entity.ruolo.toUpperCase() : null;

  return {
    ...entity,
    user_id: entity.id ?? null,
    role_key: roleKey,
    role_alias: roleKey ? LEGACY_ROLE_ALIASES[roleKey] || roleKey : null,
  };
}

module.exports = {
  serializeAppointment,
  serializeClient,
  serializeInventoryItem,
  serializeInvoice,
  serializeUser,
};
