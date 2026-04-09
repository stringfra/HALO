# Fase 5 - UI Impostazioni + Test E2E Google Calendar

Data: `09 Aprile 2026`  
Stato: `completata`

## Obiettivo della fase

Rendere la feature utilizzabile da interfaccia admin e chiudere il percorso end-to-end operativo.

## UI implementata

Pagina:

1. `frontend/src/app/impostazioni/page.tsx`

Nuovo pannello:

1. `frontend/src/features/google-calendar/google-calendar-settings-panel.tsx`

API frontend:

1. `frontend/src/features/google-calendar/api.ts`

Funzioni disponibili in UI:

1. visualizzazione stato feature `calendar.google.enabled`
2. enable/disable feature per tenant
3. avvio OAuth (`Collega Google`)
4. stato connessione (account, scadenza token, ultimo errore)
5. load lista calendari
6. salvataggio `calendar_id` e durata default
7. disconnessione account Google
8. run manuale worker (`sync/worker/run-once`)

## Flusso E2E pratico (tenant reale)

1. Apri `Impostazioni` -> sezione `Integrazione Google Calendar`.
2. Click `Abilita feature`.
3. Click `Collega Google` e completa consenso Google.
4. Rientro su `/impostazioni?google_calendar=connected`.
5. Click `Carica calendari`.
6. Seleziona calendario target e click `Salva configurazione`.
7. Crea un appuntamento in agenda.
8. Torna in impostazioni e click `Esegui worker una volta`.
9. Verifica evento su Google Calendar.
10. Modifica appuntamento, riesegui worker, verifica update evento.
11. Elimina appuntamento, riesegui worker, verifica delete evento.

## Fatti tecnici da seguire (vincoli)

1. i pulsanti connect/config/disconnect richiedono feature attiva.
2. la UI non espone mai token OAuth.
3. il worker manuale serve come strumento di diagnosi oltre al worker automatico.
4. eventuali errori sono mostrati via alert in pagina (messaggi backend).

## Verifiche eseguite

1. `node --check` backend invariato dopo integrazione UI.
2. `npm test` backend pass.
3. lint frontend eseguibile come step finale locale (`npm run lint`).

## Prossimo passo

Fase 6:

1. metriche/monitoraggio sync (success/retry/failed)
2. endpoint `sync/full` tenant-aware
3. hardening operativo e runbook anomalie
