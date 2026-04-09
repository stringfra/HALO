# DAEMON FASE 4 BACKEND CONSOLE HALO

Data: `03 Aprile 2026`
Stato: `completata`

## Obiettivo della fase

Esporre il backend minimo della console `daemon` tramite endpoint dedicati e protetti.

## Endpoint introdotti

Namespace:

- `/api/daemon/...`

Endpoint attivi in questa fase:

- `GET /api/daemon/overview`
- `GET /api/daemon/tenants`
- `GET /api/daemon/tenants/:tenantId/config`
- `PUT /api/daemon/tenants/:tenantId/config`
- `GET /api/daemon/tenants/:tenantId/features`
- `PUT /api/daemon/tenants/:tenantId/features/:featureKey`
- `GET /api/daemon/tenants/:tenantId/users`
- `GET /api/daemon/tenants/:tenantId/roles`
- `GET /api/daemon/tenants/:tenantId/custom-fields/:entityKey`
- `GET /api/daemon/audit`
- `GET /api/daemon/diagnostics`

## Protezione applicata

Ogni endpoint passa da:

- `requireDaemon`
- `requireDaemonPermission(...)`

Permessi usati:

- `platform.dashboard.read`
- `platform.tenants.read`
- `platform.tenant_config.read`
- `platform.tenant_config.write`
- `platform.tenant_features.read`
- `platform.tenant_features.write`
- `platform.users.read`
- `platform.roles.read`
- `platform.custom_fields.read`
- `platform.audit.read`
- `platform.diagnostics.read`

## Criterio di adattamento al progetto

La console backend daemon non duplica il dominio gia presente. Riusa i servizi esistenti di:

- tenant config
- feature flags
- custom fields
- validazione settings
- audit tenant

In questo modo la governance daemon opera sugli stessi invarianti del backend tenant-driven.

## Stato raggiunto

Con questa fase il backend della console daemon e gia interrogabile e consente:

- overview di piattaforma
- elenco tenant
- lettura e scrittura config tenant
- lettura e scrittura feature tenant
- lettura utenti tenant
- lettura ruoli e permessi tenant
- lettura custom fields tenant
- lettura audit log cross-tenant
- diagnostica tecnica minima dell'ambiente

## Limiti deliberati di questa fase

Non sono ancora stati esposti:

- editor frontend completo
- workflow distruttivi
- scrittura ruoli tenant da console daemon
- scrittura utenti tenant da console daemon
- audit di piattaforma dedicato separato dal tenant audit

Questi aspetti restano demandati alle fasi successive.
