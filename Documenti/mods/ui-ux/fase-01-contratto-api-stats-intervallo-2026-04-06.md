# Fase 1 - Contratto API Stats Con Intervallo

Stato: completata  
Data: 2026-04-06

## Obiettivo della fase
Estendere l'endpoint `/stats/guadagni` per supportare:
1. intervallo temporale custom (`date_from`, `date_to`)
2. granularita (`day|week|month`)
3. metadati di range in risposta

Retrocompatibilita mantenuta:
1. senza query, endpoint continua a funzionare con default ultimi 30 giorni
2. campo storico principale resta `ultimi30Giorni` (ora pilotato da range/granularity)

## File modificati
1. `/Users/francescostrano/Desktop/HALO/backend/src/routes/stats.routes.js`
2. `/Users/francescostrano/Desktop/HALO/backend/src/services/stats.service.js`
3. `/Users/francescostrano/Desktop/HALO/frontend/src/features/dashboard/api.ts` (typing)

## Nuovo contratto endpoint
`GET /stats/guadagni`

### Query params supportati
1. `date_from` (`YYYY-MM-DD`)
2. `date_to` (`YYYY-MM-DD`)
3. `granularity` (`day|week|month`)

### Regole validazione
1. `date_from` e `date_to` vanno passati insieme oppure entrambi omessi
2. formato data deve essere `YYYY-MM-DD`
3. `date_from <= date_to`
4. intervallo massimo: `365` giorni inclusivi
5. `granularity` se presente deve essere `day|week|month`

### Default se query assente
1. range: ultimi 30 giorni (da `today - 29` a `today`)
2. granularita inferita:
   - `day` se range <= 90 giorni
   - `week` se range > 90 giorni

## Schema risposta esteso
Campi esistenti:
1. `giornaliero`
2. `mensile`
3. `totale`
4. `ultimi30Giorni` (serie storica)
5. `currency`

Nuovi metadati:
1. `range_start` (`YYYY-MM-DD`)
2. `range_end` (`YYYY-MM-DD`)
3. `granularity` (`day|week|month`)
4. `points_count` (numero punti serie)

## Semantica aggregazione serie
1. `day`: un punto per giorno nel range
2. `week`: punti settimanali (periodi ISO week), somme limitate al range richiesto
3. `month`: punti mensili, somme limitate al range richiesto

## Error handling
Input query non valido:
1. HTTP `400` con `message` esplicita (es. formato data o range errato)

Errori runtime/database:
1. HTTP `500` con messaggio generico e dettaglio tecnico

## Verifiche eseguite
1. `node --check backend/src/services/stats.service.js` -> OK
2. `node --check backend/src/routes/stats.routes.js` -> OK
3. `npx tsc --noEmit` (frontend) -> OK

## Esito fase
`SUPERATO`  
Contratto API pronto per Fase 2 (controlli frontend intervallo realmente operativi).
