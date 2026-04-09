# FASE 2 - CREAZIONE E VISIBILITA RUOLI CUSTOM DAEMON HALO

Data: `05 Aprile 2026`
Ambito: `create/list/refresh ruoli tenant in console daemon`
Stato: `completata`

## Obiettivo chiuso in questa fase

Stabilizzare il flusso:

1. creo un ruolo custom da daemon;
2. ricevo una response coerente;
3. vedo subito il ruolo nel tenant corretto;
4. dopo refresh continuo a vedere il ruolo nel tenant corretto.

## Gap individuati

### Gap 1. Response create/update non allineata alla list

La route `GET /api/daemon/tenants/:tenantId/roles` restituiva ogni ruolo con:

- `permissions`
- `permissions_readable`

Le route:

- `POST /api/daemon/tenants/:tenantId/roles`
- `PUT /api/daemon/tenants/:tenantId/roles/:roleId`

restituivano invece un payload `role` incompleto, senza `permissions_readable`.

Questo rendeva incoerente il contratto API tra create/update e list.

### Gap 2. Visibilita' poco esplicita in UI

Anche con tenant selezionato persistente, la console non esplicitava abbastanza:

- in quale tenant si stava creando il ruolo;
- quale ruolo fosse appena stato creato;
- quale card della lista corrispondesse al ruolo appena generato.

## Interventi applicati

### Backend

In [daemon.routes.js](/Users/francescostrano/Desktop/HALO/backend/src/routes/daemon.routes.js):

- ho allineato `serializeDaemonRole(...)` al payload della list;
- ora anche i ruoli restituiti da create/update includono `permissions_readable`.

Effetto:

- `GET /roles`, `POST /roles` e `PUT /roles/:roleId` usano ora lo stesso shape logico per `role`.

### Frontend

In [page.tsx](/Users/francescostrano/Desktop/HALO/frontend/src/app/daemon/console/page.tsx):

- mantengo il tenant selezionato anche dopo refresh;
- dopo creazione ruolo salvo `highlightedRoleId`;
- mostro una notice piu' esplicita con:
  - tenant attivo;
  - display name del ruolo;
  - `role_key`;
- evidenzio la card del ruolo appena creato;
- espongo il tenant attivo anche nella sezione ruoli e permessi.

## Effetto ottenuto

Con questa fase il flusso `create -> view -> refresh` e' piu' affidabile e leggibile:

- il ruolo custom viene creato nel tenant corretto;
- il payload create/update e' coerente con la list;
- la UI rende evidente il tenant attivo;
- il ruolo appena creato viene immediatamente identificato nella lista.

## Criteri di accettazione coperti

- il ruolo creato e' visibile subito nella lista;
- il tenant attivo e' esplicito nella UI;
- la response backend del ruolo e' coerente tra list e create/update;
- dopo refresh il tenant corretto resta selezionato e il ruolo resta visibile.

## Nota per la fase successiva

La fase 2 migliora la visibilita' del ruolo custom, ma non chiude ancora il flusso di assegnazione utente end-to-end.  
La fase 3 si concentra su creazione utente e assegnazione corretta dei ruoli custom mantenendo un solo ruolo di sistema.
