# Fase 6 - Monitoraggio Sync + Full Resync Google Calendar

Data: `09 Aprile 2026`  
Stato: `completata`

## Obiettivo della fase

Aggiungere strumenti operativi per:

1. monitorare in modo chiaro la salute della sincronizzazione appuntamenti
2. avviare una risincronizzazione massiva controllata (`full resync`)
3. tracciare azioni operative in audit log tenant

## Backend implementato

Servizi:

1. `backend/src/services/appointment-sync-monitoring.service.js`
2. `backend/src/services/appointment-sync-full-resync.service.js`

Route aggiornate:

1. `backend/src/routes/google-calendar.routes.js`

Nuovi endpoint:

1. `GET /api/v3/integrations/google-calendar/sync/metrics`
2. `POST /api/v3/integrations/google-calendar/sync/full`

Endpoint già presente, hardenizzato con audit:

1. `POST /api/v3/integrations/google-calendar/sync/worker/run-once`

Audit log azioni operative:

1. `google_calendar.config.updated`
2. `google_calendar.connection.disconnected`
3. `google_calendar.sync.worker_run_once`
4. `google_calendar.sync.full_resync.triggered`

## Frontend implementato

API frontend estese:

1. `frontend/src/features/google-calendar/api.ts`
2. `getGoogleCalendarSyncMetrics()`
3. `runGoogleCalendarFullResync()`

UI impostazioni estesa:

1. `frontend/src/features/google-calendar/google-calendar-settings-panel.tsx`

Nuove capability visibili:

1. bottone `Aggiorna metriche`
2. blocco `Monitoraggio sync` con snapshot coda/errori
3. blocco `Full resync` con parametri `date_from`, `date_to`, `limit`, include past/cancelled
4. feedback esito full resync (`candidati`, `enqueued`, `skipped`, `failed`)

## Fatti tecnici da seguire

1. `sync/full` non forza la sync se connessione Google non attiva: risponde con `triggered=false`.
2. `sync/full` valida input operativi (`boolean`, date ISO, `limit` 1-10000).
3. il monitoraggio è tenant-aware (`studio_id`) e non espone segreti OAuth.
4. audit logging è best-effort (`safeLogTenantAuditEvent`) per non bloccare il flusso operativo.

## Verifiche eseguite

1. `node --check backend/src/routes/google-calendar.routes.js`
2. `node --check backend/src/services/appointment-sync-monitoring.service.js`
3. `node --check backend/src/services/appointment-sync-full-resync.service.js`
4. `npm test` (backend) -> pass
5. `npm run lint` (frontend) -> pass
6. `npm run build` (frontend) -> pass
