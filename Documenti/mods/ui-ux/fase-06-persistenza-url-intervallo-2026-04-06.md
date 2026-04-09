# FASE 6 — Persistenza URL controllo intervallo dashboard

Data: 2026-04-06
Stato: Completata

## Obiettivo
Rendere la gestione dell'intervallo grafico realmente persistente e condivisibile via URL, mantenendo in sync:
- preset range
- date custom
- granularita

## Ambito
- Frontend dashboard (`Next.js App Router`)
- Nessuna modifica backend

## File modificato
- `frontend/src/app/dashboard/page.tsx`

## Implementazione tecnica
1. Integrati hook `next/navigation`:
- `useRouter`
- `usePathname`
- `useSearchParams`

2. Aggiunto parser robusto parametri URL:
- `range`: `7d|14d|30d|90d|ytd|custom`
- `from`, `to`: formato `YYYY-MM-DD`
- `granularity`: `auto|day|week|month`

3. Inizializzazione stato dashboard da querystring:
- `rangePreset`
- `customDateFrom`
- `customDateTo`
- `granularityMode`

4. Sync bi-direzionale stato <-> URL:
- se cambia URL (anche back/forward), lo stato UI si riallinea
- se cambia stato UI, URL viene aggiornato con `router.replace(..., { scroll: false })`

5. Regole di pulizia query:
- `from`/`to` presenti solo quando `range=custom` e entrambe valorizzate
- `granularity` omesso quando `auto`

## Risultato funzionale
- Refresh pagina: filtro intervallo conservato.
- Link condiviso: stessa vista range/granularita per chi apre il link.
- Navigazione browser back/forward: stato dashboard coerente.

## Verifiche eseguite
Eseguite in `frontend/`:
- `npm run lint -- src/app/dashboard/page.tsx` ✅
- `npx tsc --noEmit` ✅

## Note
- URL non valida (es. `range=custom` senza date) viene ricondotta a default sicuro (`30d`) per evitare stato inconsistente.
