# Fase 2 - OAuth e Connessione Google Calendar

Data: `09 Aprile 2026`  
Stato: `completata`

## Obiettivo della fase

Implementare il flusso tecnico di connessione Google Calendar tenant-aware:

1. avvio OAuth (`/oauth/start`)
2. callback OAuth (`/oauth/callback`)
3. stato integrazione (`/status`)
4. disconnessione (`/disconnect`)
5. elenco calendari (`/calendars`)
6. configurazione calendario target (`/config`)

## Endpoint implementati

Base path:

1. `/api/v3/integrations/google-calendar`

Contratti attivi:

1. `POST /oauth/start` (auth + feature + permesso `calendar.google.manage`)
2. `GET /oauth/callback` (no bearer, protetto da `state` firmato+TTL)
3. `GET /status` (auth + feature + permesso `calendar.google.read`)
4. `GET /calendars` (auth + feature + permesso `calendar.google.read`)
5. `PUT /config` (auth + feature + permesso `calendar.google.manage`)
6. `POST /disconnect` (auth + feature + permesso `calendar.google.manage`)

## Componenti tecnici introdotti

## 1) Service OAuth/Google API

File:

1. `backend/src/services/google-calendar-auth.service.js`

Capacita implementate:

1. generazione URL OAuth Google
2. `state` firmato HMAC SHA-256 + scadenza (`GOOGLE_OAUTH_STATE_TTL_SEC`)
3. exchange `authorization_code -> access/refresh token`
4. refresh automatico access token in scadenza
5. cifratura token at-rest (`AES-256-GCM`) con `GOOGLE_TOKEN_ENCRYPTION_KEY`
6. revoca token Google su disconnect
7. listing calendari tramite Google Calendar API

## 2) Route backend

File:

1. `backend/src/routes/google-calendar.routes.js`

Aspetti chiave:

1. callback OAuth non autenticata ma validata con `state` firmato (contiene `studio_id` e `user_id`)
2. controllo feature flag tenant anche in callback
3. redirect finale a `CLIENT_URL/impostazioni?google_calendar=connected`
4. configurazione `calendar_id` su connessione attiva
5. salvataggio config funzionale (es. `default_duration_minutes`) dentro `tenant_features.config_json`

## 3) Server wiring

File:

1. `backend/src/server.js`

Registrazione route:

1. `app.use("/api/v3/integrations/google-calendar", googleCalendarRoutes);`

## Variabili ambiente aggiunte/estese

1. `GOOGLE_OAUTH_STATE_TTL_SEC` (default consigliato `600`)

Gia presenti da Fase 0:

1. `GOOGLE_CLIENT_ID`
2. `GOOGLE_CLIENT_SECRET`
3. `GOOGLE_OAUTH_REDIRECT_URI`
4. `GOOGLE_OAUTH_SCOPES`
5. `GOOGLE_TOKEN_ENCRYPTION_KEY`
6. `GOOGLE_OAUTH_STATE_SECRET`

## Fatti tecnici da seguire (vincoli)

1. callback OAuth deve rimanere senza bearer token ma con verifica `state` obbligatoria.
2. token Google non devono essere mai restituiti nelle API.
3. tutte le operazioni connessione devono restare tenant-scoped (`studio_id`).
4. la feature deve essere abilitata (`calendar.google.enabled=true`) prima del connect.
5. `PUT /config` aggiorna solo connessione attiva.

## Verifiche eseguite

1. `node --check` su:
   - `backend/src/services/google-calendar-auth.service.js`
   - `backend/src/routes/google-calendar.routes.js`
   - `backend/src/server.js`
2. test unit nuovi:
   - `backend/tests/google-calendar-auth.service.test.js`
3. test backend esistenti mantenuti (`npm test`).

## Prossima fase

Fase 3:

1. outbox service + worker
2. retry/backoff operativo
3. integrazione enqueue sui CRUD appuntamenti
