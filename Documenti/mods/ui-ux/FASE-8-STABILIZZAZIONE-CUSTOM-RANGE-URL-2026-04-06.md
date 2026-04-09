# FASE 8 — Stabilizzazione custom range con persistenza URL

Data: 2026-04-06
Stato: Completata

## Obiettivo
Correggere un edge case introdotto dalla persistenza URL: selezionando `Custom`, la dashboard poteva tornare automaticamente a `30d` prima del completamento delle due date.

## Problema rilevato
Nel parser querystring era presente un fallback forzato:
- se `range=custom` e mancava `from` o `to` -> `rangePreset = 30d`

Effetto pratico:
- l'utente non riusciva a restare in modalità `Custom` mentre compilava il range.

## Implementazione tecnica
File modificati:
- `frontend/src/app/dashboard/page.tsx`
- `frontend/tests/dashboard-functional-guards.test.js`

### 1) Fix parser URL
In `readFiltersFromSearchParams(...)`:
- rimosso fallback forzato `custom -> 30d`
- mantenuto `rangePreset` derivato da query anche con date parziali/mancanti

### 2) Aggiornamento test guard
Sostituito test di fallback con test di stabilità:
- ora verifica che modalità `custom` non venga più degradata automaticamente a `30d`

## Risultato funzionale
- selezione `Custom` stabile durante compilazione date
- persistenza URL mantenuta
- nessun reset indesiderato del preset

## Verifiche eseguite
Eseguite in `frontend/`:
- `npm run lint -- src/app/dashboard/page.tsx tests/dashboard-functional-guards.test.js` ✅
- `npm test` ✅ (`10/10` pass)

## Note
- Se `Custom` ha date incomplete, la validazione esistente continua a impedire fetch incoerenti finché l'intervallo non è valido.
