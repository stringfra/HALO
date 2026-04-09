# Fase 4: Hardening del contratto RBAC utenti

## Obiettivo

Ridurre il rischio di nuove divergenze tra:

- flusso utenti standard tenant;
- flusso utenti daemon;
- ruolo base `users.ruolo`;
- assegnazioni `user_roles`.

## Problema affrontato

Prima di questa fase, il sistema aveva ancora logica duplicata in piu punti:

- create/update utente standard;
- create/update utente daemon;
- sync del ruolo di sistema;
- controlli sull'ultimo `ADMIN`.

Anche se il comportamento era stato corretto, la duplicazione aumentava il rischio di regressioni future.

## Interventi applicati

### 1. Nuovo servizio applicativo centralizzato

E stato aggiunto:

- [tenant-user-management.service.js](/Users/francescostrano/Desktop/HALO/backend/src/services/tenant-user-management.service.js)

Il servizio centralizza:

- `countTenantAdmins(...)`
- `resolveTenantUserAssignmentIds(...)`
- `createTenantUser(...)`
- `updateTenantUserProfile(...)`

Questo rende il contratto utente/RBAC piu esplicito e riusabile.

### 2. Flusso standard riallineato al servizio unico

In [users.routes.js](/Users/francescostrano/Desktop/HALO/backend/src/routes/users.routes.js):

- la creazione utente usa ora `createTenantUser(...)`;
- l'update usa `updateTenantUserProfile(...)`;
- il route handler non contiene piu logica RBAC distribuita.

### 3. Flusso daemon riallineato allo stesso servizio

In [daemon.routes.js](/Users/francescostrano/Desktop/HALO/backend/src/routes/daemon.routes.js):

- la creazione utente tenant usa `createTenantUser(...)`;
- l'update utente tenant usa `updateTenantUserProfile(...)`;
- il daemon continua a mantenere separata la route esplicita per i custom roles.

## Verifica fase

La fase e accompagnata da test dedicati in:

- [tenant-user-management.test.js](/Users/francescostrano/Desktop/HALO/backend/tests/tenant-user-management.test.js)

Copertura minima aggiunta:

- composizione corretta system role + custom roles in create;
- blocco della demotion dell'ultimo `ADMIN`.

## Criteri di accettazione

- esiste un solo punto applicativo autorevole per create/update del ruolo base utente tenant;
- il daemon e il flusso standard non implementano piu localmente la sync RBAC primaria;
- il rischio di regressione da duplicazione logica si riduce in modo sostanziale.
