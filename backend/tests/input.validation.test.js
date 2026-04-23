const test = require("node:test");
const assert = require("node:assert/strict");

const { normalizeEmailIdentity } = require("../src/validation/input");

test("normalizeEmailIdentity trims and lowercases valid emails", () => {
  assert.equal(normalizeEmailIdentity("  Mario.Rossi@Example.COM "), "mario.rossi@example.com");
});

test("normalizeEmailIdentity returns null for invalid values", () => {
  assert.equal(normalizeEmailIdentity("not-an-email"), null);
  assert.equal(normalizeEmailIdentity(""), null);
  assert.equal(normalizeEmailIdentity(null), null);
});

