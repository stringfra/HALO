const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildAppointmentSyncDedupeKey,
  computeRetryDelayMs,
  isRetryableSyncError,
} = require("../src/services/appointment-sync-outbox.service");

test("buildAppointmentSyncDedupeKey is stable for same input", () => {
  const payload = {
    studioId: 3,
    connectionId: 5,
    appointmentId: 17,
    operation: "upsert",
    fingerprint: "v1",
  };

  const first = buildAppointmentSyncDedupeKey(payload);
  const second = buildAppointmentSyncDedupeKey(payload);
  assert.equal(first, second);
  assert.match(first, /^gcal:upsert:17:/);
});

test("buildAppointmentSyncDedupeKey changes when fingerprint changes", () => {
  const base = {
    studioId: 3,
    connectionId: 5,
    appointmentId: 17,
    operation: "upsert",
  };

  const v1 = buildAppointmentSyncDedupeKey({ ...base, fingerprint: "v1" });
  const v2 = buildAppointmentSyncDedupeKey({ ...base, fingerprint: "v2" });
  assert.notEqual(v1, v2);
});

test("computeRetryDelayMs grows with attempts and is bounded", () => {
  const attempt1 = computeRetryDelayMs(1, { baseMs: 1000, maxMs: 30000 });
  const attempt2 = computeRetryDelayMs(2, { baseMs: 1000, maxMs: 30000 });
  const attempt8 = computeRetryDelayMs(8, { baseMs: 1000, maxMs: 30000 });
  const attempt20 = computeRetryDelayMs(20, { baseMs: 1000, maxMs: 30000 });

  assert.ok(attempt1 >= 1000 && attempt1 <= 6000);
  assert.ok(attempt2 >= 2000 && attempt2 <= 7000);
  assert.ok(attempt8 >= 30000 && attempt8 <= 35000);
  assert.ok(attempt20 >= 30000 && attempt20 <= 35000);
});

test("isRetryableSyncError recognizes retryable status codes and network codes", () => {
  assert.equal(isRetryableSyncError({ statusCode: 429 }), true);
  assert.equal(isRetryableSyncError({ statusCode: 503 }), true);
  assert.equal(isRetryableSyncError({ code: "ETIMEDOUT" }), true);
  assert.equal(isRetryableSyncError({ retryable: true }), true);
  assert.equal(isRetryableSyncError({ statusCode: 400 }), false);
  assert.equal(isRetryableSyncError({ code: "INVALID_ARG" }), false);
});
