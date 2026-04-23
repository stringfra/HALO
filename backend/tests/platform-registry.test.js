const test = require("node:test");
const assert = require("node:assert/strict");

const {
  FEATURE_CATALOG,
  FEATURE_REGISTRY,
  LEGACY_ROLE_PERMISSIONS,
  PERMISSION_CATALOG,
  VERTICALS,
  resolveFeatureKeyFromModuleKey,
} = require("../src/config/multi-sector");
const {
  CORE_ENTITY_CATALOG,
  CORE_ENTITY_KEYS,
} = require("../src/config/platform-registry");

test("core entity keys are aligned with the entity catalog", () => {
  assert.deepEqual(
    CORE_ENTITY_KEYS,
    CORE_ENTITY_CATALOG.map((entry) => entry.entityKey),
  );
});

test("feature catalog entries are unique and mapped in the registry", () => {
  const uniqueFeatureKeys = new Set(FEATURE_CATALOG);
  assert.equal(uniqueFeatureKeys.size, FEATURE_CATALOG.length);

  for (const featureKey of FEATURE_CATALOG) {
    assert.ok(FEATURE_REGISTRY[featureKey], `missing feature registry entry for ${featureKey}`);
  }
});

test("feature registry dependencies reference valid feature keys", () => {
  for (const featureKey of FEATURE_CATALOG) {
    const dependencies = Array.isArray(FEATURE_REGISTRY[featureKey]?.dependencies)
      ? FEATURE_REGISTRY[featureKey].dependencies
      : [];

    for (const dependencyKey of dependencies) {
      assert.ok(
        FEATURE_CATALOG.includes(dependencyKey),
        `feature ${featureKey} depends on unknown feature ${dependencyKey}`,
      );
      assert.notEqual(
        dependencyKey,
        featureKey,
        `feature ${featureKey} cannot depend on itself`,
      );
    }
  }
});

test("vertical module keys can be resolved into feature keys", () => {
  for (const vertical of Object.values(VERTICALS)) {
    for (const moduleKey of Object.keys(vertical.modules || {})) {
      const featureKey = resolveFeatureKeyFromModuleKey(moduleKey);
      assert.ok(featureKey, `module ${moduleKey} is not mapped to a feature key`);
      assert.ok(FEATURE_CATALOG.includes(featureKey), `mapped feature ${featureKey} is not in catalog`);
    }
  }
});

test("permission catalog includes every legacy permission", () => {
  const permissions = new Set(PERMISSION_CATALOG);

  for (const rolePermissions of Object.values(LEGACY_ROLE_PERMISSIONS)) {
    for (const permissionKey of rolePermissions) {
      assert.ok(
        permissions.has(permissionKey),
        `legacy permission ${permissionKey} missing from PERMISSION_CATALOG`,
      );
    }
  }
});

test("every static vertical exposes default settings and workflow presets", () => {
  for (const vertical of Object.values(VERTICALS)) {
    assert.equal(typeof vertical.default_settings?.product_name, "string");
    assert.ok(vertical.default_settings.product_name.trim().length > 0);
    assert.equal(typeof vertical.default_settings?.workflow, "object");
    assert.equal(Array.isArray(vertical.default_settings.workflow), false);
    assert.equal(typeof vertical.default_settings.workflow.client_assignment_mode, "string");
    assert.equal(typeof vertical.default_settings.workflow.appointment_owner_source, "string");
    assert.equal(typeof vertical.default_settings.workflow.billing_mode, "string");
  }
});
