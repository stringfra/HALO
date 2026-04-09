# Fase 2 - Frontend Intervallo Grafico Reale

Stato: completata  
Data: 2026-04-06

## Obiettivo della fase
Rendere i controlli dashboard realmente collegati all'intervallo dati del grafico revenue:
1. preset periodo
2. custom range
3. granularita selezionabile

## File modificati
1. `/Users/francescostrano/Desktop/HALO/frontend/src/features/dashboard/api.ts`
2. `/Users/francescostrano/Desktop/HALO/frontend/src/app/dashboard/page.tsx`

## Implementazione eseguita

## 1) Client API stats aggiornato
`getGuadagniStats` ora accetta query opzionali:
1. `dateFrom`
2. `dateTo`
3. `granularity`

Mapping automatico su querystring:
1. `date_from`
2. `date_to`
3. `granularity`

## 2) Stato UI intervallo introdotto in dashboard
Nuovi stati:
1. `rangePreset`: `7d|14d|30d|90d|ytd|custom`
2. `customDateFrom`
3. `customDateTo`
4. `granularityMode`: `auto|day|week|month`

## 3) Risoluzione intervallo lato frontend
Implementata logica `resolveRange(...)`:
1. converte preset in date reali
2. valida custom range
3. applica vincolo max 365 giorni
4. produce `fromIso` / `toIso` da inviare all'API

## 4) Granularita effettiva
1. `auto` usa inferenza locale (`day` se range <= 90, altrimenti `week`)
2. se utente seleziona `day|week|month`, il valore viene passato esplicitamente

## 5) Fetch dashboard legato all'intervallo
`useEffect` di caricamento ora dipende da:
1. `requestedRange.fromIso`
2. `requestedRange.toIso`
3. `requestedGranularity`

Per `ADMIN`, chiamata stats eseguita con parametri reali.  
Per ruoli non admin, nessuna chiamata stats (comportamento invariato lato permessi).

## 6) Toolbar dashboard resa operativa
Aggiunti controlli reali:
1. preset rapidi (`7d`, `14d`, `30d`, `90d`, `YTD`, `Custom`)
2. input `date` da-a per custom
3. select granularita (`Auto`, `Daily`, `Weekly`, `Monthly`)

## 7) Label periodo allineata al range attivo
La label mostra l'intervallo effettivo:
1. prioritariamente da metadati API (`range_start`, `range_end`) se presenti
2. fallback al range richiesto in UI

## Verifiche
1. `npx eslint src/app/dashboard/page.tsx src/features/dashboard/api.ts` -> OK
2. `npx tsc --noEmit` -> OK

## Esito fase
`SUPERATO`  
La dashboard ora gestisce realmente l'intervallo temporale del grafico (preset + custom + granularita).
