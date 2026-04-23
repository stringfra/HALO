const test = require("node:test");
const assert = require("node:assert/strict");

const { VERTICALS } = require("../src/config/multi-sector");
const {
  staticVerticalToTemplate,
  syncStaticVerticalTemplates,
  toModuleDefaults,
} = require("../src/services/vertical-templates.service");

test("staticVerticalToTemplate exposes default settings, modules and roles", () => {
  const template = staticVerticalToTemplate("consulting");

  assert.equal(template.key, "consulting");
  assert.equal(template.name, "Studio consulenza");
  assert.equal(template.default_settings.product_name, "HALO Consulting");
  assert.equal(template.default_modules.inventory, false);
  assert.equal(template.default_features["billing.enabled"], true);
  assert.deepEqual(template.default_roles, ["ADMIN", "SEGRETARIO", "DIPENDENTE"]);
});

test("toModuleDefaults maps feature flags into module defaults", () => {
  const modules = toModuleDefaults({
    "dashboard.enabled": true,
    "agenda.enabled": false,
    "payments.stripe.enabled": true,
    "calendar.google.enabled": false,
  });

  assert.equal(modules.dashboard, true);
  assert.equal(modules.agenda, false);
  assert.equal(modules.payments_stripe, true);
  assert.equal(modules.calendar_google, false);
});

test("syncStaticVerticalTemplates upserts all static vertical entries", async () => {
  const calls = [];
  const fakeClient = {
    async query(sql, params) {
      calls.push({ sql: String(sql), params });
      return { rowCount: 1, rows: [] };
    },
  };

  const result = await syncStaticVerticalTemplates(fakeClient);
  assert.equal(result.static_verticals_total, Object.keys(VERTICALS).length);
  assert.equal(result.upserted_rows_total, Object.keys(VERTICALS).length);
  assert.equal(calls.length, Object.keys(VERTICALS).length);
  assert.ok(calls.every((entry) => entry.sql.includes("INSERT INTO vertical_templates")));
});
