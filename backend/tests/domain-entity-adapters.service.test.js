const test = require("node:test");
const assert = require("node:assert/strict");

const {
  updateAppointmentInLegacyStorage,
  updateClientInLegacyStorage,
} = require("../src/services/domain-entity-adapters.service");

test("updateClientInLegacyStorage maps neutral dto fields to legacy storage columns", async () => {
  const calls = [];
  const fakeClient = {
    async query(sql, params) {
      calls.push({ sql: String(sql), params });
      return {
        rowCount: 1,
        rows: [
          {
            id: 7,
            client_id: 7,
            first_name: "Laura",
            last_name: "Bianchi",
            phone: "+39 3331231234",
            email: "laura@example.com",
            notes: "follow-up",
            owner_user_id: 11,
          },
        ],
      };
    },
  };

  const updated = await updateClientInLegacyStorage({
    studioId: 3,
    clientId: 7,
    updates: {
      first_name: "Laura",
      last_name: "Bianchi",
      phone: "+39 3331231234",
      notes: "follow-up",
      owner_user_id: 11,
    },
    dbClient: fakeClient,
  });

  assert.equal(updated.client_id, 7);
  assert.equal(calls.length, 1);
  assert.match(calls[0].sql, /UPDATE pazienti/);
  assert.match(calls[0].sql, /nome = \$1/);
  assert.match(calls[0].sql, /cognome = \$2/);
  assert.match(calls[0].sql, /telefono = \$3/);
  assert.match(calls[0].sql, /note = \$4/);
  assert.match(calls[0].sql, /medico_id = \$5/);
  assert.deepEqual(calls[0].params, ["Laura", "Bianchi", "+39 3331231234", "follow-up", 11, 7, 3]);
});

test("updateAppointmentInLegacyStorage rejects unknown client ids", async () => {
  const fakeClient = {
    async query(sql) {
      if (String(sql).includes("SELECT 1")) {
        return { rowCount: 0, rows: [] };
      }
      return { rowCount: 0, rows: [] };
    },
  };

  await assert.rejects(
    () =>
      updateAppointmentInLegacyStorage({
        studioId: 4,
        appointmentId: 9,
        updates: {
          client_id: 999,
          appointment_status: "confermato",
        },
        dbClient: fakeClient,
      }),
    (error) => error?.code === "APPOINTMENT_CLIENT_NOT_FOUND",
  );
});
