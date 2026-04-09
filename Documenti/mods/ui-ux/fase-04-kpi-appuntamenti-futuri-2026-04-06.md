# FASE 4 — KPI appuntamenti futuri (conteggio reale)

Data: 2026-04-06
Stato: Completata

## Obiettivo
Sostituire il valore simulato della card `APPOINTMENTS` nella dashboard con un conteggio reale degli appuntamenti ancora da svolgere, coerente con stato e data/ora effettive.

## Ambito
- Frontend dashboard (calcolo KPI)
- Nessuna modifica schema DB
- Nessuna modifica endpoint backend

## Implementazione tecnica
File modificato:
- `frontend/src/app/dashboard/page.tsx`

Interventi principali:
1. **Caricamento dati appuntamenti reali**
- Esteso `DashboardSnapshot` con `appointments: BackendAppointment[]`.
- Aggiunta chiamata `listAppuntamenti()` nel `Promise.all` del caricamento dashboard.

2. **Nuovo calcolo KPI “appuntamenti futuri”**
- Inserite utility dedicate:
  - `parseTimeParts(...)` per validare/parsing orario `HH:mm` (o `HH:mm:ss`).
  - `toComparableStamp(...)` per ottenere un valore numerico confrontabile `YYYYMMDDHHmm`.
  - `getRomeNowComparableStamp(...)` per calcolare “adesso” nel timezone `Europe/Rome`.
  - `countUpcomingAppointments(...)` per conteggio finale.

3. **Regole di inclusione nel KPI**
Un appuntamento viene conteggiato se e solo se:
- stato in `{ in_attesa, confermato }`
- data valida (`data`/`appointment_date`)
- orario valido (`ora`/`appointment_time`)
- timestamp appuntamento `>=` timestamp corrente (Europe/Rome)

4. **Coerenza metrica trend della card**
- Il trend della card `APPOINTMENTS` è ora calcolato sul dominio appuntamenti (non più su fatture), usando:
  - corrente: `upcomingAppointmentsCount`
  - baseline: `totalAppointments - upcomingAppointmentsCount` (se presente)

5. **Tipizzazione TypeScript**
- Aggiunti tipi espliciti per eliminare implicit `any`:
  - `TimeParts`
  - `ComparableStampParts`
  - firme tipizzate per helper e conteggio.

## Criteri di accettazione soddisfatti
- Il KPI `APPOINTMENTS` non è più mock/statico.
- Riflette il numero reale di appuntamenti non ancora avvenuti.
- Esclude automaticamente appuntamenti passati, completati o annullati.
- Confronto temporale coerente con timezone operativa italiana (`Europe/Rome`).

## Verifiche eseguite
Eseguite in `frontend/`:
- `npm run lint -- src/app/dashboard/page.tsx` ✅
- `npx tsc --noEmit` ✅

## Rischi residui / note
- Il conteggio dipende dalla qualità dei dati `data`/`ora` restituiti dall’API; record con formato non valido vengono esclusi intenzionalmente.
- Se in futuro il backend introducesse timezone esplicite per singolo record, il confronto potrà essere allineato a timestamp ISO completi.
