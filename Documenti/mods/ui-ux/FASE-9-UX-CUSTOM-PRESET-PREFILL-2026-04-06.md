# FASE 9 — UX custom preset prefill

Data: 2026-04-06
Stato: Completata

## Obiettivo
Evitare errore immediato quando l'utente passa a `Custom` senza aver ancora compilato entrambe le date.

## Problema
Prima del fix:
- click su `Custom` con `from/to` vuote
- range non valido immediato
- comparsa errore prima ancora della compilazione guidata

## Soluzione implementata
File modificati:
- `frontend/src/app/dashboard/page.tsx`
- `frontend/tests/dashboard-functional-guards.test.js`

Intervento:
1. introdotto handler `handlePresetSelection(preset)`
2. quando `preset === custom`:
   - se `from` assente: `from = requestedRange.fromIso`
   - se `to` assente: `to = requestedRange.toIso`
3. aggiornato onClick dei pulsanti preset per usare il nuovo handler

## Risultato
- passaggio a `Custom` fluido
- date precompilate con range corrente
- nessun errore prematuro durante l'interazione

## Verifiche eseguite
Eseguite in `frontend/`:
- `npm run lint -- src/app/dashboard/page.tsx tests/dashboard-functional-guards.test.js` ✅
- `npm test` ✅ (`11/11` pass)

## Note
- la validazione custom rimane attiva per casi realmente incoerenti (es. `from > to`).
