const test = require("node:test");
const assert = require("node:assert/strict");

const {
  applyFeatureDependencies,
  getFeatureDependencies,
  getMissingDependencies,
  listFeatureCatalogEntries,
  upsertTenantFeatureOverride,
} = require("../src/services/feature-flags.service");

test("getFeatureDependencies returns configured dependency keys", () => {
  assert.deepEqual(getFeatureDependencies("payments.stripe.enabled"), ["billing.enabled"]);
  assert.deepEqual(getFeatureDependencies("calendar.google.enabled"), ["agenda.enabled"]);
  assert.deepEqual(getFeatureDependencies("dashboard.enabled"), []);
});

test("applyFeatureDependencies disables dependent features when prerequisites are off", () => {
  const resolved = applyFeatureDependencies({
    "agenda.enabled": false,
    "calendar.google.enabled": true,
    "billing.enabled": false,
    "payments.stripe.enabled": true,
    "clients.enabled": false,
    "custom_fields.enabled": true,
    "automation.enabled": true,
  });

  assert.equal(resolved["agenda.enabled"], false);
  assert.equal(resolved["calendar.google.enabled"], false);
  assert.equal(resolved["billing.enabled"], false);
  assert.equal(resolved["payments.stripe.enabled"], false);
  assert.equal(resolved["clients.enabled"], false);
  assert.equal(resolved["custom_fields.enabled"], false);
  assert.equal(resolved["automation.enabled"], false);
});

test("getMissingDependencies reports unresolved prerequisites", () => {
  const missing = getMissingDependencies(
    {
      "clients.enabled": false,
      "agenda.enabled": true,
      "automation.enabled": true,
    },
    "automation.enabled",
  );

  assert.deepEqual(missing, ["clients.enabled"]);
});

test("listFeatureCatalogEntries exposes metadata for every catalog feature", () => {
  const entries = listFeatureCatalogEntries();
  assert.ok(entries.length > 0);
  assert.ok(entries.every((entry) => typeof entry.key === "string"));
  assert.ok(entries.every((entry) => Array.isArray(entry.dependencies)));
});

test("upsertTenantFeatureOverride rejects unsupported feature keys", async () => {
  await assert.rejects(
    () => upsertTenantFeatureOverride(1, "unsupported.feature", true, {}),
    (error) => error?.code === "TENANT_FEATURE_KEY_UNSUPPORTED",
  );
});
