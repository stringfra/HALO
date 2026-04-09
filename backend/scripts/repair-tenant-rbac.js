const {
  getPlatformRbacHealthSnapshot,
  getTenantRbacConsistencySnapshot,
  repairTenantRbacConsistency,
} = require("../src/services/platform-rbac-tools.service");
const { pool } = require("../src/config/db");

function parseArgs(argv) {
  const args = {
    tenantId: null,
    all: false,
    mode: "check",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];

    if (current === "--tenant-id") {
      const rawValue = String(argv[index + 1] || "").trim();
      args.tenantId = /^\d+$/.test(rawValue) ? Number.parseInt(rawValue, 10) : null;
      index += 1;
      continue;
    }

    if (current === "--all") {
      args.all = true;
      continue;
    }

    if (current === "--mode") {
      const mode = String(argv[index + 1] || "").trim().toLowerCase();
      if (mode === "check" || mode === "repair") {
        args.mode = mode;
      }
      index += 1;
    }
  }

  return args;
}

function printTenantSnapshot(snapshot) {
  if (!snapshot) {
    console.log("Tenant non trovato.");
    return;
  }

  console.log(`Tenant ${snapshot.tenant.id} | ${snapshot.tenant.display_name} | code=${snapshot.tenant.code}`);
  console.log(
    `Summary: users=${snapshot.summary.users_total} roles=${snapshot.summary.roles_total} inconsistent=${snapshot.summary.inconsistent_users_total} missing_system_roles=${snapshot.summary.missing_system_roles_total}`,
  );

  if (snapshot.missing_system_roles.length > 0) {
    console.log(`Missing system roles: ${snapshot.missing_system_roles.join(", ")}`);
  }

  if (snapshot.inconsistent_users.length > 0) {
    console.log("Inconsistent users:");
    for (const user of snapshot.inconsistent_users) {
      console.log(
        `- user_id=${user.id} email=${user.email} ruolo=${user.ruolo} issues=${user.issues.join(",")}`,
      );
    }
  }
}

async function runSingleTenant({ tenantId, mode }) {
  if (!tenantId) {
    throw new Error("Specifica --tenant-id <id>.");
  }

  if (mode === "repair") {
    const result = await repairTenantRbacConsistency(tenantId);
    if (!result) {
      console.log("Tenant non trovato.");
      return;
    }

    console.log(`Repair completato per tenant ${tenantId}.`);
    console.log(`Before: ${JSON.stringify(result.before)}`);
    console.log(`After: ${JSON.stringify(result.after)}`);
    console.log(`Repair summary: ${JSON.stringify(result.repair_summary)}`);
    return;
  }

  const snapshot = await getTenantRbacConsistencySnapshot(tenantId);
  printTenantSnapshot(snapshot);
}

async function runAllTenants({ mode }) {
  const health = await getPlatformRbacHealthSnapshot();
  console.log(
    `Platform summary: tenants=${health.tenants_total} unhealthy=${health.unhealthy_tenants_total}`,
  );

  for (const tenant of health.tenants) {
    console.log(
      `- tenant_id=${tenant.tenant_id} code=${tenant.tenant_code} display_name=${tenant.tenant_display_name} inconsistent=${tenant.inconsistent_users_total} missing_system_roles=${tenant.missing_system_roles_total} healthy=${tenant.healthy}`,
    );

    if (mode === "repair" && !tenant.healthy) {
      const result = await repairTenantRbacConsistency(tenant.tenant_id);
      console.log(
        `  repair_summary=${JSON.stringify(result?.repair_summary || null)} after=${JSON.stringify(result?.after || null)}`,
      );
    }
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.tenantId && !args.all) {
    throw new Error("Usa --tenant-id <id> oppure --all.");
  }

  if (args.tenantId) {
    await runSingleTenant(args);
    return;
  }

  await runAllTenants(args);
}

main()
  .catch((error) => {
    console.error(`repair-tenant-rbac failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end().catch(() => {});
  });
