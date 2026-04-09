const bcrypt = require("bcrypt");
const { pool } = require("../src/config/db");
const { createTenantUser } = require("../src/services/tenant-user-management.service");

const baseUrl = process.env.QA_SMOKE_API_BASE_URL || "http://localhost:4000";
const tempPassword = "TmpQaSmoke!123";

function parseArgs(argv) {
  const args = {
    studioId: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (current === "--studio-id") {
      const raw = String(argv[index + 1] || "").trim();
      args.studioId = /^\d+$/.test(raw) ? Number.parseInt(raw, 10) : null;
      index += 1;
    }
  }

  return args;
}

function normalizeId(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function tomorrowIsoDate() {
  const date = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function apiRequest({ method, path, token, body }) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  return { status: response.status, payload };
}

async function resolveTargetStudio(requestedStudioId) {
  if (requestedStudioId) {
    const result = await pool.query(
      `SELECT s.id AS studio_id,
              s.codice AS tenant_code,
              s.display_name AS tenant_display_name,
              COUNT(DISTINCT u.id) FILTER (WHERE u.ruolo IN ('DENTISTA', 'DIPENDENTE'))::int AS practitioner_count
       FROM studi s
       LEFT JOIN users u ON u.studio_id = s.id
       WHERE s.id = $1
         AND s.is_active = TRUE
       GROUP BY s.id, s.codice, s.display_name`,
      [requestedStudioId],
    );

    if (result.rowCount === 0) {
      throw new Error(`Tenant ${requestedStudioId} non trovato o non attivo.`);
    }

    const row = result.rows[0];
    return {
      studio_id: Number(row.studio_id),
      tenant_code: row.tenant_code,
      tenant_display_name: row.tenant_display_name,
      practitioner_count: Number(row.practitioner_count || 0),
    };
  }

  const result = await pool.query(
    `SELECT s.id AS studio_id,
            s.codice AS tenant_code,
            s.display_name AS tenant_display_name,
            COUNT(DISTINCT u.id) FILTER (WHERE u.ruolo IN ('DENTISTA', 'DIPENDENTE'))::int AS practitioner_count
     FROM studi s
     LEFT JOIN users u ON u.studio_id = s.id
     WHERE s.is_active = TRUE
     GROUP BY s.id, s.codice, s.display_name
     ORDER BY practitioner_count DESC, s.id ASC`,
  );

  const candidate = result.rows.find((row) => Number(row.practitioner_count || 0) > 0);
  if (!candidate) {
    throw new Error("Nessun tenant attivo con practitioner disponibile per eseguire QA smoke.");
  }

  return {
    studio_id: Number(candidate.studio_id),
    tenant_code: candidate.tenant_code,
    tenant_display_name: candidate.tenant_display_name,
    practitioner_count: Number(candidate.practitioner_count || 0),
  };
}

async function createTempAdmin(studioId, suffix) {
  const email = `qa.smoke.admin.${studioId}.${suffix}@halo.local`;
  const nome = `QA Smoke Admin ${studioId} ${suffix}`;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const passwordHash = await bcrypt.hash(tempPassword, 10);
    const created = await createTenantUser(client, {
      studioId,
      nome,
      email,
      passwordHash,
      ruolo: "ADMIN",
    });
    await client.query("COMMIT");
    return {
      userId: normalizeId(created.userId),
      email,
      password: tempPassword,
    };
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // no-op
    }
    throw error;
  } finally {
    client.release();
  }
}

async function cleanupArtifacts(cleanup, report) {
  try {
    if (cleanup.appointmentIds.size > 0) {
      const ids = [...cleanup.appointmentIds];
      const result = await pool.query(
        "DELETE FROM appuntamenti WHERE id = ANY($1::bigint[]) RETURNING id",
        [ids],
      );
      report.cleanup.deleted_appointments = result.rows.map((row) => Number(row.id));
    }
  } catch (error) {
    report.errors.push({ step: "cleanup_appointments", message: error.message });
  }

  try {
    if (cleanup.patientIds.size > 0) {
      const ids = [...cleanup.patientIds];
      const result = await pool.query(
        "DELETE FROM pazienti WHERE id = ANY($1::bigint[]) RETURNING id",
        [ids],
      );
      report.cleanup.deleted_patients = result.rows.map((row) => Number(row.id));
    }
  } catch (error) {
    report.errors.push({ step: "cleanup_patients", message: error.message });
  }

  try {
    if (cleanup.userIds.size > 0) {
      const ids = [...cleanup.userIds];
      const result = await pool.query(
        "DELETE FROM users WHERE id = ANY($1::bigint[]) RETURNING id",
        [ids],
      );
      report.cleanup.deleted_users = result.rows.map((row) => Number(row.id));
    }
  } catch (error) {
    report.errors.push({ step: "cleanup_users", message: error.message });
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const suffix = Date.now();
  const appointmentDate = tomorrowIsoDate();
  const cleanup = {
    userIds: new Set(),
    patientIds: new Set(),
    appointmentIds: new Set(),
  };
  const report = {
    timestamp: new Date().toISOString(),
    api_base_url: baseUrl,
    target_tenant: null,
    steps: {},
    cleanup: {
      deleted_users: [],
      deleted_patients: [],
      deleted_appointments: [],
    },
    errors: [],
  };

  try {
    const apiHealth = await apiRequest({ method: "GET", path: "/api/test" });
    report.steps.api_reachable = {
      status: apiHealth.status,
      ok: apiHealth.status === 200,
    };
    if (apiHealth.status !== 200) {
      throw new Error("API non raggiungibile su /api/test. Avvia backend prima dello smoke.");
    }

    const targetTenant = await resolveTargetStudio(args.studioId);
    report.target_tenant = targetTenant;

    const tempAdmin = await createTempAdmin(targetTenant.studio_id, suffix);
    if (!tempAdmin.userId) {
      throw new Error("Impossibile creare admin temporaneo QA smoke.");
    }
    cleanup.userIds.add(tempAdmin.userId);
    report.steps.temp_admin_created = {
      ok: true,
      user_id: tempAdmin.userId,
      email: tempAdmin.email,
    };

    const adminLogin = await apiRequest({
      method: "POST",
      path: "/api/login",
      body: {
        email: tempAdmin.email,
        password: tempAdmin.password,
      },
    });
    const adminToken = adminLogin.payload?.token || adminLogin.payload?.access_token || null;
    report.steps.temp_admin_login = {
      status: adminLogin.status,
      ok: adminLogin.status === 200 && Boolean(adminToken),
    };
    if (!adminToken) {
      throw new Error("Login admin temporaneo QA smoke fallito.");
    }

    const practitionerPayload = {
      display_name: `QA Smoke Practitioner ${suffix}`,
      email: `qa.smoke.practitioner.${suffix}@halo.local`,
      password: tempPassword,
      role_key: "DIPENDENTE",
    };
    const createUserResponse = await apiRequest({
      method: "POST",
      path: "/api/v2/users",
      token: adminToken,
      body: practitionerPayload,
    });
    const practitionerId = normalizeId(
      createUserResponse.payload?.id ?? createUserResponse.payload?.user_id,
    );
    report.steps.create_user_standard = {
      status: createUserResponse.status,
      ok: createUserResponse.status === 201 && Boolean(practitionerId),
      user_id: practitionerId,
    };
    if (!practitionerId) {
      throw new Error("Create user standard fallito.");
    }
    cleanup.userIds.add(practitionerId);

    const createPatientResponse = await apiRequest({
      method: "POST",
      path: "/api/v2/clients",
      token: adminToken,
      body: {
        first_name: "QA",
        last_name: `Smoke ${suffix}`,
        owner_user_id: practitionerId,
        phone: "+39021234567",
        email: `qa.smoke.client.${suffix}@halo.local`,
        notes: "qa smoke pre-release",
      },
    });
    const patientId = normalizeId(createPatientResponse.payload?.id ?? createPatientResponse.payload?.client_id);
    report.steps.create_patient_with_doctor = {
      status: createPatientResponse.status,
      ok: createPatientResponse.status === 201 && Boolean(patientId),
      patient_id: patientId,
    };
    if (!patientId) {
      throw new Error("Create paziente con assegnazione medico fallito.");
    }
    cleanup.patientIds.add(patientId);

    const createAppointmentResponse = await apiRequest({
      method: "POST",
      path: "/api/v2/appointments",
      token: adminToken,
      body: {
        client_id: patientId,
        appointment_date: appointmentDate,
        appointment_time: "09:30",
        appointment_status: "in_attesa",
      },
    });
    const appointmentId = normalizeId(
      createAppointmentResponse.payload?.id ?? createAppointmentResponse.payload?.appointment_id,
    );
    report.steps.create_appointment = {
      status: createAppointmentResponse.status,
      ok: createAppointmentResponse.status === 201 && Boolean(appointmentId),
      appointment_id: appointmentId,
    };
    if (!appointmentId) {
      throw new Error("Create appuntamento fallito.");
    }
    cleanup.appointmentIds.add(appointmentId);

    const getClientsResponse = await apiRequest({
      method: "GET",
      path: "/api/v2/clients",
      token: adminToken,
    });
    const getAppointmentsResponse = await apiRequest({
      method: "GET",
      path: "/api/v2/appointments",
      token: adminToken,
    });
    const clientsList = Array.isArray(getClientsResponse.payload) ? getClientsResponse.payload : [];
    const appointmentsList = Array.isArray(getAppointmentsResponse.payload)
      ? getAppointmentsResponse.payload
      : [];
    report.steps.read_lists = {
      clients_status: getClientsResponse.status,
      appointments_status: getAppointmentsResponse.status,
      clients_ok: getClientsResponse.status === 200,
      appointments_ok: getAppointmentsResponse.status === 200,
      created_patient_visible: clientsList.some(
        (row) => normalizeId(row.id ?? row.client_id) === patientId,
      ),
      created_appointment_visible: appointmentsList.some(
        (row) => normalizeId(row.id ?? row.appointment_id) === appointmentId,
      ),
    };
  } catch (error) {
    report.errors.push({
      step: "qa_smoke",
      message: error.message,
    });
  } finally {
    await cleanupArtifacts(cleanup, report);
    await pool.end();
    const ok = report.errors.length === 0;
    report.status = ok ? "ok" : "failed";
    console.log(JSON.stringify(report, null, 2));
    if (!ok) {
      process.exitCode = 1;
    }
  }
}

main().catch(async (error) => {
  console.error(`qa-smoke-standard-flows failed: ${error.message}`);
  await pool.end().catch(() => {});
  process.exitCode = 1;
});
