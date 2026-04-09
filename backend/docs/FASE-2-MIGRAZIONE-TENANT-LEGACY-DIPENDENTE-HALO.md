# Fase 2: Migrazione e compatibilita tenant legacy

## Obiettivo

Gestire il passaggio dei tenant legacy dal modello:

- `ADMIN`
- `SEGRETARIO`
- `DENTISTA`

al nuovo modello:

- `ADMIN`
- `SEGRETARIO`
- `DIPENDENTE`

senza perdere assegnazioni utente, ruoli di sistema o coerenza RBAC.

## Interventi applicati

### 1. Migrazione controllata tenant-per-tenant da daemon

In [daemon-admin-tools.service.js](/Users/francescostrano/Desktop/HALO/backend/src/services/daemon-admin-tools.service.js) e stata aggiunta la funzione:

- `migrateTenantLegacyPractitionerRole(tenantId)`

La migrazione esegue:

- abilitazione del valore enum `DIPENDENTE` su `ruolo_utente` se mancante;
- aggiornamento di `studi.settings_json.roles` al set target;
- conversione del ruolo di sistema legacy `DENTISTA` in `DIPENDENTE`;
- merge controllato se nello stesso tenant esistono gia sia `DENTISTA` sia `DIPENDENTE`;
- aggiornamento di `users.ruolo` da `DENTISTA` a `DIPENDENTE`;
- repair RBAC finale per riallineare `user_roles` e ruoli di sistema.

### 2. Endpoint daemon dedicato alla migrazione

In [daemon.routes.js](/Users/francescostrano/Desktop/HALO/backend/src/routes/daemon.routes.js) e stato aggiunto:

- `POST /api/daemon/support/tenants/:tenantId/migrate-legacy-practitioner-role`

L'endpoint:

- richiede permesso `platform.roles.write`;
- richiede conferma esplicita daemon;
- scrive audit platform e tenant;
- restituisce summary migrazione + summary repair.

### 3. Audit e classificazione evento

In [daemon-event-catalog.js](/Users/francescostrano/Desktop/HALO/backend/src/config/daemon-event-catalog.js) e stato aggiunto l'evento:

- `daemon.support.tenant_legacy_practitioner_role_migrated`

Classificazione:

- `type = write_reversible`
- `severity = critical`

### 4. Compatibilita schema database

In [schema.sql](/Users/francescostrano/Desktop/HALO/database/schema.sql) il tipo enum `ruolo_utente` ora supporta anche:

- `DIPENDENTE`

senza rimuovere ancora `DENTISTA`, cosi i tenant legacy restano leggibili fino alla migrazione.

### 5. Script SQL di backfill

E stato aggiunto lo script:

- [rbac_legacy_dentista_to_dipendente.sql](/Users/francescostrano/Desktop/HALO/database/rbac_legacy_dentista_to_dipendente.sql)

Lo script esegue un backfill globale che:

- aggiunge `DIPENDENTE` all'enum se assente;
- aggiorna `settings_json.roles`;
- converte o fonde i ruoli di sistema legacy;
- aggiorna `users.ruolo`;
- rigenera le assegnazioni `user_roles` di sistema;
- riallinea i permessi del set target.

## Risultato della fase

Dopo questa fase:

- i tenant legacy hanno un percorso di migrazione esplicito e controllato;
- il database puo rappresentare `DIPENDENTE` anche su installazioni esistenti;
- il sistema non dipende piu da un refactor manuale dei singoli record;
- la migrazione puo essere auditata e ripetuta tenant per tenant dal daemon.

## Strategia operativa consigliata

Ordine consigliato:

1. eseguire audit tenant legacy;
2. migrare un tenant di test con l'endpoint daemon;
3. verificare utenti, ruoli e dropdown;
4. estendere la migrazione agli altri tenant;
5. usare lo script SQL solo per backfill amministrativi controllati.

## Limiti intenzionali della fase

Questa fase non completa ancora:

- aggiornamento dei vertical template e delle label esposte;
- rimozione di `DENTISTA` dalle UI e dai menu a tendina;
- riallineamento definitivo del bootstrap frontend;
- fix della persistenza `settings_json`.

Questi punti restano nelle fasi successive.

## Verifiche eseguite

- `node -c src/services/daemon-admin-tools.service.js`
- `node -c src/routes/daemon.routes.js`
- `node -c src/config/daemon-event-catalog.js`
- `node -c tests/daemon-hardening.test.js`
- `npm test`

Esito: tutto verde.
