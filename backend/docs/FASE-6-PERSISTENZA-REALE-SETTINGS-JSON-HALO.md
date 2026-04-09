# Fase 6: Persistenza reale di `settings_json`

## Obiettivo

Correggere il punto strutturale che faceva apparire `settings_json` non persistente o instabile dopo aggiornamenti successivi e riletture del tenant.

## Diagnosi tecnica

Il problema principale non era solo il salvataggio SQL in senso stretto.

Il backend aggiornava `settings_json` con una logica di sostituzione totale:

- se arrivava un payload `settings` parziale;
- oppure un update specializzato come `activities.primary_rgb`;

parte della configurazione poteva essere persa o sovrascritta.

Questo produceva il sintomo percepito come:

- "salvo, ma poi al reload o al riavvio non ritrovo piu i valori"

perche il JSON persistito veniva progressivamente rimpiazzato invece che preservato.

## Interventi applicati

### 1. Nuovo servizio di merge controllato

E stato aggiunto:

- [tenant-settings.service.js](/Users/francescostrano/Desktop/HALO/backend/src/services/tenant-settings.service.js)

Espone:

- `normalizeTenantSettings(...)`
- `mergeTenantSettingsPatch(...)`

Regola applicata:

- i payload parziali non sostituiscono piu l'intero `settings_json`;
- le sezioni oggetto supportate (`labels`, `ui`, `reminders`, `activities`) vengono fuse;
- i campi non toccati restano persistiti.

### 2. Update tenant standard allineato al merge

In [tenant-config.routes.js](/Users/francescostrano/Desktop/HALO/backend/src/routes/tenant-config.routes.js):

- `PUT /tenant-config` ora costruisce `nextSettings` tramite merge controllato;
- la response include anche `raw_settings`, utile per rilettura coerente lato client.

### 3. Update daemon config allineato al merge

In [daemon.routes.js](/Users/francescostrano/Desktop/HALO/backend/src/routes/daemon.routes.js):

- `PUT /tenants/:tenantId/config` usa ora merge controllato;
- `PUT /tenants/:tenantId/activities/style` non costruisce piu un merge manuale fragile, ma usa la stessa logica centralizzata.

Questo evita che update parziali di stile o configurazione cancellino altre chiavi gia presenti in `settings_json`.

## Risultato della fase

Dopo questa fase:

- `settings_json` viene preservato tra update successivi;
- un update parziale non elimina piu il resto della configurazione tenant;
- la console daemon e le route tenant lavorano con la stessa logica di persistenza;
- la percezione di "settings che spariscono al riavvio" viene eliminata nel flusso applicativo supportato.

## Limiti della verifica

Ho tentato anche un controllo diretto via `psql` sul DB reale, ma l'ambiente locale non ha fornito credenziali utilizzabili senza prompt password.

Quindi la chiusura della fase si basa su:

- ispezione del flusso di update/rilettura;
- fix strutturale del merge;
- test automatici dedicati.

## Verifiche eseguite

- `node -c src/services/tenant-settings.service.js`
- `node -c src/routes/tenant-config.routes.js`
- `node -c src/routes/daemon.routes.js`
- `node -c tests/tenant-settings.test.js`
- `npm test`

Esito: tutto verde.
