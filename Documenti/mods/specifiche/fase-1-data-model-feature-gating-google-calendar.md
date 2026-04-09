# Fase 1 - Data Model e Feature Gating Google Calendar

Data: `09 Aprile 2026`  
Stato: `completata`

## Obiettivo della fase

Preparare le fondamenta tecniche per la sync Google Calendar senza ancora implementare OAuth/routes/worker:

1. modello dati persistente per connessione/mapping/outbox
2. feature flag tenant dedicata
3. permessi RBAC dedicati
4. estensione minima tabella appuntamenti per supportare sincronizzazione affidabile

## Implementazione applicata

## 1) Database (`database/schema.sql`)

Aggiunte tabelle:

1. `google_calendar_connections`
2. `appointment_google_event_links`
3. `appointment_sync_outbox`

Aggiunte colonne a `appuntamenti`:

1. `durata_minuti SMALLINT NOT NULL DEFAULT 30`
2. `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
3. `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`

Aggiunte regole/indici:

1. FK e check constraints idempotenti nel blocco `DO $$ ... $$`
2. indice unico connessione attiva per tenant:
   - `idx_google_calendar_connections_active_per_studio`
3. indice unico dedupe outbox:
   - `idx_appointment_sync_outbox_dedupe_key` su `(studio_id, dedupe_key)`
4. indici operativi su outbox (`status,next_retry_at`, `studio_id`, `connection_id`, `appointment_id`)

Aggiornata view:

1. `core_appointments` ora espone anche `durata_minuti`, `created_at`, `updated_at`

## 2) Feature flag e RBAC backend

File: `backend/src/config/multi-sector.js`

Aggiunto catalogo feature:

1. `calendar.google.enabled`

Aggiunti permessi legacy:

1. `calendar.google.read`
2. `calendar.google.manage`

Assegnazione ruoli:

1. `ADMIN`: read + manage
2. `SEGRETARIO`: read + manage
3. `DENTISTA`/`DIPENDENTE`: nessun nuovo permesso in Fase 1

File: `backend/src/services/feature-flags.service.js`

Aggiunto modulo bootstrap:

1. `enabled_modules.google_calendar`

## 3) Seed template e permessi su schema

Nel seed `vertical_templates`:

1. aggiunto `calendar.google.enabled: false` per tutti i vertical

Nel seed `role_permissions`:

1. aggiunte coppie `ADMIN|SEGRETARIO` con `calendar.google.read/manage`

## Fatti tecnici da seguire (vincoli)

1. `calendar.google.enabled` deve rimanere `false` di default (rollout controllato).
2. Tutte le query sync devono essere sempre tenant-scoped (`studio_id` obbligatorio).
3. `dedupe_key` outbox e obbligatoria e unica per tenant.
4. Una sola connessione Google attiva per tenant.
5. Le API agenda non devono chiamare Google direttamente: solo enqueue su outbox.

## Checklist di accettazione Fase 1

1. Schema applicabile su DB nuovo ed esistente senza errori di duplicazione.
2. `/api/admin/tenant-features` include `calendar.google.enabled` nel catalogo.
3. Utenti `ADMIN` e `SEGRETARIO` ricevono i nuovi permessi dopo sync RBAC.
4. `enabled_modules.google_calendar` presente nel bootstrap tenant.

## Prossima fase

Fase 2:

1. OAuth routes (`/oauth/start`, `/oauth/callback`, `/status`, `/disconnect`)
2. cifratura token + refresh
3. selezione calendario target (`/calendars`, `/config`)
