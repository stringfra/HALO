# DAEMON FASE 3 ACCESSO SICUREZZA HALO

Data: `03 Aprile 2026`
Stato: `completata`

## Obiettivo della fase

Separare l'accesso `daemon` dal flusso tenant standard a livello di:

- route frontend
- route backend
- sessione locale
- middleware di protezione

## Scelte applicate

### Frontend

Sono stati introdotti entrypoint dedicati:

- `/daemon`
- `/daemon/login`
- `/daemon/console`

La sessione `daemon` usa storage separato da quella tenant e non passa dalla UI operativa standard.

### Backend

Sono stati introdotti endpoint dedicati:

- `POST /api/daemon/login`
- `POST /api/daemon/refresh`
- `POST /api/daemon/logout`
- `GET /api/daemon/session`

Questi endpoint non riusano il login tenant.

### Middleware

E stata definita la separazione logica tra:

- `verifyToken` per `tenant_user`
- `requireDaemon` per identita `daemon`

Questa separazione impedisce che un token daemon venga accettato per errore sulle route tenant standard.

## Policy di protezione della fase

Le regole attive dopo questa fase sono:

- UI daemon separata dal gestionale
- sessione locale daemon separata
- refresh token daemon separati
- backend daemon sotto namespace dedicato
- route tenant che continuano ad accettare solo `tenant_user`

## Note operative

La console daemon completa non e ancora implementata in questa fase.

L'output ottenuto e il perimetro di accesso sicuro e separato necessario per costruire la console nelle fasi successive.
