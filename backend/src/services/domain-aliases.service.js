const { LEGACY_ROLE_ALIASES } = require("../config/multi-sector");

function toPlainObject(record) {
  return record && typeof record === "object" ? { ...record } : {};
}

function serializeClient(record) {
  const entity = toPlainObject(record);
  const id = entity.client_id ?? entity.id ?? null;
  const firstName = entity.first_name ?? entity.nome ?? null;
  const lastName = entity.last_name ?? entity.cognome ?? null;
  const phone = entity.phone ?? entity.telefono ?? null;
  const notes = entity.notes ?? entity.note ?? null;
  const ownerUserId = entity.owner_user_id ?? entity.medico_id ?? null;
  const ownerDisplayName = entity.owner_display_name ?? entity.medico_nome ?? null;
  const createdAt = entity.created_at ?? entity.createdAt ?? null;

  return {
    ...entity,
    id,
    client_id: id,
    first_name: firstName,
    last_name: lastName,
    phone,
    notes,
    owner_user_id: ownerUserId,
    owner_display_name: ownerDisplayName,
    created_at: createdAt,
    createdAt,
    nome: firstName,
    cognome: lastName,
    telefono: phone,
    note: notes,
    medico_id: ownerUserId,
    medico_nome: ownerDisplayName,
  };
}

function serializeAppointment(record) {
  const entity = toPlainObject(record);
  const id = entity.appointment_id ?? entity.id ?? null;
  const clientId = entity.client_id ?? entity.paziente_id ?? null;
  const appointmentDate = entity.appointment_date ?? entity.data ?? null;
  const appointmentTime = entity.appointment_time ?? entity.ora ?? null;
  const ownerDisplayName = entity.owner_display_name ?? entity.medico ?? null;
  const appointmentStatus = entity.appointment_status ?? entity.stato ?? null;
  const firstName = entity.first_name ?? entity.nome ?? null;
  const lastName = entity.last_name ?? entity.cognome ?? null;

  return {
    ...entity,
    id,
    appointment_id: id,
    client_id: clientId,
    appointment_date: appointmentDate,
    appointment_time: appointmentTime,
    owner_display_name: ownerDisplayName,
    appointment_status: appointmentStatus,
    first_name: firstName,
    last_name: lastName,
    paziente_id: clientId,
    data: appointmentDate,
    ora: appointmentTime,
    medico: ownerDisplayName,
    stato: appointmentStatus,
    nome: firstName,
    cognome: lastName,
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
