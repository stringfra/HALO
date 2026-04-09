# FASE 10 — Trend revenue su finestra precedente equivalente

Data: 2026-04-06
Stato: Completata

## Obiettivo
Rendere il trend `REVENUE` realmente significativo confrontando:
- ricavi finestra corrente (intervallo attivo)
- ricavi finestra precedente di uguale durata

## Problema risolto
Il calcolo precedente usava una logica basata su serie che, nello stato attuale, poteva non produrre una baseline reale utile.

## Implementazione tecnica
File modificati:
- `frontend/src/app/dashboard/page.tsx`
- `frontend/tests/dashboard-functional-guards.test.js`

### 1) Nuova utility di aggregazione
Aggiunta `sumPaidInvoicesInRange(invoices, fromDate, toDate)`:
- include solo fatture `pagata`
- filtra per data nel range inclusivo
- somma gli importi

### 2) Calcolo corrente / precedente
Nel componente dashboard:
1. `currentWindowRevenue`
   - usa `snapshot.stats.totale` se disponibile
   - fallback: somma fatture pagate nel range richiesto
2. `rangeDays`
   - calcolato con `diffDaysInclusive`
3. `previousRangeEnd`
   - giorno prima di `requestedRange.fromDate`
4. `previousRangeStart`
   - retrocede di `rangeDays - 1`
5. `previousWindowRevenue`
   - somma fatture pagate nella finestra precedente equivalente

### 3) Coerenza visualizzazione revenue
- KPI `REVENUE` ora mostra `currentWindowRevenue`
- headline blocco grafico `REVENUE` usa `currentWindowRevenue` senza fallback improprio a totale storico

## Risultato funzionale
- Trend revenue coerente con l'intervallo selezionato dall'utente.
- Confronto storico allineato a una baseline temporale equivalente.
- Migliore leggibilita decisionale della metrica.

## Verifiche eseguite
Eseguite in `frontend/`:
- `npm run lint -- src/app/dashboard/page.tsx tests/dashboard-functional-guards.test.js` ✅
- `npm test` ✅ (`12/12` pass)
- `npx tsc --noEmit` ✅
