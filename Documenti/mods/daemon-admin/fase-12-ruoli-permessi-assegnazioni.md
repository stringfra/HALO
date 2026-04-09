# DAEMON FASE 12 - RUOLI, PERMESSI E ASSEGNAZIONI HALO

## Obiettivo

Completare la governance RBAC tenant dal perimetro `daemon`, mantenendo compatibilita con il modello legacy `users.ruolo`.

## Interventi applicati

### Backend

- aggiunti gli endpoint:
  - `POST /api/daemon/tenants/:tenantId/roles`
  - `PUT /api/daemon/tenants/:tenantId/roles/:roleId`
  - `PUT /api/daemon/tenants/:tenantId/users/:userId/roles`
- estesi i payload read:
  - utenti tenant con `assigned_roles`
  - ruoli tenant con `assigned_users_count`
  - catalogo permessi disponibile come `permission_catalog`
- introdotte regole esplicite:
  - i ruoli di sistema `ADMIN`, `DENTISTA`, `SEGRETARIO` vengono garantiti sul tenant
  - i ruoli di sistema non sono modificabili da console daemon
  - ogni utente deve mantenere esattamente un ruolo di sistema assegnato
  - `users.ruolo` viene sincronizzato con il ruolo di sistema selezionato
  - l'ultimo `ADMIN` del tenant non puo' essere rimosso o declassato

### Coerenza modello

Il progetto usa ancora il campo legacy `users.ruolo` per varie parti del gestionale e per il routing frontend tenant.

Per evitare inconsistenze:

- le assegnazioni complete restano in `user_roles`
- il ruolo di sistema primario viene sempre rispecchiato anche in `users.ruolo`
- creazione utente e cambio ruolo legacy aggiornano anche `user_roles`

### Frontend

- estese le API daemon per:
  - creazione ruolo custom
  - update ruolo custom
  - update assegnazioni utente-ruolo
- aggiornata la console `/daemon/console` con:
  - form creazione ruolo custom
  - editor permessi per ruolo
  - protezione visuale dei ruoli di sistema
  - editor assegnazioni ruolo direttamente nella card utente

## Eventi audit

- `daemon.tenant_role.created`
- `daemon.tenant_role.updated`
- `daemon.tenant_role.permissions_updated`
- `daemon.tenant_user.roles_updated`

Tutti gli eventi vengono scritti sia su `platform_audit_logs` sia su `tenant_audit_logs`.

## File principali

- `backend/src/routes/daemon.routes.js`
- `backend/src/services/daemon-console.service.js`
- `frontend/src/features/daemon-console/api.ts`
- `frontend/src/app/daemon/console/page.tsx`

## Output ottenuto

- ruoli custom e permessi tenant sono governabili da console `daemon`
- le assegnazioni utente-ruolo sono aggiornabili dal perimetro `daemon`
- il tenant mantiene un RBAC coerente con il modello legacy gia in produzione

## Limite intenzionale

Questa fase non introduce ancora un pannello tenant standard che sfrutti in modo completo i ruoli custom lato UI applicativa. La governance completa e' disponibile dal perimetro `daemon`, mentre il tenant continua a convivere con il modello legacy gia presente.
