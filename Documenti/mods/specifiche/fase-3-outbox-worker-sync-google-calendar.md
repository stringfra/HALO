# Fase 3 - Outbox e Worker Sync Google Calendar

Data: `09 Aprile 2026`  
Stato: `completata`

## Obiettivo della fase

Implementare l'infrastruttura di sincronizzazione asincrona robusta:

1. enqueue su outbox con dedupe key
2. worker batch con claim `FOR UPDATE SKIP LOCKED`
3. retry/backoff su errori temporanei
4. marking `done/retry/failed`
5. motore sync Google Calendar idempotente (create/update/delete/upsert)

## Componenti implementati

## 1) Outbox service

File:

1. `backend/src/services/appointment-sync-outbox.service.js`

Funzioni chiave:

1. `buildAppointmentSyncDedupeKey(...)`
2. `enqueueAppointmentSyncOutbox(...)`
3. `claimAppointmentSyncOutboxBatch(...)`
4. `markOutboxJobDone(...)`
5. `scheduleOutboxJobRetry(...)`
6. `markOutboxJobFailed(...)`
7. `computeRetryDelayMs(...)`
8. `isRetryableSyncError(...)`

## 2) Worker service

File:

1. `backend/src/services/appointment-sync-worker.service.js`

Capacita:

1. processing batch periodico
2. lock anti-concorrenza (`workerInFlight`)
3. retry con backoff esponenziale + jitter
4. max tentativi configurabile
5. bootstrap automatico all'avvio backend

## 3) Sync engine Google Calendar

File:

1. `backend/src/services/google-calendar-sync.service.js`

Capacita:

1. mapping appuntamento -> evento Google
2. gestione `create/update/upsert` con link table
3. `delete` evento Google con fallback su payload/link
4. upsert mapping in `appointment_google_event_links`
5. classificazione errori retryable/non-retryable

## 4) Server wiring

File:

1. `backend/src/server.js`

Aggiunto:

1. `startAppointmentSyncWorker()` in bootstrap
2. stop worker su `SIGINT`/`SIGTERM`

Endpoint operativo aggiunto:

1. `POST /api/v3/integrations/google-calendar/sync/worker/run-once`

## 5) Hardening schema (importante)

File:

1. `database/schema.sql`

Decisione tecnica:

1. rimossa FK `appointment_sync_outbox -> appuntamenti` per non perdere job `delete` quando l'appuntamento viene eliminato.

Motivo:

1. con `ON DELETE CASCADE` il job sparirebbe prima di chiamare Google, causando drift.

## Variabili ambiente worker

1. `GOOGLE_SYNC_WORKER_ENABLED`
2. `GOOGLE_SYNC_WORKER_INTERVAL_MS`
3. `GOOGLE_SYNC_WORKER_BATCH_SIZE`
4. `GOOGLE_SYNC_WORKER_MAX_ATTEMPTS`

## Fatti tecnici da seguire (vincoli)

1. CRUD agenda non deve chiamare Google direttamente: solo enqueue outbox.
2. `dedupe_key` deve rappresentare una singola mutazione logica.
3. errori `429/5xx` e timeout rete devono andare in retry.
4. errori di dominio (connessione inattiva, calendar_id assente, payload invalido) devono andare `failed`.

## Verifiche eseguite

1. `node --check` su nuovi service e server.
2. test unit nuovi su outbox helper e OAuth.
3. test backend (`npm test`) con pass completo.
4. schema SQL riapplicato su DB locale con successo.

## Prossima fase

Fase 4:

1. aggancio enqueue outbox su `POST/PUT/DELETE` appuntamenti
2. dedupe key per mutazione (`created/updated/deleted`)
3. test E2E CRUD -> outbox -> worker -> Google event
