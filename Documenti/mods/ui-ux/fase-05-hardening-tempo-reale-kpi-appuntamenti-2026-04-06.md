# FASE 5 — Hardening tempo reale KPI appuntamenti

Data: 2026-04-06
Stato: Completata

## Obiettivo
Garantire che il KPI `APPOINTMENTS` resti coerente nel tempo anche senza interazioni utente o refresh manuale della pagina.

## Problema risolto
Dopo la Fase 4, il conteggio era corretto al momento del render, ma non si aggiornava automaticamente al cambio minuto/giorno se non avvenivano altri re-render.

## Implementazione tecnica
File modificato:
- `frontend/src/app/dashboard/page.tsx`

Interventi:
1. `countUpcomingAppointments(...)` ora accetta anche `referenceDate` opzionale.
2. Introdotto stato `timeTick` aggiornato ogni `30s` tramite `setInterval` in `useEffect`.
3. Ricalcolo `upcomingAppointmentsCount` dipendente da:
   - `snapshot.appointments`
   - `timeTick`

## Effetto funzionale
- Il KPI appuntamenti futuri si riallinea automaticamente al passare del tempo.
- Migliore coerenza su edge case temporali (es. 23:59 -> 00:00).
- Nessun cambiamento nel contratto API.

## Verifiche eseguite
Eseguite in `frontend/`:
- `npm run lint -- src/app/dashboard/page.tsx` ✅
- `npx tsc --noEmit` ✅

## Note
- Intervallo 30s scelto come compromesso tra accuratezza percepita e costo computazionale.
- Se richiesto, puo essere portato a 60s o reso configurabile via costante.
