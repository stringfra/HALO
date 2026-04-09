# FASE 3 - ASSEGNAZIONE CORRETTA DEI RUOLI CUSTOM AGLI UTENTI TENANT HALO

Data: `05 Aprile 2026`
Ambito: `create user + assigned roles coherence`
Stato: `completata`

## Obiettivo chiuso in questa fase

Chiudere il flusso utenti end-to-end in modo che:

- il ruolo di sistema resti obbligatorio;
- i ruoli custom siano assegnabili correttamente agli utenti tenant;
- la creazione utente supporti da subito i ruoli custom iniziali;
- backend e frontend rispettino lo stesso modello.

## Gap individuato

Prima di questa fase:

- la form `Crea utente tenant` permetteva solo di scegliere il ruolo di sistema;
- i ruoli custom non erano selezionabili in creazione utente;
- il backend `POST /tenants/:tenantId/users` non accettava assegnazioni iniziali;
- i ruoli custom potevano essere aggiunti solo dopo, con un flusso separato.

Questo rendeva incompleto il caso d'uso:

- creare direttamente un `DENTISTA` con uno o piu' ruoli custom gia' assegnati.

## Interventi applicati

### Backend

In [daemon.routes.js](/Users/francescostrano/Desktop/HALO/backend/src/routes/daemon.routes.js):

- il create utente accetta ora anche `role_ids`;
- `role_ids` viene validato come array di ruoli appartenenti al tenant;
- il backend garantisce comunque un solo ruolo di sistema coerente con `ruolo`;
- se `role_ids` contiene piu' ruoli di sistema o un ruolo di sistema diverso dal `ruolo` base, la request viene rifiutata;
- i ruoli custom iniziali vengono assegnati insieme al ruolo di sistema;
- l'audit di creazione utente include anche `assigned_role_ids`.

### Frontend

In [page.tsx](/Users/francescostrano/Desktop/HALO/frontend/src/app/daemon/console/page.tsx):

- la form `Crea utente tenant` include ora `Ruoli custom iniziali`;
- vengono mostrati i ruoli custom disponibili del tenant;
- il ruolo di sistema continua a essere gestito dal dropdown dedicato;
- i ruoli custom vengono inviati al backend come `role_ids`.

In [api.ts](/Users/francescostrano/Desktop/HALO/frontend/src/features/daemon-console/api.ts):

- il contratto `createDaemonTenantUser(...)` supporta ora `role_ids`.

## Effetto ottenuto

Con questa fase:

- posso creare un utente tenant con ruolo base `ADMIN`, `DENTISTA` o `SEGRETARIO`;
- posso aggiungere da subito ruoli custom iniziali;
- il backend mantiene la coerenza tra `users.ruolo` e `user_roles`;
- il tenant non entra in uno stato ambiguo durante la creazione utente.

## Criteri di accettazione coperti

- un utente puo' essere creato con un ruolo di sistema e uno o piu' ruoli custom;
- i ruoli custom iniziali devono appartenere al tenant selezionato;
- non e' possibile creare un utente senza ruolo di sistema valido;
- non e' possibile creare un utente con un set iniziale incoerente di ruoli di sistema.

## Nota per la fase successiva

La fase 3 completa la coerenza funzionale sugli utenti tenant.  
La fase 4 spostera' il blocco `Ruoli e permessi` fuori dalla vista principale, dentro un bottone `Gestisci`, lasciando piu' spazio alla sezione utenti tenant.
