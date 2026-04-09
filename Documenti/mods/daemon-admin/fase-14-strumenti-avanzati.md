# DAEMON FASE 14 - STRUMENTI AMMINISTRATIVI AVANZATI HALO

## Obiettivo

Introdurre un primo set di strumenti tecnici reali per supporto e manutenzione amministrativa, mantenendo il perimetro `daemon` separato dal gestionale tenant standard.

## Interventi applicati

### 1. Supporto tecnico RBAC multi-tenant

Creato il servizio:

- `backend/src/services/daemon-admin-tools.service.js`

Funzioni introdotte:

- snapshot salute RBAC multi-tenant
- report di consistenza RBAC per singolo tenant
- repair controllato e transazionale della consistenza RBAC tenant

Il repair esegue:

- garanzia presenza ruoli di sistema `ADMIN`, `DENTISTA`, `SEGRETARIO`
- riallineamento permessi dei ruoli di sistema
- ricostruzione coerente delle assegnazioni sistema in `user_roles`
- riallineamento del campo legacy `users.ruolo`
- normalizzazione dei casi con nessun ruolo di sistema o piu' ruoli di sistema

### 2. Nuove route daemon di supporto

In `backend/src/routes/daemon.routes.js` sono stati aggiunti:

- `GET /api/daemon/support/rbac-health`
- `GET /api/daemon/support/tenants/:tenantId/rbac-consistency`
- `POST /api/daemon/support/tenants/:tenantId/repair-rbac`

Vincoli applicati:

- letture protette da `platform.diagnostics.read`
- repair protetto da `platform.roles.write`
- repair protetto anche da `requireDaemonWriteConfirmation(...)`
- audit su `platform_audit_logs` e `tenant_audit_logs`

### 3. Audit eventi supporto

Catalogo eventi esteso in:

- `backend/src/config/daemon-event-catalog.js`

Eventi introdotti:

- `daemon.support.rbac_health.read`
- `daemon.support.tenant_rbac_consistency.read`
- `daemon.support.tenant_rbac_repaired`

### 4. Console frontend supporto tecnico

Aggiornata:

- `frontend/src/app/daemon/console/page.tsx`

Con:

- overview dei tenant con anomalie RBAC
- dettaglio consistenza RBAC del tenant selezionato
- elenco utenti incoerenti
- azione `Repair RBAC tenant` con conferma forte

API frontend aggiunte in:

- `frontend/src/features/daemon-console/api.ts`

### 5. Cambio credenziali daemon: username al posto di email

Il login `daemon` ora usa:

- `username`
- `password`

e non piu' l'email come input operativo.

File aggiornati:

- `backend/controllers/daemonAuthController.js`
- `backend/src/services/daemon-mfa.service.js`
- `frontend/src/features/daemon-auth/api.ts`
- `frontend/src/app/daemon/login/page.tsx`

Dettagli:

- lookup account `daemon` tramite `platform_accounts.account_key`
- email mantenuta solo come metadato tecnico interno
- bootstrap `.env` con:
  - `DAEMON_BOOTSTRAP_USERNAME`
  - `DAEMON_BOOTSTRAP_PASSWORD`

Aggiornati:

- `backend/scripts/bootstrap-daemon.js`
- `backend/.env`
- `backend/.env.example`

Il bootstrap ora genera automaticamente una email tecnica interna nel formato:

- `<username>@daemon.local`

cosi' non serve piu' fornire o ricordare una email per l'accesso `daemon`.

## File principali

- `backend/src/services/daemon-admin-tools.service.js`
- `backend/src/routes/daemon.routes.js`
- `backend/src/config/daemon-event-catalog.js`
- `backend/controllers/daemonAuthController.js`
- `backend/src/services/daemon-mfa.service.js`
- `backend/scripts/bootstrap-daemon.js`
- `frontend/src/app/daemon/console/page.tsx`
- `frontend/src/app/daemon/login/page.tsx`
- `frontend/src/features/daemon-console/api.ts`
- `frontend/src/features/daemon-auth/api.ts`

## Output ottenuto

- esiste un primo modulo tecnico reale per supporto e manutenzione RBAC
- il tenant selezionato puo' essere ispezionato e corretto dal perimetro `daemon`
- il login `daemon` e' piu' coerente con una identita di piattaforma: `username + password`
- le credenziali bootstrapabili sono ora configurabili via `.env` senza dipendere dall'email
