# Fase 0 - Preliminari OAuth Google Calendar

Data: `09 Aprile 2026`  
Stato: `configurazione locale completata`

## 1. Configurazione locale gia applicata

File aggiornati:

1. `backend/.env`
2. `backend/.env.example`

Variabili inserite:

1. `GOOGLE_CLIENT_ID`
2. `GOOGLE_CLIENT_SECRET`
3. `GOOGLE_OAUTH_REDIRECT_URI`
4. `GOOGLE_OAUTH_SCOPES`
5. `GOOGLE_TOKEN_ENCRYPTION_KEY`
6. `GOOGLE_OAUTH_STATE_SECRET`

Nota: `GOOGLE_CLIENT_SECRET` e stato impostato nel solo file locale `backend/.env` (file gia escluso da git).

## 2. Parametri da inserire in Google Cloud Console

Sezione: `APIs & Services -> Credentials -> OAuth 2.0 Client IDs -> Web application`

### Authorized redirect URIs

1. `http://localhost:4000/api/v3/integrations/google-calendar/oauth/callback`

Per produzione aggiungere anche:

1. `https://api.<tuo-dominio>/api/v3/integrations/google-calendar/oauth/callback`

### Authorized JavaScript origins

Se il frontend avvia il flusso OAuth dal browser:

1. `http://localhost:3000`
2. `https://app.<tuo-dominio>`

Se il flusso OAuth parte solo dal backend, i JS origins non sono necessari.

## 3. Scope OAuth consigliati MVP

1. `openid`
2. `email`
3. `profile`
4. `https://www.googleapis.com/auth/calendar.events`
5. `https://www.googleapis.com/auth/calendar.readonly`

## 4. Check operativo Fase 0

1. Google Calendar API abilitata nel progetto Google Cloud.
2. OAuth consent screen pubblicato (anche in test mode va bene per sviluppo).
3. Redirect URI locale salvato con match esatto.
4. Variabili ambiente backend compilate.
5. Secret/token encryption key presenti.

## 5. Prossimo step

Partire con Fase 1:

1. migrazioni DB (`google_calendar_connections`, `appointment_google_event_links`, `appointment_sync_outbox`)
2. feature flag `calendar.google.enabled`
3. permessi `calendar.google.read` e `calendar.google.manage`
