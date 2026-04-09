const { pool } = require("../config/db");

async function logTenantAuditEvent({
  studioId,
  actorUserId,
  actionKey,
  entityKey,
  changes,
}) {
  await pool.query(
    `INSERT INTO tenant_audit_logs (studio_id, actor_user_id, action_key, entity_key, changes_json)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      Number(studioId),
      actorUserId ? Number(actorUserId) : null,
      actionKey,
      entityKey,
      changes && typeof changes === "object" ? changes : {},
    ],
  );
}

module.exports = {
  logTenantAuditEvent,
};
