# DAEMON FASE 11 - GESTIONE COMPLETA UTENTI TENANT HALO

## Obiettivo

Chiudere il gap sulla gestione scrivibile degli utenti tenant dal perimetro `daemon`, senza passare dalla UI tenant standard.

## Interventi applicati

### Backend

- aggiunti gli endpoint:
  - `POST /api/daemon/tenants/:tenantId/users`
  - `PUT /api/daemon/tenants/:tenantId/users/:userId`
  - `DELETE /api/daemon/tenants/:tenantId/users/:userId`
- tutte le scritture passano da:
  - `requireDaemonPermission("platform.users.write")`
  - `requireDaemonWriteConfirmation(...)`
- validazioni introdotte:
  - whitelist campi payload
  - email valida
  - password forte
  - ruoli legacy ammessi: `ADMIN`, `DENTISTA`, `SEGRETARIO`
- protezione esplicita:
  - impossibile rimuovere o declassare l'ultimo `ADMIN` del tenant
- audit introdotto su doppio canale:
  - `platform_audit_logs`
  - `tenant_audit_logs`

### Eventi audit

- `daemon.tenant_user.created`
- `daemon.tenant_user.updated`
- `daemon.tenant_user.deleted`
- `daemon.tenant_user.password_reset`

### Frontend

- estese le API daemon con create, update e delete utenti tenant
- aggiornata la console `/daemon/console` con:
  - form creazione utente
  - editor inline nome/email/ruolo
  - reset password dedicato
  - eliminazione utente con conferma esplicita

## File principali

- `backend/src/routes/daemon.routes.js`
- `frontend/src/features/daemon-console/api.ts`
- `frontend/src/app/daemon/console/page.tsx`

## Output ottenuto

- un tenant e' amministrabile lato utenti direttamente dalla console `daemon`
- tutte le scritture utenti sono confermate lato server e auditabili
- il reset password tenant e' separato e tracciato come evento specifico

## Limite volutamente lasciato fuori fase

La gestione avanzata di ruoli custom, permessi granulari e assegnazioni utente-ruolo resta nella Fase 12.
