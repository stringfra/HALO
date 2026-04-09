# FASE 7 — QA guard test dashboard

Data: 2026-04-06
Stato: Completata

## Obiettivo
Bloccare regressioni sulle funzionalita dashboard implementate nelle fasi precedenti:
- intervallo grafico reale
- granularita reale
- KPI appuntamenti futuri reali
- persistenza URL dei filtri
- aggiornamento temporale periodico del KPI

## Ambito
- Frontend test suite (`node:test`)
- Nessuna modifica runtime backend

## File aggiunto
- `frontend/tests/dashboard-functional-guards.test.js`

## Copertura introdotta
1. API stats: verifica mapping query params `date_from`, `date_to`, `granularity`.
2. KPI appuntamenti: verifica regole strutturali su stati ammessi (`in_attesa`, `confermato`) e confronto su tempo futuro.
3. Temporal refresh: verifica presenza refresh periodico (`setInterval`, `setTimeTick`, `30_000`).
4. URL sync: verifica sincronizzazione stato dashboard con querystring (`range`, `from/to`, `granularity`, `router.replace`).
5. Fallback sicurezza: verifica fallback a `30d` per URL custom incompleta.

## Note implementative
- Test in stile snapshot-guard su sorgente (regex), coerenti con il setup test gia presente nel progetto.
- Aggiunto `eslint-disable` locale per `require()` nei test JS, in linea con i test esistenti.

## Verifiche eseguite
Eseguite in `frontend/`:
- `npm run lint -- tests/dashboard-functional-guards.test.js` ✅
- `npm test` ✅ (10/10 pass)

## Esito
- Regressioni critiche dashboard ora presidiate da test automatici lightweight.
