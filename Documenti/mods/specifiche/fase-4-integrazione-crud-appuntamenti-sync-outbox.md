# Fase 4 - Integrazione CRUD Appuntamenti con Sync Outbox

Data: `09 Aprile 2026`  
Stato: `completata`

## Obiettivo della fase

Collegare i flussi agenda reali (`POST/PUT/DELETE appuntamenti`) all'outbox Google Calendar senza bloccare l'esperienza utente.

## Implementazione applicata

## 1) Nuovo service enqueue dedicato

File:

1. `backend/src/services/appointment-google-sync-enqueue.service.js`

Capacita:

1. risoluzione contesto sync attivo (`feature flag + connessione + calendar_id`)
2. costruzione fingerprint mutazione
3. costruzione dedupe key
4. enqueue outbox tenant-safe
5. hint pre-delete per recuperare `google_event_id` prima del delete DB

## 2) Hook su route appuntamenti

File:

1. `backend/src/routes/appuntamenti.routes.js`

Hook introdotti:

1. dopo `POST /appuntamenti` -> enqueue `operation=create`
2. dopo `PUT /appuntamenti/:id` -> enqueue `operation=update`
3. su `DELETE /appuntamenti/:id`:
   - recupero hint `google_event_id` prima del delete
   - enqueue `operation=delete` dopo delete riuscito

## 3) Comportamento runtime scelto

1. il CRUD agenda resta **non bloccante**:
   - se enqueue fallisce, l'API appuntamenti risponde comunque successo (con warning nei log backend)
2. enqueue avviene solo se:
   - feature `calendar.google.enabled` attiva
   - connessione Google attiva
   - `calendar_id` configurato
3. se condizioni non soddisfatte:
   - nessun enqueue, motivo esplicito interno (`feature_disabled`, `connection_not_active`, ecc.)

## Fatti tecnici da seguire (vincoli)

1. l'enqueue deve avvenire solo **dopo** persistenza riuscita su DB locale.
2. il delete deve mantenere hint `google_event_id` pre-delete per evitare perdita riferimento.
3. non propagare errori enqueue al client agenda.
4. mantenere `studio_id` come filtro obbligatorio in tutto il flusso.

## Verifiche eseguite

1. `node --check`:
   - `appointment-google-sync-enqueue.service.js`
   - `appuntamenti.routes.js`
2. `npm test` backend: pass completo.

## Cosa e ora operativo

1. create/update/delete appuntamenti generano job outbox quando integrazione Google e attiva.
2. worker Fase 3 puo processare questi job senza ulteriori modifiche manuali.

## Prossimo passo

Fase 5:

1. test E2E completo su tenant reale:
   - connect OAuth
   - config calendario
   - create/update/delete appuntamento
   - verifica evento su Google Calendar
2. UI impostazioni integrazione (stato, connect/disconnect, run sync).
