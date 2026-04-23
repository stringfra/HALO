const test = require("node:test");
const assert = require("node:assert/strict");

const {
  serializeAppointment,
  serializeClient,
} = require("../src/services/domain-aliases.service");

test("serializeClient exposes neutral dto fields and legacy aliases", () => {
  const serialized = serializeClient({
    id: 18,
    nome: "Mario",
    cognome: "Rossi",
    telefono: "+39 3330000000",
    note: "Preferisce mattina",
    medico_id: 9,
    medico_nome: "Dr. Bianchi",
    created_at: "2026-04-16T08:00:00.000Z",
  });

  assert.equal(serialized.client_id, 18);
  assert.equal(serialized.first_name, "Mario");
  assert.equal(serialized.last_name, "Rossi");
  assert.equal(serialized.owner_user_id, 9);
  assert.equal(serialized.owner_display_name, "Dr. Bianchi");
  assert.equal(serialized.nome, "Mario");
  assert.equal(serialized.cognome, "Rossi");
  assert.equal(serialized.medico_id, 9);
});

test("serializeAppointment exposes neutral dto fields and legacy aliases", () => {
  const serialized = serializeAppointment({
    appointment_id: 42,
    client_id: 18,
    appointment_date: "16 04 2026",
    appointment_time: "09:30:00",
    owner_display_name: "Dr. Bianchi",
    appointment_status: "confermato",
    first_name: "Mario",
    last_name: "Rossi",
  });

  assert.equal(serialized.id, 42);
  assert.equal(serialized.appointment_id, 42);
  assert.equal(serialized.client_id, 18);
  assert.equal(serialized.paziente_id, 18);
  assert.equal(serialized.appointment_date, "16 04 2026");
  assert.equal(serialized.data, "16 04 2026");
  assert.equal(serialized.owner_display_name, "Dr. Bianchi");
  assert.equal(serialized.medico, "Dr. Bianchi");
  assert.equal(serialized.appointment_status, "confermato");
  assert.equal(serialized.stato, "confermato");
});
