# Fase 3: Aggiornamento dei vertical template e delle label

## Obiettivo

Separare in modo esplicito:

- il ruolo tecnico di piattaforma `DIPENDENTE`
- dalla label visibile di verticale come `Dentista`, `Medico`, `Terapista`, `Operatore`, `Consulente`

senza reintrodurre `DENTISTA` come default universale.

## Interventi applicati

### 1. Catalogo statico vertical aggiornato

In [multi-sector.js](/Users/francescostrano/Desktop/HALO/backend/src/config/multi-sector.js) tutti i vertical statici ora espongono:

- `ADMIN`
- `SEGRETARIO`
- `DIPENDENTE`

al posto del vecchio set con `DENTISTA`.

### 2. Alias ruolo verticale lato backend

Sempre in [multi-sector.js](/Users/francescostrano/Desktop/HALO/backend/src/config/multi-sector.js) e stata introdotta la funzione:

- `getRoleDisplayAlias(role, { verticalKey, labels })`

Regola applicata:

- `ADMIN` resta `Admin`
- `SEGRETARIO` resta `Segretario`
- `DIPENDENTE` usa la label operativa del verticale:
  - dental -> `Dentista`
  - medical -> `Medico`
  - physiotherapy -> `Terapista`
  - aesthetics/services -> `Operatore`
  - consulting -> `Consulente`

Per compatibilita, anche `DENTISTA` legacy usa lo stesso alias verticale quando necessario.

### 3. Bootstrap pronto per alias di verticale

In [feature-flags.service.js](/Users/francescostrano/Desktop/HALO/backend/src/services/feature-flags.service.js):

- `current_user.role_alias` non usa piu solo l'alias statico legacy;
- viene ora risolto con il contesto del tenant;
- e stato aggiunto `role_catalog` nel bootstrap, con:
  - `role_key`
  - `role_alias`
  - `legacy_role_alias`

Questo prepara le fasi successive sui dropdown frontend.

### 4. Seed schema dei vertical template aggiornato

In [schema.sql](/Users/francescostrano/Desktop/HALO/database/schema.sql) i `default_roles_json` dei vertical template sono stati aggiornati a:

- `["ADMIN","SEGRETARIO","DIPENDENTE"]`

### 5. Script di riallineamento template persistiti

E stato aggiunto:

- [vertical_templates_default_roles_dipendente.sql](/Users/francescostrano/Desktop/HALO/database/vertical_templates_default_roles_dipendente.sql)

Serve per riallineare i `vertical_templates` gia presenti nel database senza dover ricreare lo schema.

## Risultato della fase

Dopo questa fase:

- il backend platform non usa piu `DENTISTA` come default universale nei template verticali;
- il lessico specifico del verticale resta disponibile come alias esposto;
- il bootstrap puo gia fornire al frontend un catalogo ruoli con nome tecnico + nome visibile.

## Limiti intenzionali della fase

Questa fase non completa ancora:

- aggiornamento dei dropdown e selettori frontend;
- rimozione delle stringhe legacy hardcoded nella UI;
- revisione completa del bootstrap consumato dal frontend;
- fix della persistenza `settings_json`.

Questi punti restano nelle fasi successive.

## Verifiche eseguite

- `node -c src/config/multi-sector.js`
- `node -c src/services/feature-flags.service.js`
- `node -c tests/multi-sector.test.js`
- `npm test`

Esito: tutto verde.
