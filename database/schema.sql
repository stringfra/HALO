-- HALO - Schema database minimo MVP
-- PostgreSQL

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ruolo_utente') THEN
    CREATE TYPE ruolo_utente AS ENUM ('ADMIN', 'DENTISTA', 'SEGRETARIO', 'DIPENDENTE');
  ELSIF NOT EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumtypid = 'ruolo_utente'::regtype
      AND enumlabel = 'DIPENDENTE'
  ) THEN
    ALTER TYPE ruolo_utente ADD VALUE 'DIPENDENTE';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS studi (
  id BIGSERIAL PRIMARY KEY,
  codice VARCHAR(50) NOT NULL UNIQUE,
  nome VARCHAR(120) NOT NULL,
  display_name VARCHAR(120) NOT NULL,
  business_name VARCHAR(160),
  vertical_key VARCHAR(80) NOT NULL DEFAULT 'dental',
  brand_logo_url TEXT,
  brand_primary_color VARCHAR(32),
  brand_secondary_color VARCHAR(32),
  default_locale VARCHAR(16) NOT NULL DEFAULT 'it-IT',
  default_timezone VARCHAR(64) NOT NULL DEFAULT 'Europe/Rome',
  settings_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  settings_version INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE studi ADD COLUMN IF NOT EXISTS display_name VARCHAR(120);
ALTER TABLE studi ADD COLUMN IF NOT EXISTS business_name VARCHAR(160);
ALTER TABLE studi ADD COLUMN IF NOT EXISTS vertical_key VARCHAR(80);
ALTER TABLE studi ADD COLUMN IF NOT EXISTS brand_logo_url TEXT;
ALTER TABLE studi ADD COLUMN IF NOT EXISTS brand_primary_color VARCHAR(32);
ALTER TABLE studi ADD COLUMN IF NOT EXISTS brand_secondary_color VARCHAR(32);
ALTER TABLE studi ADD COLUMN IF NOT EXISTS default_locale VARCHAR(16);
ALTER TABLE studi ADD COLUMN IF NOT EXISTS default_timezone VARCHAR(64);
ALTER TABLE studi ADD COLUMN IF NOT EXISTS settings_json JSONB;
ALTER TABLE studi ADD COLUMN IF NOT EXISTS settings_version INTEGER;
ALTER TABLE studi ADD COLUMN IF NOT EXISTS is_active BOOLEAN;

INSERT INTO studi (codice, nome, display_name)
VALUES ('DEFAULT', 'Studio Principale', 'HALO Dental')
ON CONFLICT (codice) DO NOTHING;

CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  studio_id BIGINT,
  nome VARCHAR(120) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  ruolo ruolo_utente NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ NULL,
  replaced_by_token_id BIGINT NULL REFERENCES refresh_tokens(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by_ip VARCHAR(64) NULL,
  user_agent VARCHAR(255) NULL
);

CREATE TABLE IF NOT EXISTS platform_accounts (
  id BIGSERIAL PRIMARY KEY,
  account_key VARCHAR(80) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  mfa_secret_encrypted TEXT,
  mfa_recovery_codes_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  mfa_pending_secret_encrypted TEXT,
  mfa_pending_recovery_codes_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  last_login_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS platform_refresh_tokens (
  id BIGSERIAL PRIMARY KEY,
  platform_account_id BIGINT NOT NULL REFERENCES platform_accounts(id) ON DELETE CASCADE,
  token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ NULL,
  replaced_by_token_id BIGINT NULL REFERENCES platform_refresh_tokens(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by_ip VARCHAR(64) NULL,
  user_agent VARCHAR(255) NULL
);

CREATE TABLE IF NOT EXISTS pazienti (
  id BIGSERIAL PRIMARY KEY,
  studio_id BIGINT,
  medico_id BIGINT,
  nome VARCHAR(100) NOT NULL,
  cognome VARCHAR(100) NOT NULL,
  telefono VARCHAR(30),
  email VARCHAR(255),
  note TEXT
);

CREATE TABLE IF NOT EXISTS appuntamenti (
  id BIGSERIAL PRIMARY KEY,
  studio_id BIGINT,
  paziente_id BIGINT NOT NULL REFERENCES pazienti(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  ora TIME NOT NULL,
  medico VARCHAR(120) NOT NULL,
  stato VARCHAR(30) NOT NULL DEFAULT 'in_attesa',
  durata_minuti SMALLINT NOT NULL DEFAULT 30 CHECK (durata_minuti > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS google_calendar_connections (
  id BIGSERIAL PRIMARY KEY,
  studio_id BIGINT NOT NULL,
  connected_by_user_id BIGINT NULL,
  google_account_email VARCHAR(255),
  calendar_id VARCHAR(255),
  access_token_encrypted TEXT NOT NULL,
  refresh_token_encrypted TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  last_sync_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS appointment_google_event_links (
  id BIGSERIAL PRIMARY KEY,
  studio_id BIGINT NOT NULL,
  connection_id BIGINT NOT NULL,
  appointment_id BIGINT NOT NULL,
  google_event_id VARCHAR(255) NOT NULL,
  google_event_etag VARCHAR(255),
  last_payload_hash CHAR(64),
  last_synced_at TIMESTAMPTZ,
  sync_state VARCHAR(20) NOT NULL DEFAULT 'pending',
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (connection_id, appointment_id),
  UNIQUE (connection_id, google_event_id)
);

CREATE TABLE IF NOT EXISTS appointment_sync_outbox (
  id BIGSERIAL PRIMARY KEY,
  studio_id BIGINT NOT NULL,
  connection_id BIGINT NOT NULL,
  appointment_id BIGINT NOT NULL,
  operation VARCHAR(20) NOT NULL,
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  dedupe_key VARCHAR(180) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  next_retry_at TIMESTAMPTZ,
  locked_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fatture (
  id BIGSERIAL PRIMARY KEY,
  studio_id BIGINT,
  paziente_id BIGINT NOT NULL REFERENCES pazienti(id) ON DELETE RESTRICT,
  importo NUMERIC(10, 2) NOT NULL CHECK (importo >= 0),
  stato VARCHAR(30) NOT NULL DEFAULT 'da_pagare',
  data DATE NOT NULL,
  stripe_session_id VARCHAR(255),
  stripe_payment_link TEXT,
  stripe_status VARCHAR(50),
  stripe_generated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS fatture_pagamenti (
  id BIGSERIAL PRIMARY KEY,
  studio_id BIGINT NOT NULL REFERENCES studi(id) ON DELETE RESTRICT,
  fattura_id BIGINT NOT NULL REFERENCES fatture(id) ON DELETE CASCADE,
  stripe_session_id VARCHAR(255),
  event_type VARCHAR(80) NOT NULL,
  stripe_status VARCHAR(50),
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tenant_features (
  id BIGSERIAL PRIMARY KEY,
  studio_id BIGINT NOT NULL REFERENCES studi(id) ON DELETE CASCADE,
  feature_key VARCHAR(120) NOT NULL,
  enabled BOOLEAN NOT NULL,
  config_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (studio_id, feature_key)
);

CREATE TABLE IF NOT EXISTS vertical_templates (
  key VARCHAR(80) PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  default_settings_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  default_labels_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  default_features_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  default_roles_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS roles (
  id BIGSERIAL PRIMARY KEY,
  studio_id BIGINT NOT NULL REFERENCES studi(id) ON DELETE CASCADE,
  role_key VARCHAR(80) NOT NULL,
  display_name VARCHAR(120) NOT NULL,
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (studio_id, role_key)
);

CREATE TABLE IF NOT EXISTS role_permissions (
  id BIGSERIAL PRIMARY KEY,
  role_id BIGINT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_key VARCHAR(120) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (role_id, permission_key)
);

CREATE TABLE IF NOT EXISTS user_roles (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id BIGINT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, role_id)
);

CREATE TABLE IF NOT EXISTS custom_field_definitions (
  id BIGSERIAL PRIMARY KEY,
  studio_id BIGINT NOT NULL REFERENCES studi(id) ON DELETE CASCADE,
  entity_key VARCHAR(80) NOT NULL,
  field_key VARCHAR(80) NOT NULL,
  label VARCHAR(120) NOT NULL,
  type VARCHAR(40) NOT NULL,
  required BOOLEAN NOT NULL DEFAULT FALSE,
  options_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (studio_id, entity_key, field_key)
);

CREATE TABLE IF NOT EXISTS custom_field_values (
  id BIGSERIAL PRIMARY KEY,
  studio_id BIGINT NOT NULL REFERENCES studi(id) ON DELETE CASCADE,
  entity_key VARCHAR(80) NOT NULL,
  record_id BIGINT NOT NULL,
  field_key VARCHAR(80) NOT NULL,
  value_json JSONB NOT NULL DEFAULT 'null'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (studio_id, entity_key, record_id, field_key)
);

CREATE TABLE IF NOT EXISTS prodotti (
  id BIGSERIAL PRIMARY KEY,
  studio_id BIGINT,
  nome VARCHAR(120) NOT NULL,
  quantita INTEGER NOT NULL DEFAULT 0 CHECK (quantita >= 0),
  soglia_minima INTEGER NOT NULL DEFAULT 0 CHECK (soglia_minima >= 0)
);

CREATE TABLE IF NOT EXISTS tenant_audit_logs (
  id BIGSERIAL PRIMARY KEY,
  studio_id BIGINT NOT NULL REFERENCES studi(id) ON DELETE CASCADE,
  actor_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  action_key VARCHAR(120) NOT NULL,
  entity_key VARCHAR(80) NOT NULL,
  changes_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS platform_audit_logs (
  id BIGSERIAL PRIMARY KEY,
  platform_account_id BIGINT NULL REFERENCES platform_accounts(id) ON DELETE SET NULL,
  action_key VARCHAR(120) NOT NULL,
  entity_key VARCHAR(80) NOT NULL,
  tenant_id BIGINT NULL REFERENCES studi(id) ON DELETE SET NULL,
  request_ip VARCHAR(64) NULL,
  user_agent VARCHAR(255) NULL,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
DECLARE
  default_studio_id BIGINT;
BEGIN
  SELECT id
  INTO default_studio_id
  FROM studi
  WHERE codice = 'DEFAULT'
  ORDER BY id ASC
  LIMIT 1;

  IF default_studio_id IS NULL THEN
    INSERT INTO studi (codice, nome, display_name)
    VALUES ('DEFAULT', 'Studio Principale', 'HALO Dental')
    RETURNING id INTO default_studio_id;
  END IF;

  ALTER TABLE studi ADD COLUMN IF NOT EXISTS display_name VARCHAR(120);
  ALTER TABLE studi ADD COLUMN IF NOT EXISTS business_name VARCHAR(160);
  ALTER TABLE studi ADD COLUMN IF NOT EXISTS vertical_key VARCHAR(80);
  ALTER TABLE studi ADD COLUMN IF NOT EXISTS brand_logo_url TEXT;
  ALTER TABLE studi ADD COLUMN IF NOT EXISTS brand_primary_color VARCHAR(32);
  ALTER TABLE studi ADD COLUMN IF NOT EXISTS brand_secondary_color VARCHAR(32);
  ALTER TABLE studi ADD COLUMN IF NOT EXISTS default_locale VARCHAR(16);
  ALTER TABLE studi ADD COLUMN IF NOT EXISTS default_timezone VARCHAR(64);
  ALTER TABLE studi ADD COLUMN IF NOT EXISTS settings_json JSONB;
  ALTER TABLE studi ADD COLUMN IF NOT EXISTS settings_version INTEGER;
  ALTER TABLE studi ADD COLUMN IF NOT EXISTS is_active BOOLEAN;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS studio_id BIGINT;
  ALTER TABLE platform_accounts ADD COLUMN IF NOT EXISTS is_active BOOLEAN;
  ALTER TABLE platform_accounts ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN;
  ALTER TABLE platform_accounts ADD COLUMN IF NOT EXISTS mfa_secret_encrypted TEXT;
  ALTER TABLE platform_accounts ADD COLUMN IF NOT EXISTS mfa_recovery_codes_json JSONB;
  ALTER TABLE platform_accounts ADD COLUMN IF NOT EXISTS mfa_pending_secret_encrypted TEXT;
  ALTER TABLE platform_accounts ADD COLUMN IF NOT EXISTS mfa_pending_recovery_codes_json JSONB;
  ALTER TABLE platform_accounts ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
  ALTER TABLE platform_accounts ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
  ALTER TABLE platform_refresh_tokens ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
  ALTER TABLE platform_refresh_tokens ADD COLUMN IF NOT EXISTS created_by_ip VARCHAR(64);
  ALTER TABLE platform_refresh_tokens ADD COLUMN IF NOT EXISTS user_agent VARCHAR(255);
  ALTER TABLE pazienti ADD COLUMN IF NOT EXISTS studio_id BIGINT;
  ALTER TABLE pazienti ADD COLUMN IF NOT EXISTS medico_id BIGINT;
  ALTER TABLE appuntamenti ADD COLUMN IF NOT EXISTS studio_id BIGINT;
  ALTER TABLE appuntamenti ADD COLUMN IF NOT EXISTS durata_minuti SMALLINT;
  ALTER TABLE appuntamenti ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
  ALTER TABLE appuntamenti ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
  ALTER TABLE google_calendar_connections ADD COLUMN IF NOT EXISTS studio_id BIGINT;
  ALTER TABLE google_calendar_connections ADD COLUMN IF NOT EXISTS connected_by_user_id BIGINT;
  ALTER TABLE google_calendar_connections ADD COLUMN IF NOT EXISTS google_account_email VARCHAR(255);
  ALTER TABLE google_calendar_connections ADD COLUMN IF NOT EXISTS calendar_id VARCHAR(255);
  ALTER TABLE google_calendar_connections ADD COLUMN IF NOT EXISTS access_token_encrypted TEXT;
  ALTER TABLE google_calendar_connections ADD COLUMN IF NOT EXISTS refresh_token_encrypted TEXT;
  ALTER TABLE google_calendar_connections ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMPTZ;
  ALTER TABLE google_calendar_connections ADD COLUMN IF NOT EXISTS status VARCHAR(20);
  ALTER TABLE google_calendar_connections ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMPTZ;
  ALTER TABLE google_calendar_connections ADD COLUMN IF NOT EXISTS last_error TEXT;
  ALTER TABLE google_calendar_connections ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
  ALTER TABLE google_calendar_connections ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
  ALTER TABLE appointment_google_event_links ADD COLUMN IF NOT EXISTS studio_id BIGINT;
  ALTER TABLE appointment_google_event_links ADD COLUMN IF NOT EXISTS connection_id BIGINT;
  ALTER TABLE appointment_google_event_links ADD COLUMN IF NOT EXISTS appointment_id BIGINT;
  ALTER TABLE appointment_google_event_links ADD COLUMN IF NOT EXISTS google_event_id VARCHAR(255);
  ALTER TABLE appointment_google_event_links ADD COLUMN IF NOT EXISTS google_event_etag VARCHAR(255);
  ALTER TABLE appointment_google_event_links ADD COLUMN IF NOT EXISTS last_payload_hash CHAR(64);
  ALTER TABLE appointment_google_event_links ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;
  ALTER TABLE appointment_google_event_links ADD COLUMN IF NOT EXISTS sync_state VARCHAR(20);
  ALTER TABLE appointment_google_event_links ADD COLUMN IF NOT EXISTS last_error TEXT;
  ALTER TABLE appointment_google_event_links ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
  ALTER TABLE appointment_google_event_links ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
  ALTER TABLE appointment_sync_outbox ADD COLUMN IF NOT EXISTS studio_id BIGINT;
  ALTER TABLE appointment_sync_outbox ADD COLUMN IF NOT EXISTS connection_id BIGINT;
  ALTER TABLE appointment_sync_outbox ADD COLUMN IF NOT EXISTS appointment_id BIGINT;
  ALTER TABLE appointment_sync_outbox ADD COLUMN IF NOT EXISTS operation VARCHAR(20);
  ALTER TABLE appointment_sync_outbox ADD COLUMN IF NOT EXISTS payload_json JSONB;
  ALTER TABLE appointment_sync_outbox ADD COLUMN IF NOT EXISTS dedupe_key VARCHAR(180);
  ALTER TABLE appointment_sync_outbox ADD COLUMN IF NOT EXISTS status VARCHAR(20);
  ALTER TABLE appointment_sync_outbox ADD COLUMN IF NOT EXISTS attempts INTEGER;
  ALTER TABLE appointment_sync_outbox ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ;
  ALTER TABLE appointment_sync_outbox ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ;
  ALTER TABLE appointment_sync_outbox ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;
  ALTER TABLE appointment_sync_outbox ADD COLUMN IF NOT EXISTS last_error TEXT;
  ALTER TABLE appointment_sync_outbox ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
  ALTER TABLE fatture ADD COLUMN IF NOT EXISTS studio_id BIGINT;
  ALTER TABLE prodotti ADD COLUMN IF NOT EXISTS studio_id BIGINT;
  ALTER TABLE fatture ADD COLUMN IF NOT EXISTS stripe_session_id VARCHAR(255);
  ALTER TABLE fatture ADD COLUMN IF NOT EXISTS stripe_payment_link TEXT;
  ALTER TABLE fatture ADD COLUMN IF NOT EXISTS stripe_status VARCHAR(50);
  ALTER TABLE fatture ADD COLUMN IF NOT EXISTS stripe_generated_at TIMESTAMPTZ;
  ALTER TABLE fatture_pagamenti ADD COLUMN IF NOT EXISTS stripe_session_id VARCHAR(255);
  ALTER TABLE fatture_pagamenti ADD COLUMN IF NOT EXISTS event_type VARCHAR(80);
  ALTER TABLE fatture_pagamenti ADD COLUMN IF NOT EXISTS stripe_status VARCHAR(50);
  ALTER TABLE fatture_pagamenti ADD COLUMN IF NOT EXISTS payload JSONB;
  ALTER TABLE fatture_pagamenti ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
  ALTER TABLE tenant_features ADD COLUMN IF NOT EXISTS config_json JSONB;
  ALTER TABLE tenant_features ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
  ALTER TABLE tenant_features ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
  ALTER TABLE vertical_templates ADD COLUMN IF NOT EXISTS default_settings_json JSONB;
  ALTER TABLE vertical_templates ADD COLUMN IF NOT EXISTS default_labels_json JSONB;
  ALTER TABLE vertical_templates ADD COLUMN IF NOT EXISTS default_features_json JSONB;
  ALTER TABLE vertical_templates ADD COLUMN IF NOT EXISTS default_roles_json JSONB;
  ALTER TABLE vertical_templates ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
  ALTER TABLE vertical_templates ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
  ALTER TABLE roles ADD COLUMN IF NOT EXISTS is_system BOOLEAN;
  ALTER TABLE roles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
  ALTER TABLE roles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
  ALTER TABLE role_permissions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
  ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
  ALTER TABLE custom_field_definitions ADD COLUMN IF NOT EXISTS required BOOLEAN;
  ALTER TABLE custom_field_definitions ADD COLUMN IF NOT EXISTS options_json JSONB;
  ALTER TABLE custom_field_definitions ADD COLUMN IF NOT EXISTS sort_order INTEGER;
  ALTER TABLE custom_field_definitions ADD COLUMN IF NOT EXISTS active BOOLEAN;
  ALTER TABLE custom_field_definitions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
  ALTER TABLE custom_field_definitions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
  ALTER TABLE custom_field_values ADD COLUMN IF NOT EXISTS value_json JSONB;
  ALTER TABLE custom_field_values ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
  ALTER TABLE custom_field_values ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
  ALTER TABLE tenant_audit_logs ADD COLUMN IF NOT EXISTS actor_user_id BIGINT;
  ALTER TABLE tenant_audit_logs ADD COLUMN IF NOT EXISTS action_key VARCHAR(120);
  ALTER TABLE tenant_audit_logs ADD COLUMN IF NOT EXISTS entity_key VARCHAR(80);
  ALTER TABLE tenant_audit_logs ADD COLUMN IF NOT EXISTS changes_json JSONB;
  ALTER TABLE tenant_audit_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
  ALTER TABLE platform_audit_logs ADD COLUMN IF NOT EXISTS tenant_id BIGINT;
  ALTER TABLE platform_audit_logs ADD COLUMN IF NOT EXISTS request_ip VARCHAR(64);
  ALTER TABLE platform_audit_logs ADD COLUMN IF NOT EXISTS user_agent VARCHAR(255);
  ALTER TABLE platform_audit_logs ADD COLUMN IF NOT EXISTS metadata_json JSONB;
  ALTER TABLE platform_audit_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

  UPDATE studi
  SET display_name = COALESCE(NULLIF(TRIM(display_name), ''), nome, 'HALO Dental')
  WHERE display_name IS NULL
     OR TRIM(display_name) = '';

  UPDATE studi
  SET vertical_key = COALESCE(NULLIF(TRIM(vertical_key), ''), 'dental')
  WHERE vertical_key IS NULL
     OR TRIM(vertical_key) = '';

  UPDATE studi
  SET default_locale = COALESCE(NULLIF(TRIM(default_locale), ''), 'it-IT')
  WHERE default_locale IS NULL
     OR TRIM(default_locale) = '';

  UPDATE studi
  SET default_timezone = COALESCE(NULLIF(TRIM(default_timezone), ''), 'Europe/Rome')
  WHERE default_timezone IS NULL
     OR TRIM(default_timezone) = '';

  UPDATE studi
  SET settings_json = '{}'::jsonb
  WHERE settings_json IS NULL;

  UPDATE studi
  SET is_active = TRUE
  WHERE is_active IS NULL;

  UPDATE studi
  SET settings_version = 1
  WHERE settings_version IS NULL
     OR settings_version < 1;

  UPDATE tenant_features
  SET config_json = '{}'::jsonb
  WHERE config_json IS NULL;

  UPDATE tenant_features
  SET created_at = NOW()
  WHERE created_at IS NULL;

  UPDATE tenant_features
  SET updated_at = NOW()
  WHERE updated_at IS NULL;

  UPDATE vertical_templates
  SET default_settings_json = '{}'::jsonb
  WHERE default_settings_json IS NULL;

  UPDATE vertical_templates
  SET default_labels_json = '{}'::jsonb
  WHERE default_labels_json IS NULL;

  UPDATE vertical_templates
  SET default_features_json = '{}'::jsonb
  WHERE default_features_json IS NULL;

  UPDATE vertical_templates
  SET default_roles_json = '[]'::jsonb
  WHERE default_roles_json IS NULL;

  UPDATE vertical_templates
  SET created_at = NOW()
  WHERE created_at IS NULL;

  UPDATE vertical_templates
  SET updated_at = NOW()
  WHERE updated_at IS NULL;

  UPDATE roles
  SET is_system = TRUE
  WHERE is_system IS NULL;

  UPDATE roles
  SET created_at = NOW()
  WHERE created_at IS NULL;

  UPDATE roles
  SET updated_at = NOW()
  WHERE updated_at IS NULL;

  UPDATE role_permissions
  SET created_at = NOW()
  WHERE created_at IS NULL;

  UPDATE user_roles
  SET created_at = NOW()
  WHERE created_at IS NULL;

  UPDATE custom_field_definitions
  SET required = FALSE
  WHERE required IS NULL;

  UPDATE custom_field_definitions
  SET options_json = '[]'::jsonb
  WHERE options_json IS NULL;

  UPDATE custom_field_definitions
  SET sort_order = 0
  WHERE sort_order IS NULL;

  UPDATE custom_field_definitions
  SET active = TRUE
  WHERE active IS NULL;

  UPDATE custom_field_definitions
  SET created_at = NOW()
  WHERE created_at IS NULL;

  UPDATE custom_field_definitions
  SET updated_at = NOW()
  WHERE updated_at IS NULL;

  UPDATE custom_field_values
  SET value_json = 'null'::jsonb
  WHERE value_json IS NULL;

  UPDATE custom_field_values
  SET created_at = NOW()
  WHERE created_at IS NULL;

  UPDATE custom_field_values
  SET updated_at = NOW()
  WHERE updated_at IS NULL;

  UPDATE tenant_audit_logs
  SET changes_json = '{}'::jsonb
  WHERE changes_json IS NULL;

  UPDATE tenant_audit_logs
  SET created_at = NOW()
  WHERE created_at IS NULL;

  UPDATE platform_audit_logs
  SET metadata_json = '{}'::jsonb
  WHERE metadata_json IS NULL;

  UPDATE platform_audit_logs
  SET created_at = NOW()
  WHERE created_at IS NULL;

  UPDATE platform_accounts
  SET mfa_enabled = FALSE
  WHERE mfa_enabled IS NULL;

  UPDATE platform_accounts
  SET mfa_recovery_codes_json = '[]'::jsonb
  WHERE mfa_recovery_codes_json IS NULL;

  UPDATE platform_accounts
  SET mfa_pending_recovery_codes_json = '[]'::jsonb
  WHERE mfa_pending_recovery_codes_json IS NULL;

  UPDATE appuntamenti
  SET durata_minuti = 30
  WHERE durata_minuti IS NULL OR durata_minuti <= 0;

  UPDATE appuntamenti
  SET created_at = NOW()
  WHERE created_at IS NULL;

  UPDATE appuntamenti
  SET updated_at = NOW()
  WHERE updated_at IS NULL;

  UPDATE google_calendar_connections
  SET status = 'active'
  WHERE status IS NULL OR TRIM(status) = '';

  UPDATE google_calendar_connections
  SET created_at = NOW()
  WHERE created_at IS NULL;

  UPDATE google_calendar_connections
  SET updated_at = NOW()
  WHERE updated_at IS NULL;

  UPDATE appointment_google_event_links
  SET sync_state = 'pending'
  WHERE sync_state IS NULL OR TRIM(sync_state) = '';

  UPDATE appointment_google_event_links
  SET created_at = NOW()
  WHERE created_at IS NULL;

  UPDATE appointment_google_event_links
  SET updated_at = NOW()
  WHERE updated_at IS NULL;

  UPDATE appointment_sync_outbox
  SET payload_json = '{}'::jsonb
  WHERE payload_json IS NULL;

  UPDATE appointment_sync_outbox
  SET dedupe_key = CONCAT('legacy-', id::text)
  WHERE dedupe_key IS NULL OR TRIM(dedupe_key) = '';

  UPDATE appointment_sync_outbox
  SET operation = 'upsert'
  WHERE operation IS NULL OR TRIM(operation) = '';

  UPDATE appointment_sync_outbox
  SET status = 'pending'
  WHERE status IS NULL OR TRIM(status) = '';

  UPDATE appointment_sync_outbox
  SET attempts = 0
  WHERE attempts IS NULL OR attempts < 0;

  UPDATE appointment_sync_outbox
  SET created_at = NOW()
  WHERE created_at IS NULL;

  ALTER TABLE studi ALTER COLUMN vertical_key SET DEFAULT 'dental';
  ALTER TABLE studi ALTER COLUMN default_locale SET DEFAULT 'it-IT';
  ALTER TABLE studi ALTER COLUMN default_timezone SET DEFAULT 'Europe/Rome';
  ALTER TABLE studi ALTER COLUMN settings_json SET DEFAULT '{}'::jsonb;
  ALTER TABLE studi ALTER COLUMN settings_version SET DEFAULT 1;
  ALTER TABLE studi ALTER COLUMN is_active SET DEFAULT TRUE;

  ALTER TABLE studi ALTER COLUMN display_name SET NOT NULL;
  ALTER TABLE studi ALTER COLUMN vertical_key SET NOT NULL;
  ALTER TABLE studi ALTER COLUMN default_locale SET NOT NULL;
  ALTER TABLE studi ALTER COLUMN default_timezone SET NOT NULL;
  ALTER TABLE studi ALTER COLUMN settings_json SET NOT NULL;
  ALTER TABLE studi ALTER COLUMN settings_version SET NOT NULL;
  ALTER TABLE studi ALTER COLUMN is_active SET NOT NULL;
  ALTER TABLE tenant_features ALTER COLUMN config_json SET DEFAULT '{}'::jsonb;
  ALTER TABLE tenant_features ALTER COLUMN config_json SET NOT NULL;
  ALTER TABLE tenant_features ALTER COLUMN created_at SET DEFAULT NOW();
  ALTER TABLE tenant_features ALTER COLUMN created_at SET NOT NULL;
  ALTER TABLE tenant_features ALTER COLUMN updated_at SET DEFAULT NOW();
  ALTER TABLE tenant_features ALTER COLUMN updated_at SET NOT NULL;
  ALTER TABLE vertical_templates ALTER COLUMN default_settings_json SET DEFAULT '{}'::jsonb;
  ALTER TABLE vertical_templates ALTER COLUMN default_settings_json SET NOT NULL;
  ALTER TABLE vertical_templates ALTER COLUMN default_labels_json SET DEFAULT '{}'::jsonb;
  ALTER TABLE vertical_templates ALTER COLUMN default_labels_json SET NOT NULL;
  ALTER TABLE vertical_templates ALTER COLUMN default_features_json SET DEFAULT '{}'::jsonb;
  ALTER TABLE vertical_templates ALTER COLUMN default_features_json SET NOT NULL;
  ALTER TABLE vertical_templates ALTER COLUMN default_roles_json SET DEFAULT '[]'::jsonb;
  ALTER TABLE vertical_templates ALTER COLUMN default_roles_json SET NOT NULL;
  ALTER TABLE vertical_templates ALTER COLUMN created_at SET DEFAULT NOW();
  ALTER TABLE vertical_templates ALTER COLUMN created_at SET NOT NULL;
  ALTER TABLE vertical_templates ALTER COLUMN updated_at SET DEFAULT NOW();
  ALTER TABLE vertical_templates ALTER COLUMN updated_at SET NOT NULL;
  ALTER TABLE roles ALTER COLUMN is_system SET DEFAULT FALSE;
  ALTER TABLE roles ALTER COLUMN is_system SET NOT NULL;
  ALTER TABLE roles ALTER COLUMN created_at SET DEFAULT NOW();
  ALTER TABLE roles ALTER COLUMN created_at SET NOT NULL;
  ALTER TABLE roles ALTER COLUMN updated_at SET DEFAULT NOW();
  ALTER TABLE roles ALTER COLUMN updated_at SET NOT NULL;
  ALTER TABLE role_permissions ALTER COLUMN created_at SET DEFAULT NOW();
  ALTER TABLE role_permissions ALTER COLUMN created_at SET NOT NULL;
  ALTER TABLE user_roles ALTER COLUMN created_at SET DEFAULT NOW();
  ALTER TABLE user_roles ALTER COLUMN created_at SET NOT NULL;
  ALTER TABLE custom_field_definitions ALTER COLUMN required SET DEFAULT FALSE;
  ALTER TABLE custom_field_definitions ALTER COLUMN required SET NOT NULL;
  ALTER TABLE custom_field_definitions ALTER COLUMN options_json SET DEFAULT '[]'::jsonb;
  ALTER TABLE custom_field_definitions ALTER COLUMN options_json SET NOT NULL;
  ALTER TABLE custom_field_definitions ALTER COLUMN sort_order SET DEFAULT 0;
  ALTER TABLE custom_field_definitions ALTER COLUMN sort_order SET NOT NULL;
  ALTER TABLE custom_field_definitions ALTER COLUMN active SET DEFAULT TRUE;
  ALTER TABLE custom_field_definitions ALTER COLUMN active SET NOT NULL;
  ALTER TABLE custom_field_definitions ALTER COLUMN created_at SET DEFAULT NOW();
  ALTER TABLE custom_field_definitions ALTER COLUMN created_at SET NOT NULL;
  ALTER TABLE custom_field_definitions ALTER COLUMN updated_at SET DEFAULT NOW();
  ALTER TABLE custom_field_definitions ALTER COLUMN updated_at SET NOT NULL;
  ALTER TABLE custom_field_values ALTER COLUMN value_json SET DEFAULT 'null'::jsonb;
  ALTER TABLE custom_field_values ALTER COLUMN value_json SET NOT NULL;
  ALTER TABLE custom_field_values ALTER COLUMN created_at SET DEFAULT NOW();
  ALTER TABLE custom_field_values ALTER COLUMN created_at SET NOT NULL;
  ALTER TABLE custom_field_values ALTER COLUMN updated_at SET DEFAULT NOW();
  ALTER TABLE custom_field_values ALTER COLUMN updated_at SET NOT NULL;
  ALTER TABLE tenant_audit_logs ALTER COLUMN changes_json SET DEFAULT '{}'::jsonb;
  ALTER TABLE tenant_audit_logs ALTER COLUMN changes_json SET NOT NULL;
  ALTER TABLE tenant_audit_logs ALTER COLUMN created_at SET DEFAULT NOW();
  ALTER TABLE tenant_audit_logs ALTER COLUMN created_at SET NOT NULL;
  ALTER TABLE platform_audit_logs ALTER COLUMN metadata_json SET DEFAULT '{}'::jsonb;
  ALTER TABLE platform_audit_logs ALTER COLUMN metadata_json SET NOT NULL;
  ALTER TABLE platform_audit_logs ALTER COLUMN created_at SET DEFAULT NOW();
  ALTER TABLE platform_audit_logs ALTER COLUMN created_at SET NOT NULL;
  ALTER TABLE platform_accounts ALTER COLUMN mfa_enabled SET DEFAULT FALSE;
  ALTER TABLE platform_accounts ALTER COLUMN mfa_enabled SET NOT NULL;
  ALTER TABLE platform_accounts ALTER COLUMN mfa_recovery_codes_json SET DEFAULT '[]'::jsonb;
  ALTER TABLE platform_accounts ALTER COLUMN mfa_recovery_codes_json SET NOT NULL;
  ALTER TABLE platform_accounts ALTER COLUMN mfa_pending_recovery_codes_json SET DEFAULT '[]'::jsonb;
  ALTER TABLE platform_accounts ALTER COLUMN mfa_pending_recovery_codes_json SET NOT NULL;
  ALTER TABLE appuntamenti ALTER COLUMN durata_minuti SET DEFAULT 30;
  ALTER TABLE appuntamenti ALTER COLUMN durata_minuti SET NOT NULL;
  ALTER TABLE appuntamenti ALTER COLUMN created_at SET DEFAULT NOW();
  ALTER TABLE appuntamenti ALTER COLUMN created_at SET NOT NULL;
  ALTER TABLE appuntamenti ALTER COLUMN updated_at SET DEFAULT NOW();
  ALTER TABLE appuntamenti ALTER COLUMN updated_at SET NOT NULL;
  ALTER TABLE google_calendar_connections ALTER COLUMN status SET DEFAULT 'active';
  ALTER TABLE google_calendar_connections ALTER COLUMN status SET NOT NULL;
  ALTER TABLE google_calendar_connections ALTER COLUMN created_at SET DEFAULT NOW();
  ALTER TABLE google_calendar_connections ALTER COLUMN created_at SET NOT NULL;
  ALTER TABLE google_calendar_connections ALTER COLUMN updated_at SET DEFAULT NOW();
  ALTER TABLE google_calendar_connections ALTER COLUMN updated_at SET NOT NULL;
  ALTER TABLE appointment_google_event_links ALTER COLUMN sync_state SET DEFAULT 'pending';
  ALTER TABLE appointment_google_event_links ALTER COLUMN sync_state SET NOT NULL;
  ALTER TABLE appointment_google_event_links ALTER COLUMN created_at SET DEFAULT NOW();
  ALTER TABLE appointment_google_event_links ALTER COLUMN created_at SET NOT NULL;
  ALTER TABLE appointment_google_event_links ALTER COLUMN updated_at SET DEFAULT NOW();
  ALTER TABLE appointment_google_event_links ALTER COLUMN updated_at SET NOT NULL;
  ALTER TABLE appointment_sync_outbox ALTER COLUMN payload_json SET DEFAULT '{}'::jsonb;
  ALTER TABLE appointment_sync_outbox ALTER COLUMN payload_json SET NOT NULL;
  ALTER TABLE appointment_sync_outbox ALTER COLUMN dedupe_key SET NOT NULL;
  ALTER TABLE appointment_sync_outbox ALTER COLUMN operation SET NOT NULL;
  ALTER TABLE appointment_sync_outbox ALTER COLUMN status SET DEFAULT 'pending';
  ALTER TABLE appointment_sync_outbox ALTER COLUMN status SET NOT NULL;
  ALTER TABLE appointment_sync_outbox ALTER COLUMN attempts SET DEFAULT 0;
  ALTER TABLE appointment_sync_outbox ALTER COLUMN attempts SET NOT NULL;
  ALTER TABLE appointment_sync_outbox ALTER COLUMN created_at SET DEFAULT NOW();
  ALTER TABLE appointment_sync_outbox ALTER COLUMN created_at SET NOT NULL;

  UPDATE users
  SET studio_id = default_studio_id
  WHERE studio_id IS NULL;

  UPDATE pazienti
  SET studio_id = default_studio_id
  WHERE studio_id IS NULL;

  UPDATE appuntamenti a
  SET studio_id = p.studio_id
  FROM pazienti p
  WHERE a.studio_id IS NULL
    AND a.paziente_id = p.id;

  UPDATE fatture f
  SET studio_id = p.studio_id
  FROM pazienti p
  WHERE f.studio_id IS NULL
    AND f.paziente_id = p.id;

  UPDATE prodotti
  SET studio_id = default_studio_id
  WHERE studio_id IS NULL;

  UPDATE appuntamenti
  SET studio_id = default_studio_id
  WHERE studio_id IS NULL;

  UPDATE fatture
  SET studio_id = default_studio_id
  WHERE studio_id IS NULL;

  EXECUTE format('ALTER TABLE users ALTER COLUMN studio_id SET DEFAULT %s', default_studio_id);
  EXECUTE format('ALTER TABLE pazienti ALTER COLUMN studio_id SET DEFAULT %s', default_studio_id);
  EXECUTE format('ALTER TABLE appuntamenti ALTER COLUMN studio_id SET DEFAULT %s', default_studio_id);
  EXECUTE format('ALTER TABLE fatture ALTER COLUMN studio_id SET DEFAULT %s', default_studio_id);
  EXECUTE format('ALTER TABLE prodotti ALTER COLUMN studio_id SET DEFAULT %s', default_studio_id);

  ALTER TABLE users ALTER COLUMN studio_id SET NOT NULL;
  ALTER TABLE pazienti ALTER COLUMN studio_id SET NOT NULL;
  ALTER TABLE appuntamenti ALTER COLUMN studio_id SET NOT NULL;
  ALTER TABLE fatture ALTER COLUMN studio_id SET NOT NULL;
  ALTER TABLE prodotti ALTER COLUMN studio_id SET NOT NULL;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_users_studio_id'
      AND conrelid = 'users'::regclass
  ) THEN
    ALTER TABLE users
    ADD CONSTRAINT fk_users_studio_id
    FOREIGN KEY (studio_id) REFERENCES studi(id) ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_pazienti_studio_id'
      AND conrelid = 'pazienti'::regclass
  ) THEN
    ALTER TABLE pazienti
    ADD CONSTRAINT fk_pazienti_studio_id
    FOREIGN KEY (studio_id) REFERENCES studi(id) ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_pazienti_medico_id'
      AND conrelid = 'pazienti'::regclass
  ) THEN
    ALTER TABLE pazienti
    ADD CONSTRAINT fk_pazienti_medico_id
    FOREIGN KEY (medico_id) REFERENCES users(id) ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_appuntamenti_studio_id'
      AND conrelid = 'appuntamenti'::regclass
  ) THEN
    ALTER TABLE appuntamenti
    ADD CONSTRAINT fk_appuntamenti_studio_id
    FOREIGN KEY (studio_id) REFERENCES studi(id) ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_fatture_studio_id'
      AND conrelid = 'fatture'::regclass
  ) THEN
    ALTER TABLE fatture
    ADD CONSTRAINT fk_fatture_studio_id
    FOREIGN KEY (studio_id) REFERENCES studi(id) ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_prodotti_studio_id'
      AND conrelid = 'prodotti'::regclass
  ) THEN
    ALTER TABLE prodotti
    ADD CONSTRAINT fk_prodotti_studio_id
    FOREIGN KEY (studio_id) REFERENCES studi(id) ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_google_calendar_connections_studio_id'
      AND conrelid = 'google_calendar_connections'::regclass
  ) THEN
    ALTER TABLE google_calendar_connections
    ADD CONSTRAINT fk_google_calendar_connections_studio_id
    FOREIGN KEY (studio_id) REFERENCES studi(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_google_calendar_connections_connected_by_user_id'
      AND conrelid = 'google_calendar_connections'::regclass
  ) THEN
    ALTER TABLE google_calendar_connections
    ADD CONSTRAINT fk_google_calendar_connections_connected_by_user_id
    FOREIGN KEY (connected_by_user_id) REFERENCES users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_appointment_google_event_links_studio_id'
      AND conrelid = 'appointment_google_event_links'::regclass
  ) THEN
    ALTER TABLE appointment_google_event_links
    ADD CONSTRAINT fk_appointment_google_event_links_studio_id
    FOREIGN KEY (studio_id) REFERENCES studi(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_appointment_google_event_links_connection_id'
      AND conrelid = 'appointment_google_event_links'::regclass
  ) THEN
    ALTER TABLE appointment_google_event_links
    ADD CONSTRAINT fk_appointment_google_event_links_connection_id
    FOREIGN KEY (connection_id) REFERENCES google_calendar_connections(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_appointment_google_event_links_appointment_id'
      AND conrelid = 'appointment_google_event_links'::regclass
  ) THEN
    ALTER TABLE appointment_google_event_links
    ADD CONSTRAINT fk_appointment_google_event_links_appointment_id
    FOREIGN KEY (appointment_id) REFERENCES appuntamenti(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_appointment_sync_outbox_studio_id'
      AND conrelid = 'appointment_sync_outbox'::regclass
  ) THEN
    ALTER TABLE appointment_sync_outbox
    ADD CONSTRAINT fk_appointment_sync_outbox_studio_id
    FOREIGN KEY (studio_id) REFERENCES studi(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_appointment_sync_outbox_connection_id'
      AND conrelid = 'appointment_sync_outbox'::regclass
  ) THEN
    ALTER TABLE appointment_sync_outbox
    ADD CONSTRAINT fk_appointment_sync_outbox_connection_id
    FOREIGN KEY (connection_id) REFERENCES google_calendar_connections(id) ON DELETE CASCADE;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_appointment_sync_outbox_appointment_id'
      AND conrelid = 'appointment_sync_outbox'::regclass
  ) THEN
    ALTER TABLE appointment_sync_outbox
    DROP CONSTRAINT fk_appointment_sync_outbox_appointment_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ck_google_calendar_connections_status'
      AND conrelid = 'google_calendar_connections'::regclass
  ) THEN
    ALTER TABLE google_calendar_connections
    ADD CONSTRAINT ck_google_calendar_connections_status
    CHECK (status IN ('active', 'revoked', 'error'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ck_appointment_google_event_links_sync_state'
      AND conrelid = 'appointment_google_event_links'::regclass
  ) THEN
    ALTER TABLE appointment_google_event_links
    ADD CONSTRAINT ck_appointment_google_event_links_sync_state
    CHECK (sync_state IN ('pending', 'synced', 'error'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ck_appointment_sync_outbox_operation'
      AND conrelid = 'appointment_sync_outbox'::regclass
  ) THEN
    ALTER TABLE appointment_sync_outbox
    ADD CONSTRAINT ck_appointment_sync_outbox_operation
    CHECK (operation IN ('create', 'update', 'delete', 'upsert'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ck_appointment_sync_outbox_status'
      AND conrelid = 'appointment_sync_outbox'::regclass
  ) THEN
    ALTER TABLE appointment_sync_outbox
    ADD CONSTRAINT ck_appointment_sync_outbox_status
    CHECK (status IN ('pending', 'processing', 'retry', 'done', 'failed'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_studio_id
  ON users (studio_id);

CREATE INDEX IF NOT EXISTS idx_studi_vertical_key
  ON studi (vertical_key);

CREATE INDEX IF NOT EXISTS idx_pazienti_studio_id
  ON pazienti (studio_id);

CREATE INDEX IF NOT EXISTS idx_tenant_features_studio_id
  ON tenant_features (studio_id);

CREATE INDEX IF NOT EXISTS idx_tenant_features_feature_key
  ON tenant_features (feature_key);

CREATE INDEX IF NOT EXISTS idx_vertical_templates_name
  ON vertical_templates (name);

CREATE INDEX IF NOT EXISTS idx_roles_studio_id
  ON roles (studio_id);

CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id
  ON role_permissions (role_id);

CREATE INDEX IF NOT EXISTS idx_role_permissions_permission_key
  ON role_permissions (permission_key);

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id
  ON user_roles (user_id);

CREATE INDEX IF NOT EXISTS idx_custom_field_definitions_studio_entity
  ON custom_field_definitions (studio_id, entity_key);

CREATE INDEX IF NOT EXISTS idx_custom_field_values_studio_entity_record
  ON custom_field_values (studio_id, entity_key, record_id);

CREATE INDEX IF NOT EXISTS idx_pazienti_medico_id
  ON pazienti (medico_id);

CREATE INDEX IF NOT EXISTS idx_appuntamenti_studio_id
  ON appuntamenti (studio_id);

CREATE INDEX IF NOT EXISTS idx_fatture_studio_id
  ON fatture (studio_id);

CREATE INDEX IF NOT EXISTS idx_prodotti_studio_id
  ON prodotti (studio_id);

CREATE INDEX IF NOT EXISTS idx_appuntamenti_paziente_id
  ON appuntamenti (paziente_id);

CREATE INDEX IF NOT EXISTS idx_google_calendar_connections_studio_id
  ON google_calendar_connections (studio_id);

CREATE INDEX IF NOT EXISTS idx_google_calendar_connections_status
  ON google_calendar_connections (status);

CREATE UNIQUE INDEX IF NOT EXISTS idx_google_calendar_connections_active_per_studio
  ON google_calendar_connections (studio_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_appointment_google_event_links_studio_id
  ON appointment_google_event_links (studio_id);

CREATE INDEX IF NOT EXISTS idx_appointment_google_event_links_appointment_id
  ON appointment_google_event_links (appointment_id);

CREATE INDEX IF NOT EXISTS idx_appointment_google_event_links_connection_id
  ON appointment_google_event_links (connection_id);

CREATE INDEX IF NOT EXISTS idx_appointment_sync_outbox_status_retry
  ON appointment_sync_outbox (status, next_retry_at);

CREATE INDEX IF NOT EXISTS idx_appointment_sync_outbox_studio_id
  ON appointment_sync_outbox (studio_id);

CREATE INDEX IF NOT EXISTS idx_appointment_sync_outbox_connection_id
  ON appointment_sync_outbox (connection_id);

CREATE INDEX IF NOT EXISTS idx_appointment_sync_outbox_appointment_id
  ON appointment_sync_outbox (appointment_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_appointment_sync_outbox_dedupe_key
  ON appointment_sync_outbox (studio_id, dedupe_key);

CREATE OR REPLACE VIEW core_clients AS
SELECT
  p.id,
  p.studio_id,
  p.nome,
  p.cognome,
  p.telefono,
  p.email,
  p.note,
  p.medico_id AS owner_user_id
FROM pazienti p;

CREATE OR REPLACE VIEW core_appointments AS
SELECT
  a.id,
  a.studio_id,
  a.paziente_id AS client_id,
  a.data,
  a.ora,
  a.medico AS owner_display_name,
  a.stato,
  a.durata_minuti,
  a.created_at,
  a.updated_at
FROM appuntamenti a;

CREATE OR REPLACE VIEW core_invoices AS
SELECT
  f.id,
  f.studio_id,
  f.paziente_id AS client_id,
  f.importo,
  f.stato,
  f.data,
  f.stripe_session_id,
  f.stripe_payment_link,
  f.stripe_status,
  f.stripe_generated_at
FROM fatture f;

CREATE OR REPLACE VIEW core_inventory_items AS
SELECT
  p.id,
  p.studio_id,
  p.nome,
  p.quantita AS stock_quantity,
  p.soglia_minima AS reorder_threshold
FROM prodotti p;

INSERT INTO vertical_templates (
  key,
  name,
  default_settings_json,
  default_labels_json,
  default_features_json,
  default_roles_json
)
VALUES
  (
    'dental',
    'Studio dentistico',
    '{"product_name":"HALO Dental"}'::jsonb,
    '{"client_singular":"Paziente","client_plural":"Pazienti","owner_singular":"Dentista","owner_plural":"Dentisti"}'::jsonb,
    '{"dashboard.enabled":true,"agenda.enabled":true,"calendar.google.enabled":false,"clients.enabled":true,"billing.enabled":true,"payments.stripe.enabled":true,"inventory.enabled":true,"automation.enabled":true,"reports.enabled":true,"advanced_notes.enabled":true,"custom_fields.enabled":true}'::jsonb,
    '["ADMIN","SEGRETARIO","DIPENDENTE"]'::jsonb
  ),
  (
    'medical',
    'Studio medico',
    '{"product_name":"HALO Med"}'::jsonb,
    '{"client_singular":"Paziente","client_plural":"Pazienti","owner_singular":"Medico","owner_plural":"Medici"}'::jsonb,
    '{"dashboard.enabled":true,"agenda.enabled":true,"calendar.google.enabled":false,"clients.enabled":true,"billing.enabled":true,"payments.stripe.enabled":true,"inventory.enabled":false,"automation.enabled":true,"reports.enabled":true,"advanced_notes.enabled":true,"custom_fields.enabled":true}'::jsonb,
    '["ADMIN","SEGRETARIO","DIPENDENTE"]'::jsonb
  ),
  (
    'physiotherapy',
    'Studio fisioterapico',
    '{"product_name":"HALO Physio"}'::jsonb,
    '{"client_singular":"Paziente","client_plural":"Pazienti","owner_singular":"Terapista","owner_plural":"Terapisti"}'::jsonb,
    '{"dashboard.enabled":true,"agenda.enabled":true,"calendar.google.enabled":false,"clients.enabled":true,"billing.enabled":true,"payments.stripe.enabled":true,"inventory.enabled":false,"automation.enabled":true,"reports.enabled":true,"advanced_notes.enabled":false,"custom_fields.enabled":true}'::jsonb,
    '["ADMIN","SEGRETARIO","DIPENDENTE"]'::jsonb
  ),
  (
    'aesthetics',
    'Centro estetico',
    '{"product_name":"HALO Aesthetics"}'::jsonb,
    '{"client_singular":"Cliente","client_plural":"Clienti","owner_singular":"Operatore","owner_plural":"Operatori"}'::jsonb,
    '{"dashboard.enabled":true,"agenda.enabled":true,"calendar.google.enabled":false,"clients.enabled":true,"billing.enabled":true,"payments.stripe.enabled":true,"inventory.enabled":true,"automation.enabled":true,"reports.enabled":true,"advanced_notes.enabled":false,"custom_fields.enabled":true}'::jsonb,
    '["ADMIN","SEGRETARIO","DIPENDENTE"]'::jsonb
  ),
  (
    'consulting',
    'Studio consulenza',
    '{"product_name":"HALO Consulting"}'::jsonb,
    '{"client_singular":"Cliente","client_plural":"Clienti","owner_singular":"Consulente","owner_plural":"Consulenti"}'::jsonb,
    '{"dashboard.enabled":true,"agenda.enabled":true,"calendar.google.enabled":false,"clients.enabled":true,"billing.enabled":true,"payments.stripe.enabled":true,"inventory.enabled":false,"automation.enabled":true,"reports.enabled":true,"advanced_notes.enabled":true,"custom_fields.enabled":true}'::jsonb,
    '["ADMIN","SEGRETARIO","DIPENDENTE"]'::jsonb
  ),
  (
    'services',
    'Attivita di servizi',
    '{"product_name":"HALO Services"}'::jsonb,
    '{"client_singular":"Cliente","client_plural":"Clienti","owner_singular":"Operatore","owner_plural":"Operatori"}'::jsonb,
    '{"dashboard.enabled":true,"agenda.enabled":true,"calendar.google.enabled":false,"clients.enabled":true,"billing.enabled":true,"payments.stripe.enabled":true,"inventory.enabled":true,"automation.enabled":true,"reports.enabled":true,"advanced_notes.enabled":false,"custom_fields.enabled":true}'::jsonb,
    '["ADMIN","SEGRETARIO","DIPENDENTE"]'::jsonb
  )
ON CONFLICT (key) DO UPDATE
SET name = EXCLUDED.name,
    default_settings_json = EXCLUDED.default_settings_json,
    default_labels_json = EXCLUDED.default_labels_json,
    default_features_json = EXCLUDED.default_features_json,
    default_roles_json = EXCLUDED.default_roles_json,
    updated_at = NOW();

INSERT INTO roles (studio_id, role_key, display_name, is_system)
SELECT
  s.id,
  seeded.role_key,
  seeded.display_name,
  TRUE
FROM studi s
CROSS JOIN (
  VALUES
    ('ADMIN', 'Administrator'),
    ('DENTISTA', 'Practitioner'),
    ('SEGRETARIO', 'Coordinator')
) AS seeded(role_key, display_name)
ON CONFLICT (studio_id, role_key) DO UPDATE
SET display_name = EXCLUDED.display_name,
    is_system = TRUE,
    updated_at = NOW();

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
    ('ADMIN', 'calendar.google.read'),
    ('ADMIN', 'calendar.google.manage'),
    ('SEGRETARIO', 'dashboard.read'),
    ('SEGRETARIO', 'clients.read'),
    ('SEGRETARIO', 'clients.write'),
    ('SEGRETARIO', 'appointments.read'),
    ('SEGRETARIO', 'appointments.write'),
    ('SEGRETARIO', 'billing.read'),
    ('SEGRETARIO', 'billing.write'),
    ('SEGRETARIO', 'automations.read'),
    ('SEGRETARIO', 'calendar.google.read'),
    ('SEGRETARIO', 'calendar.google.manage'),
    ('DENTISTA', 'dashboard.read'),
    ('DENTISTA', 'clients.read'),
    ('DENTISTA', 'appointments.read'),
    ('DENTISTA', 'appointments.write'),
    ('DENTISTA', 'billing.read')
) AS seeded(role_key, permission_key)
  ON seeded.role_key = r.role_key
ON CONFLICT (role_id, permission_key) DO NOTHING;

INSERT INTO user_roles (user_id, role_id)
SELECT
  u.id,
  r.id
FROM users u
JOIN roles r
  ON r.studio_id = u.studio_id
 AND r.role_key = u.ruolo::text
ON CONFLICT (user_id, role_id) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id
  ON refresh_tokens (user_id);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at
  ON refresh_tokens (expires_at);

CREATE INDEX IF NOT EXISTS idx_platform_refresh_tokens_account_id
  ON platform_refresh_tokens (platform_account_id);

CREATE INDEX IF NOT EXISTS idx_platform_refresh_tokens_expires_at
  ON platform_refresh_tokens (expires_at);

CREATE INDEX IF NOT EXISTS idx_platform_audit_logs_platform_account_id
  ON platform_audit_logs (platform_account_id);

CREATE INDEX IF NOT EXISTS idx_platform_audit_logs_tenant_id
  ON platform_audit_logs (tenant_id);

CREATE INDEX IF NOT EXISTS idx_platform_audit_logs_created_at
  ON platform_audit_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_appuntamenti_data
  ON appuntamenti (data);

CREATE INDEX IF NOT EXISTS idx_fatture_paziente_id
  ON fatture (paziente_id);

CREATE INDEX IF NOT EXISTS idx_fatture_data
  ON fatture (data);

CREATE UNIQUE INDEX IF NOT EXISTS idx_fatture_stripe_session_id_unique
  ON fatture (stripe_session_id)
  WHERE stripe_session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_fatture_pagamenti_studio_id
  ON fatture_pagamenti (studio_id);

CREATE INDEX IF NOT EXISTS idx_fatture_pagamenti_fattura_id
  ON fatture_pagamenti (fattura_id);

CREATE INDEX IF NOT EXISTS idx_fatture_pagamenti_created_at
  ON fatture_pagamenti (created_at DESC);

INSERT INTO users (studio_id, nome, email, password_hash, ruolo)
VALUES (
  (SELECT id FROM studi WHERE codice = 'DEFAULT' ORDER BY id ASC LIMIT 1),
  'Admin',
  'admin@studio.com',
  '$2b$10$E4mEVZHmunJSPtXiHsQ4/uwvLrjHxz7bhIehj7Fr.qYmDc9UyMGHK',
  'ADMIN'
)
ON CONFLICT (email) DO NOTHING;
