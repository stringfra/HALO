# EX-15 - Smoke Test Finale Completo

Data esecuzione: 2026-04-01  
Ambiente test: backend locale su porta `4021`, frontend lint locale

## Risultato globale
- Totale test smoke API: `36`
- Pass: `36`
- Fail: `0`

## Copertura verificata

1. Auth
- login `ADMIN`, `SEGRETARIO`, `DENTISTA`
- refresh token (admin)
- logout per tutti i ruoli

2. RBAC endpoint
- `/api/users`:
  - `ADMIN` -> `200`
  - `SEGRETARIO`/`DENTISTA` -> `403`
- `/stats/guadagni`:
  - `ADMIN` -> `200`
  - `SEGRETARIO`/`DENTISTA` -> `403`

3. Flussi dominio principali
- `pazienti`:
  - create admin/segretario -> `201`
  - create dentista -> `403`
  - list tutti i ruoli -> `200`
- `appuntamenti`:
  - list tutti i ruoli -> `200`
  - create segretario -> `201`
  - create dentista -> `403`
- `fatture`:
  - list admin/segretario -> `200`
  - list dentista -> `403`
  - create segretario -> `201`
  - create dentista -> `403`
- `prodotti` (magazzino):
  - list/create admin -> `200/201`
  - list/create segretario o dentista -> `403`

4. Users management
- create utenti ruolo `SEGRETARIO` e `DENTISTA` via admin -> `201`

## Verifiche complementari
- Frontend `npm run lint` -> OK
- Cleanup dati smoke:
  - utenti temporanei residui: `0`
  - pazienti temporanei residui: `0`
  - prodotti temporanei residui: `0`

## Conclusione
- Flussi principali auth/RBAC/dominio risultano stabili in smoke test.
- Nessuna regressione bloccante rilevata.

## Limiti del passaggio
- Test UI browser manuale non incluso in questo passaggio (test eseguiti via API + lint frontend).
