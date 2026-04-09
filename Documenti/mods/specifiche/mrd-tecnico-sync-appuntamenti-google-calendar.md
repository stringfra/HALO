# MRD Tecnico - Sincronizzazione Appuntamenti su Google Calendar
Versione: `v1.0`  
Data: `09 Aprile 2026`  
Stato: `Draft operativo`  
Ambiente analizzato: repository locale `HALO` (backend + frontend + database)  
Nota: `documento tecnico e piano esecutivo; nessuna modifica codice applicata in questo step`

## 1. Contesto tecnico attuale

1. Agenda backend disponibile su `backend/src/routes/appuntamenti.routes.js` con CRUD completo e permessi `appointments.read`/`appointments.write`.
2. Esposizione API sia legacy che alias `v2` tramite:
   - `/appuntamenti`
   - `/api/v2/appointments`
3. Modello dati attuale tabella `appuntamenti`:
   - `id`, `studio_id`, `paziente_id`, `data`, `ora`, `medico`, `stato`
4. Non esistono tabelle o servizi di integrazione Google Calendar nello stato attuale.
5. Timezone tenant gia disponibile via `studi.default_timezone` e bootstrap (`tenant-config.service.js`).
6. Architettura multi-tenant e RBAC gia presenti (feature flags, permissions, audit logs tenant).

## 2. Obiettivo prodotto

Permettere al gestionale HALO di sincronizzare gli appuntamenti su Google Calendar in modo affidabile, tenant-safe e tracciabile, con rollout progressivo.

Obiettivo MVP:

1. Sync `one-way` da HALO verso Google Calendar.
2. Aggiornamento quasi real-time su creazione/modifica/cancellazione appuntamenti.
3. Possibilita di sincronizzazione completa manuale (full re-sync).
4. Gestione errori, retry e audit end-to-end.

## 3. KPI di successo

1. `>= 99%` appuntamenti sincronizzati entro `5 minuti`.
2. Tasso errori permanenti sync `< 1%` sul totale operazioni.
3. Duplicati evento Google per stesso appuntamento: `0` in condizioni normali.
4. Tempo medio sync per operazione singola `< 2s` (esclusi retry/backoff).

## 4. Scope

## 4.1 In scope (MVP)

1. Connessione OAuth2 Google per tenant.
2. Selezione calendario Google target.
3. Sync creazione/modifica/cancellazione appuntamenti.
4. Job di retry con backoff per errori temporanei Google.
5. Stato integrazione visibile in area impostazioni tenant.

## 4.2 Fuori scope (MVP)

1. Sync bidirezionale Google -> HALO.
2. Propagazione partecipanti/guest complessi.
3. Gestione disponibilita risorse multi-calendario avanzata.
4. Notifiche WhatsApp/SMS collegate alla sync calendario.

## 5. Requisiti funzionali (FR)

1. `FR-01` ADMIN e SEGRETARIO possono collegare/disconnettere un account Google Calendar.
2. `FR-02` Ogni tenant puo definire un calendario Google target attivo.
3. `FR-03` Creazione appuntamento HALO genera evento Google.
4. `FR-04` Modifica appuntamento HALO aggiorna evento Google corrispondente.
5. `FR-05` Cancellazione appuntamento HALO annulla/elimina evento Google corrispondente.
6. `FR-06` La sync deve essere idempotente (nessuna duplicazione evento su retry).
7. `FR-07` Deve esistere un comando di `full re-sync` manuale per tenant.
8. `FR-08` Errori di sync devono essere consultabili con dettaglio minimo (timestamp, codice errore, motivo).
9. `FR-09` La feature deve essere disattivabile via feature flag tenant.

## 6. Requisiti non funzionali (NFR)

1. `NFR-01` Sicurezza token OAuth: cifratura at-rest e mai esposti al frontend.
2. `NFR-02` Isolamento tenant: nessun dato cross-tenant in query o job.
3. `NFR-03` Affidabilita: retry automatici su `429` e `5xx` Google con backoff esponenziale.
4. `NFR-04` Osservabilita: log strutturati con `requestId`, `studio_id`, `operation`, `job_id`.
5. `NFR-05` Performance: impatto minimo sulle API agenda (enqueue asincrono, no chiamate Google bloccanti nel path utente).
6. `NFR-06` Compliance: minimizzazione dati personali in payload Google.

## 7. Architettura tecnica proposta

## 7.1 Direzione sync

MVP `one-way`: HALO e sorgente autoritativa, Google Calendar e destinazione.

## 7.2 Componenti backend

1. `GoogleCalendarAuthService`
   - gestione OAuth2, refresh token, revoke
2. `GoogleCalendarApiClient`
   - wrapper API Google Calendar v3 (insert/update/delete/list)
3. `AppointmentSyncOutboxService`
   - enqueue operazioni CRUD appuntamenti in outbox
4. `AppointmentSyncWorker`
   - processa outbox in background con retry/backoff
5. `GoogleCalendarSyncService`
   - mapping dominio HALO -> evento Google + idempotenza
6. `GoogleCalendarIntegrationRoutes`
   - endpoint configurazione, stato, re-sync, disconnect

## 7.3 Flusso operativo

1. Utente crea/modifica/cancella appuntamento.
2. API agenda salva su DB locale.
3. API agenda inserisce evento in `sync_outbox`.
4. Worker asincrono legge outbox e chiama Google Calendar API.
5. Worker aggiorna mapping locale (`appointment_id` <-> `google_event_id`) e stato job.

## 8. Estensioni modello dati (proposta)

## 8.1 Nuove tabelle

1. `google_calendar_connections`
   - `id`, `studio_id`, `connected_by_user_id`, `google_account_email`, `calendar_id`
   - `access_token_encrypted`, `refresh_token_encrypted`, `token_expires_at`
   - `status` (`active|revoked|error`), `last_sync_at`, `last_error`, `created_at`, `updated_at`
   - vincolo unico suggerito: una connessione attiva per tenant (`studio_id`, `status=active`)

2. `appointment_google_event_links`
   - `id`, `studio_id`, `connection_id`, `appointment_id`, `google_event_id`, `google_event_etag`
   - `last_payload_hash`, `last_synced_at`, `sync_state`, `last_error`, `created_at`, `updated_at`
   - unique: (`connection_id`, `appointment_id`) e (`connection_id`, `google_event_id`)

3. `appointment_sync_outbox`
   - `id`, `studio_id`, `connection_id`, `appointment_id`, `operation` (`create|update|delete|upsert`)
   - `payload_json`, `dedupe_key`, `status` (`pending|processing|retry|done|failed`)
   - `attempts`, `next_retry_at`, `locked_at`, `processed_at`, `last_error`, `created_at`
   - index su `status`, `next_retry_at`, `studio_id`

## 8.2 Adeguamenti tabella esistente `appuntamenti` (consigliati)

1. Aggiungere `durata_minuti SMALLINT NOT NULL DEFAULT 30`.
2. Aggiungere `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`.
3. Aggiungere `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`.

Motivazione:

1. Google richiede `start` e `end`.
2. `updated_at` semplifica riconciliazione e diagnosi drift.

## 9. Contratti API (proposta v3)

Base path consigliato: `/api/v3/integrations/google-calendar`

1. `POST /oauth/start`
   - output: `auth_url`
2. `GET /oauth/callback`
   - input query: `code`, `state`
   - output: stato connessione
3. `GET /status`
   - output: connessione attiva, calendario selezionato, ultimo sync, ultimo errore
4. `GET /calendars`
   - output: lista calendari disponibili account Google connesso
5. `PUT /config`
   - input: `calendar_id`, `default_duration_minutes`
6. `POST /sync/full`
   - avvia full re-sync tenant
7. `POST /disconnect`
   - revoca integrazione e disattiva job

Permessi suggeriti:

1. `calendar.google.read`
2. `calendar.google.manage`

Ruoli suggeriti MVP:

1. `ADMIN`: read + manage
2. `SEGRETARIO`: read + manage
3. `DENTISTA` e `DIPENDENTE`: nessun accesso gestione integrazione (solo uso agenda)

## 10. Mapping dati HALO -> Google Event

1. `summary`: `${nome} ${cognome}` paziente (fallback: `Paziente #id`).
2. `description`: template minimale (medico, stato, id appuntamento HALO).
3. `start.dateTime`: combinazione `data + ora` in timezone tenant.
4. `end.dateTime`: `start + durata_minuti`.
5. `status`:
   - `in_attesa` -> `tentative`
   - `confermato` -> `confirmed`
   - `completato` -> `confirmed`
   - `annullato` -> `cancelled`
6. `extendedProperties.private`:
   - `halo_studio_id`
   - `halo_appointment_id`
   - `halo_sync_version`

## 11. Sicurezza e compliance

1. Salvare token Google cifrati (`AES-256-GCM` o KMS equivalente).
2. Non includere note cliniche o dati sensibili non necessari nella descrizione evento.
3. Mascherare token e dati personali nei log applicativi.
4. Validare `state` OAuth con firma e scadenza breve.
5. Audit eventi integrazione in `tenant_audit_logs` con `action_key` dedicata.

## 12. Piano in fasi precise

## Fase 0 - Allineamento e prerequisiti (1 giorno)

Obiettivo:
1. Definire baseline tecnica, scope MVP e criteri di accettazione.

Attivita:
1. Registrare progetto Google Cloud + OAuth consent screen + redirect URI.
2. Definire variabili ambiente backend (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, ecc.).
3. Confermare ownership sicurezza token e logging.

Output:
1. Checklist prerequisiti completata.
2. Config ambiente dev/stage documentata.

Gate:
1. OAuth test manuale funzionante in ambiente di sviluppo.

## Fase 1 - Data model e feature gating (1-2 giorni)

Obiettivo:
1. Preparare schema DB e toggles tenant.

Attivita:
1. Migrazione tabelle `google_calendar_connections`, `appointment_google_event_links`, `appointment_sync_outbox`.
2. Estensione `appuntamenti` con `durata_minuti`, `created_at`, `updated_at`.
3. Aggiunta feature flag `calendar.google.enabled`.
4. Aggiunta permessi `calendar.google.read/manage` nel catalogo ruoli.

Output:
1. Migrazioni SQL idempotenti.
2. Permessi e feature disponibili nel bootstrap tenant.

Gate:
1. Test migrazione su DB vuoto e DB esistente superati.

## Fase 2 - OAuth e connessione calendario (2 giorni)

Obiettivo:
1. Consentire connessione account Google per tenant.

Attivita:
1. Implementare endpoint `/oauth/start`, `/oauth/callback`, `/disconnect`, `/status`.
2. Implementare cifratura token e refresh automatico.
3. Implementare endpoint `/calendars` e `/config`.

Output:
1. Tenant puo collegare account e selezionare calendario target.

Gate:
1. Flusso connect -> list calendars -> save config -> status attivo completato.

## Fase 3 - Outbox e worker sync (2 giorni)

Obiettivo:
1. Creare motore affidabile di sincronizzazione asincrona.

Attivita:
1. Implementare enqueue operazioni sync con `dedupe_key`.
2. Implementare worker polling outbox.
3. Implementare retry/backoff e gestione errori permanenti.

Output:
1. Pipeline `pending -> processing -> done/retry/failed` operativa.

Gate:
1. Test automatici su idempotenza, retry e concorrenza base superati.

## Fase 4 - Integrazione con CRUD appuntamenti (2 giorni)

Obiettivo:
1. Collegare il motore sync agli endpoint agenda esistenti.

Attivita:
1. Hook su `POST /api/v2/appointments` per enqueue `create`.
2. Hook su `PUT /api/v2/appointments/:id` per enqueue `update`.
3. Hook su `DELETE /api/v2/appointments/:id` per enqueue `delete`.
4. Mapping evento Google con `extendedProperties.private`.

Output:
1. Ogni modifica agenda produce operazione sync coerente.

Gate:
1. Test E2E: create/update/delete appuntamento con evento Google coerente.

## Fase 5 - UI impostazioni integrazione (2 giorni)

Obiettivo:
1. Rendere la feature gestibile da pannello amministrativo tenant.

Attivita:
1. Nuova sezione frontend in impostazioni: stato connessione, calendario selezionato, test sync.
2. Azioni: collega, disconnetti, full re-sync.
3. Visualizzazione ultimo errore sync e timestamp ultimo successo.

Output:
1. UX completa per gestione integrazione senza uso strumenti esterni.

Gate:
1. UAT interno completato con account test Google.

## Fase 6 - Re-sync completo e monitoraggio (1-2 giorni)

Obiettivo:
1. Ridurre drift dati e migliorare operativita.

Attivita:
1. Endpoint/job `POST /sync/full` tenant-aware.
2. Dashboard minima metriche sync (successi, retry, failed).
3. Log strutturati e audit eventi principali.

Output:
1. Processo di recupero automatico/manuale in caso anomalie.

Gate:
1. Simulazioni errore rete/quota e recupero controllato superate.

## Fase 7 - QA finale, canary rollout e go-live (1-2 giorni)

Obiettivo:
1. Rilasciare in sicurezza su tenant reali.

Attivita:
1. Test regressione agenda completa.
2. Rollout canary su sottoinsieme tenant (`feature flag`).
3. Runbook rollback (disattivazione feature + stop worker + preservazione outbox).

Output:
1. Release production-ready.

Gate:
1. KPI stabili per almeno 72 ore su tenant canary.

## 13. Test strategy minima

1. Unit test:
   - mapping evento
   - dedupe key
   - retry decision
2. Integration test:
   - OAuth callback handling
   - enqueue su CRUD appuntamenti
3. E2E test:
   - connect account
   - create/update/delete appuntamento
   - verifica evento su Google (stub o sandbox)
4. Regressione:
   - endpoint agenda invariati per client non connessi a Google

## 14. Rischi principali e mitigazioni

1. Quota/rate limit Google API
   - mitigazione: throttling + backoff + queue
2. Token scaduti/revocati
   - mitigazione: refresh token flow + stato connessione `error`
3. Duplicati evento in condizioni race
   - mitigazione: unique constraints + dedupe_key + upsert idempotente
4. Drift dati per failure prolungate
   - mitigazione: full re-sync + metriche + alert errore persistente

## 15. Definition of Done (MVP)

1. Tenant puo collegare Google e scegliere calendario target.
2. CRUD appuntamenti produce sync coerente su Google Calendar.
3. Retry e gestione errori operano senza bloccare esperienza agenda.
4. Feature flag consente rollout graduale e rollback rapido.
5. Test minimi (unit + integration + E2E) superati e documentati.
