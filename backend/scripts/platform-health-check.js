const { pool } = require("../src/config/db");
const { getPlatformRbacHealthSnapshot } = require("../src/services/platform-rbac-tools.service");

async function loadPractitionerCoverage() {
  const result = await pool.query(
    `SELECT s.id AS studio_id,
            s.codice AS tenant_code,
            s.display_name AS tenant_display_name,
            s.is_active,
            COUNT(DISTINCT u.id) FILTER (WHERE u.ruolo IN ('DENTISTA', 'DIPENDENTE'))::int AS practitioner_count
     FROM studi s
     LEFT JOIN users u ON u.studio_id = s.id
     GROUP BY s.id, s.codice, s.display_name, s.is_active
     ORDER BY s.id`,
  );

  return result.rows.map((row) => ({
    studio_id: Number(row.studio_id),
    tenant_code: row.tenant_code,
    tenant_display_name: row.tenant_display_name,
    is_active: Boolean(row.is_active),
    practitioner_count: Number(row.practitioner_count || 0),
  }));
}

async function loadPatientAssignmentIntegrity() {
  const result = await pool.query(
    `SELECT p.studio_id,
            COUNT(*)::int AS patients_total,
            COUNT(*) FILTER (WHERE p.medico_id IS NULL)::int AS missing_doctor_total,
            COUNT(*) FILTER (
              WHERE p.medico_id IS NOT NULL
                AND u.id IS NULL
            )::int AS doctor_not_found_total,
            COUNT(*) FILTER (
              WHERE p.medico_id IS NOT NULL
                AND u.id IS NOT NULL
                AND u.ruolo NOT IN ('DENTISTA', 'DIPENDENTE')
            )::int AS doctor_not_practitioner_total
     FROM pazienti p
     LEFT JOIN users u
       ON u.id = p.medico_id
      AND u.studio_id = p.studio_id
     GROUP BY p.studio_id
     ORDER BY p.studio_id`,
  );

  return result.rows.map((row) => ({
    studio_id: Number(row.studio_id),
    patients_total: Number(row.patients_total || 0),
    missing_doctor_total: Number(row.missing_doctor_total || 0),
    doctor_not_found_total: Number(row.doctor_not_found_total || 0),
    doctor_not_practitioner_total: Number(row.doctor_not_practitioner_total || 0),
  }));
}

async function main() {
  const timestamp = new Date().toISOString();
  const rbacHealth = await getPlatformRbacHealthSnapshot();
  const practitionerCoverage = await loadPractitionerCoverage();
  const patientIntegrity = await loadPatientAssignmentIntegrity();

  const activeTenantsWithoutPractitioner = practitionerCoverage.filter(
    (tenant) => tenant.is_active && tenant.practitioner_count === 0,
  );
  const patientIntegrityIssues = patientIntegrity.filter(
    (tenant) =>
      tenant.missing_doctor_total > 0 ||
      tenant.doctor_not_found_total > 0 ||
      tenant.doctor_not_practitioner_total > 0,
  );

  const status = {
    ok:
      rbacHealth.unhealthy_tenants_total === 0 &&
      activeTenantsWithoutPractitioner.length === 0 &&
      patientIntegrityIssues.length === 0,
    rbac_unhealthy_tenants_total: Number(rbacHealth.unhealthy_tenants_total || 0),
    active_tenants_without_practitioner_total: activeTenantsWithoutPractitioner.length,
    patient_assignment_issue_tenants_total: patientIntegrityIssues.length,
  };

  const report = {
    timestamp,
    status,
    rbac_health: rbacHealth,
    practitioner_coverage: practitionerCoverage,
    patient_assignment_integrity: patientIntegrity,
  };

  console.log(JSON.stringify(report, null, 2));

  if (!status.ok) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(`platform-health-check failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end().catch(() => {});
  });
