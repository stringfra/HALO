DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ruolo_utente')
     AND NOT EXISTS (
       SELECT 1
       FROM pg_enum
       WHERE enumtypid = 'ruolo_utente'::regtype
         AND enumlabel = 'DIPENDENTE'
     ) THEN
    ALTER TYPE ruolo_utente ADD VALUE 'DIPENDENTE';
  END IF;
END $$;

BEGIN;

UPDATE studi
SET settings_json = jsonb_set(
  COALESCE(settings_json, '{}'::jsonb),
  '{roles}',
  '["ADMIN","SEGRETARIO","DIPENDENTE"]'::jsonb,
  true
)
WHERE COALESCE(settings_json->'roles', '[]'::jsonb) @> '["DENTISTA"]'::jsonb
   OR NOT (COALESCE(settings_json, '{}'::jsonb) ? 'roles');

WITH migrated_roles AS (
  UPDATE roles
  SET role_key = 'DIPENDENTE',
      display_name = 'Staff',
      updated_at = NOW()
  WHERE is_system = TRUE
    AND role_key = 'DENTISTA'
    AND NOT EXISTS (
      SELECT 1
      FROM roles existing
      WHERE existing.studio_id = roles.studio_id
        AND existing.role_key = 'DIPENDENTE'
    )
  RETURNING id, studio_id
)
SELECT COUNT(*) FROM migrated_roles;

WITH duplicate_pairs AS (
  SELECT legacy.id AS legacy_role_id,
         target.id AS target_role_id
  FROM roles legacy
  INNER JOIN roles target
    ON target.studio_id = legacy.studio_id
   AND target.role_key = 'DIPENDENTE'
   AND target.is_system = TRUE
  WHERE legacy.role_key = 'DENTISTA'
    AND legacy.is_system = TRUE
),
merged_assignments AS (
  INSERT INTO user_roles (user_id, role_id)
  SELECT ur.user_id, dp.target_role_id
  FROM user_roles ur
  INNER JOIN duplicate_pairs dp ON dp.legacy_role_id = ur.role_id
  ON CONFLICT (user_id, role_id) DO NOTHING
  RETURNING id
)
SELECT COUNT(*) FROM merged_assignments;

DELETE FROM user_roles ur
USING roles r
WHERE ur.role_id = r.id
  AND r.role_key = 'DENTISTA'
  AND r.is_system = TRUE
  AND EXISTS (
    SELECT 1
    FROM roles target
    WHERE target.studio_id = r.studio_id
      AND target.role_key = 'DIPENDENTE'
      AND target.is_system = TRUE
  );

DELETE FROM role_permissions rp
USING roles r
WHERE rp.role_id = r.id
  AND r.role_key = 'DENTISTA'
  AND r.is_system = TRUE
  AND EXISTS (
    SELECT 1
    FROM roles target
    WHERE target.studio_id = r.studio_id
      AND target.role_key = 'DIPENDENTE'
      AND target.is_system = TRUE
  );

DELETE FROM roles r
WHERE r.role_key = 'DENTISTA'
  AND r.is_system = TRUE
  AND EXISTS (
    SELECT 1
    FROM roles target
    WHERE target.studio_id = r.studio_id
      AND target.role_key = 'DIPENDENTE'
      AND target.is_system = TRUE
  );

INSERT INTO roles (studio_id, role_key, display_name, is_system, updated_at)
SELECT
  s.id,
  seeded.role_key,
  seeded.display_name,
  TRUE,
  NOW()
FROM studi s
CROSS JOIN (
  VALUES
    ('ADMIN', 'Administrator'),
    ('SEGRETARIO', 'Coordinator'),
    ('DIPENDENTE', 'Staff')
) AS seeded(role_key, display_name)
ON CONFLICT (studio_id, role_key) DO UPDATE
SET display_name = EXCLUDED.display_name,
    is_system = TRUE,
    updated_at = NOW();

DELETE FROM role_permissions rp
USING roles r
WHERE rp.role_id = r.id
  AND r.is_system = TRUE
  AND r.role_key IN ('ADMIN', 'SEGRETARIO', 'DIPENDENTE');

INSERT INTO role_permissions (role_id, permission_key)
SELECT
  r.id,
  seeded.permission_key
FROM roles r
JOIN (
  VALUES
    ('ADMIN', 'dashboard.read'),
    ('ADMIN', 'clients.read'),
    ('ADMIN', 'clients.write'),
    ('ADMIN', 'appointments.read'),
    ('ADMIN', 'appointments.write'),
    ('ADMIN', 'billing.read'),
    ('ADMIN', 'billing.write'),
    ('ADMIN', 'inventory.read'),
    ('ADMIN', 'inventory.write'),
    ('ADMIN', 'users.read'),
    ('ADMIN', 'users.write'),
    ('ADMIN', 'automations.read'),
    ('ADMIN', 'automations.write'),
    ('ADMIN', 'reports.read'),
    ('ADMIN', 'settings.manage'),
    ('SEGRETARIO', 'dashboard.read'),
    ('SEGRETARIO', 'clients.read'),
    ('SEGRETARIO', 'clients.write'),
    ('SEGRETARIO', 'appointments.read'),
    ('SEGRETARIO', 'appointments.write'),
    ('SEGRETARIO', 'billing.read'),
    ('SEGRETARIO', 'billing.write'),
    ('SEGRETARIO', 'automations.read'),
    ('DIPENDENTE', 'dashboard.read'),
    ('DIPENDENTE', 'clients.read'),
    ('DIPENDENTE', 'appointments.read'),
    ('DIPENDENTE', 'appointments.write'),
    ('DIPENDENTE', 'billing.read')
) AS seeded(role_key, permission_key)
  ON seeded.role_key = r.role_key
ON CONFLICT (role_id, permission_key) DO NOTHING;

UPDATE users
SET ruolo = 'DIPENDENTE'
WHERE ruolo = 'DENTISTA';

DELETE FROM user_roles ur
USING roles r
WHERE ur.role_id = r.id
  AND r.is_system = TRUE;

INSERT INTO user_roles (user_id, role_id)
SELECT
  u.id,
  r.id
FROM users u
JOIN roles r
  ON r.studio_id = u.studio_id
 AND r.role_key = u.ruolo::text
ON CONFLICT (user_id, role_id) DO NOTHING;

COMMIT;
