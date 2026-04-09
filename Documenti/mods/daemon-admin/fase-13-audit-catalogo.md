# DAEMON FASE 13 - CATALOGO EVENTI E AUDIT ESTESO HALO

## Obiettivo

Rendere sistematico e difendibile l'audit della superficie `daemon`, introducendo:

- catalogo centralizzato eventi
- classificazione per rischio
- copertura omogenea delle letture sensibili
- visualizzazione frontend con severita e filtri

## Interventi applicati

### Catalogo centralizzato

Creato il file:

- `backend/src/config/daemon-event-catalog.js`

Il catalogo definisce per ogni `action_key`:

- `type`
  - `read_sensitive`
  - `write_reversible`
  - `write_irreversible`
  - `security_event`
- `severity`
  - `low`
  - `medium`
  - `high`
  - `critical`
- `reversible`
- `description`

E' stato introdotto anche un fallback controllato per gli eventi non ancora classificati formalmente.

### Backend audit esteso

In `backend/src/routes/daemon.routes.js` sono stati aggiunti audit read-only per endpoint critici:

- lettura config tenant
- lettura feature tenant
- lettura utenti tenant
- lettura ruoli tenant
- lettura custom fields tenant
- lettura audit unificato
- lettura diagnostics

In `backend/src/services/daemon-console.service.js` gli eventi audit restituiti dalla console daemon vengono ora arricchiti con la classificazione derivata dal catalogo ufficiale.

### API audit

`GET /api/daemon/audit` ora restituisce:

- `event_catalog`
- `events`

Ogni evento contiene anche:

- `audit_scope`
- `classification.type`
- `classification.severity`
- `classification.reversible`
- `classification.description`

### Frontend audit viewer

La console `/daemon/console` ora mostra:

- badge di scope evento
- badge di severita
- badge di categoria
- badge reversibile / irreversibile
- descrizione evento
- filtri client-side per:
  - scope
  - severita
  - tipo evento

## File principali

- `backend/src/config/daemon-event-catalog.js`
- `backend/src/routes/daemon.routes.js`
- `backend/src/services/daemon-console.service.js`
- `frontend/src/features/daemon-console/api.ts`
- `frontend/src/app/daemon/console/page.tsx`

## Output ottenuto

- ogni endpoint daemon critico ha ora un evento audit definito o classificato
- esiste una mappa ufficiale evento -> severita -> reversibilita
- la console daemon consente una lettura piu' chiara del rischio operativo degli eventi

## Nota tecnica

La classificazione e' attualmente centralizzata lato backend e consumata dalla UI. Questo evita che il frontend introduca interpretazioni divergenti sul rischio degli eventi.
