const test = require("node:test");
const assert = require("node:assert/strict");

const {
  deleteClientFromLegacyStorage,
} = require("../src/services/domain-entity-adapters.service");

test("deleteClientFromLegacyStorage removes invoices before deleting client", async () => {
  const calls = [];
  const fakeClient = {
    async query(sql, params) {
      calls.push({ sql: String(sql), params });
      if (String(sql).includes("DELETE FROM pazienti")) {
        return {
          rowCount: 1,
          rows: [{ id: 77, client_id: 77 }],
        };
      }
      return { rowCount: 1, rows: [] };
    },
  };

  const deleted = await deleteClientFromLegacyStorage({
    studioId: 9,
    clientId: 77,
    dbClient: fakeClient,
  });

  assert.equal(deleted.id, 77);
  assert.equal(calls.length, 2);
  assert.match(calls[0].sql, /DELETE FROM fatture/);
  assert.match(calls[1].sql, /DELETE FROM pazienti/);
  assert.deepEqual(calls[0].params, [9, 77]);
  assert.deepEqual(calls[1].params, [77, 9]);
});
