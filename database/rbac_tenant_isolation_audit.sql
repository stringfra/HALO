SELECT
  u.studio_id AS user_tenant_id,
  r.studio_id AS role_tenant_id,
  u.id AS user_id,
  u.email AS user_email,
  u.ruolo AS legacy_role_key,
  r.id AS role_id,
  r.role_key,
  r.display_name,
  r.is_system
FROM user_roles ur
INNER JOIN users u ON u.id = ur.user_id
INNER JOIN roles r ON r.id = ur.role_id
WHERE u.studio_id <> r.studio_id
ORDER BY u.studio_id ASC, u.id ASC, r.studio_id ASC, r.role_key ASC;

SELECT
  u.studio_id AS tenant_id,
  u.id AS user_id,
  u.email AS user_email,
  COUNT(*)::int AS cross_tenant_role_assignments_count
FROM user_roles ur
INNER JOIN users u ON u.id = ur.user_id
INNER JOIN roles r ON r.id = ur.role_id
WHERE u.studio_id <> r.studio_id
GROUP BY u.studio_id, u.id, u.email
ORDER BY tenant_id ASC, user_id ASC;
