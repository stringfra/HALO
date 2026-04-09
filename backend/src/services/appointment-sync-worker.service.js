const {
  claimAppointmentSyncOutboxBatch,
  computeRetryDelayMs,
  isRetryableSyncError,
  markOutboxJobDone,
  markOutboxJobFailed,
  scheduleOutboxJobRetry,
} = require("./appointment-sync-outbox.service");
const { syncAppointmentOutboxItem } = require("./google-calendar-sync.service");
const { parsePositiveInt } = require("../validation/input");

let workerTimer = null;
let workerInFlight = false;

function parseBooleanEnv(value, fallback) {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }
  return fallback;
}

function normalizeErrorMessage(error) {
  const message =
    typeof error?.message === "string" && error.message.trim().length > 0
      ? error.message.trim()
      : "unknown_sync_error";
  const detail =
    typeof error?.detail === "string" && error.detail.trim().length > 0
      ? error.detail.trim()
      : null;
  return detail ? `${message} (${detail})` : message;
}

function getWorkerConfig() {
  const enabled = parseBooleanEnv(process.env.GOOGLE_SYNC_WORKER_ENABLED, true);
  const intervalMs = parsePositiveInt(process.env.GOOGLE_SYNC_WORKER_INTERVAL_MS, {
    max: 600000,
  }) || 5000;
  const batchSize = parsePositiveInt(process.env.GOOGLE_SYNC_WORKER_BATCH_SIZE, {
    max: 200,
  }) || 20;
  const maxAttempts = parsePositiveInt(process.env.GOOGLE_SYNC_WORKER_MAX_ATTEMPTS, {
    max: 50,
  }) || 8;

  return {
    enabled,
    intervalMs,
    batchSize,
    maxAttempts,
  };
}

async function processClaimedOutboxJob(job, maxAttempts) {
  const currentAttempts = Number.parseInt(job?.attempts, 10) || 0;
  const nextAttempt = currentAttempts + 1;
  const jobId = Number(job?.id);

  try {
    const result = await syncAppointmentOutboxItem(job);
    await markOutboxJobDone(jobId);
    return {
      state: "done",
      job_id: jobId,
      result,
    };
  } catch (error) {
    const errorMessage = normalizeErrorMessage(error);
    const retryable = isRetryableSyncError(error);

    if (retryable && nextAttempt < maxAttempts) {
      const retryDelayMs = computeRetryDelayMs(nextAttempt);
      const retryAt = new Date(Date.now() + retryDelayMs);
      await scheduleOutboxJobRetry({
        jobId,
        attempts: nextAttempt,
        retryAt,
        errorMessage,
      });
      return {
        state: "retry",
        job_id: jobId,
        attempts: nextAttempt,
        retry_at: retryAt.toISOString(),
        retryable: true,
        error: errorMessage,
      };
    }

    await markOutboxJobFailed({
      jobId,
      attempts: nextAttempt,
      errorMessage,
    });
    return {
      state: "failed",
      job_id: jobId,
      attempts: nextAttempt,
      retryable,
      error: errorMessage,
    };
  }
}

async function processAppointmentSyncOutboxBatch({
  batchSize,
  maxAttempts,
} = {}) {
  const config = getWorkerConfig();
  const effectiveBatchSize = parsePositiveInt(batchSize, { max: 200 }) || config.batchSize;
  const effectiveMaxAttempts = parsePositiveInt(maxAttempts, { max: 50 }) || config.maxAttempts;
  const claimedJobs = await claimAppointmentSyncOutboxBatch(effectiveBatchSize);

  const summary = {
    claimed: claimedJobs.length,
    done: 0,
    retry: 0,
    failed: 0,
    details: [],
  };

  for (const job of claimedJobs) {
    const processed = await processClaimedOutboxJob(job, effectiveMaxAttempts);
    summary.details.push(processed);
    if (processed.state === "done") {
      summary.done += 1;
    } else if (processed.state === "retry") {
      summary.retry += 1;
    } else if (processed.state === "failed") {
      summary.failed += 1;
    }
  }

  return summary;
}

async function runAppointmentSyncWorkerTick() {
  if (workerInFlight) {
    return null;
  }

  workerInFlight = true;
  try {
    const summary = await processAppointmentSyncOutboxBatch();
    if (summary.claimed > 0) {
      console.log(
        `[APPOINTMENT_SYNC_WORKER] claimed=${summary.claimed} done=${summary.done} retry=${summary.retry} failed=${summary.failed}`,
      );
    }
    return summary;
  } catch (error) {
    console.error(
      `[APPOINTMENT_SYNC_WORKER] tick_error=${normalizeErrorMessage(error)}`,
    );
    return null;
  } finally {
    workerInFlight = false;
  }
}

function startAppointmentSyncWorker() {
  if (workerTimer) {
    return false;
  }

  const config = getWorkerConfig();
  if (!config.enabled) {
    return false;
  }

  if (process.env.NODE_ENV === "test") {
    return false;
  }

  workerTimer = setInterval(() => {
    void runAppointmentSyncWorkerTick();
  }, config.intervalMs);
  workerTimer.unref?.();

  setTimeout(() => {
    void runAppointmentSyncWorkerTick();
  }, 250).unref?.();

  console.log(
    `[APPOINTMENT_SYNC_WORKER] started intervalMs=${config.intervalMs} batchSize=${config.batchSize} maxAttempts=${config.maxAttempts}`,
  );
  return true;
}

function stopAppointmentSyncWorker() {
  if (!workerTimer) {
    return false;
  }

  clearInterval(workerTimer);
  workerTimer = null;
  console.log("[APPOINTMENT_SYNC_WORKER] stopped");
  return true;
}

module.exports = {
  getWorkerConfig,
  processAppointmentSyncOutboxBatch,
  runAppointmentSyncWorkerTick,
  startAppointmentSyncWorker,
  stopAppointmentSyncWorker,
};
