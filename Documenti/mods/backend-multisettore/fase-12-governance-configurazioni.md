# Fase 12 - Governance Configurazioni Tenant HALO

Data: `03 Aprile 2026`
Ambito: `backend + database + admin governance`
Stato: `parzialmente completato`

## Obiettivo della fase

Introdurre un livello minimo ma reale di governance sulle configurazioni tenant, evitando che branding, settings e feature flags possano essere modificati senza validazione, tracciamento e versioning.

## Modifiche implementate

### Database

Aggiornato [database/schema.sql](/Users/francescostrano/Desktop/HALO/database/schema.sql) con:

- colonna `studi.settings_version`
- tabella `tenant_audit_logs`

Scopo:

- versionare ogni aggiornamento di configurazione tenant
- tracciare chi modifica cosa e quando

### Validazione configurazione tenant

Nuovo servizio:

- [backend/src/services/tenant-settings-validation.service.js](/Users/francescostrano/Desktop/HALO/backend/src/services/tenant-settings-validation.service.js)

Copertura iniziale:

- `product_name`
- `labels`
- `roles`
- `ui`
- `reminders`

Regole:

- `settings` deve essere un oggetto JSON valido
- chiavi non supportate vengono rifiutate
- label e campi testuali hanno vincoli minimi/massimi
- i ruoli vengono validati contro il set legacy supportato

### Audit log tenant

Nuovo servizio:

- [backend/src/services/tenant-audit-logs.service.js](/Users/francescostrano/Desktop/HALO/backend/src/services/tenant-audit-logs.service.js)

Eventi attualmente tracciati:

- `tenant.config.updated`
- `tenant.feature.updated`

### Endpoint admin protetti

Nuova route:

- [backend/src/routes/tenant-config.routes.js](/Users/francescostrano/Desktop/HALO/backend/src/routes/tenant-config.routes.js)

Montata in:

- [backend/src/server.js](/Users/francescostrano/Desktop/HALO/backend/src/server.js)

Endpoint disponibili:

- `GET /api/admin/tenant-config`
- `PUT /api/admin/tenant-config`
- `GET /api/admin/tenant-audit-logs`
- `GET /api/admin/tenant-features`
- `PUT /api/admin/tenant-features/:featureKey`

Protezione:

- autenticazione JWT
- permesso richiesto `settings.manage`

### Governance feature flags

Esteso:

- [backend/src/services/feature-flags.service.js](/Users/francescostrano/Desktop/HALO/backend/src/services/feature-flags.service.js)

Nuova funzione:

- `upsertTenantFeatureOverride(...)`

Scopo:

- aggiornare o creare override tenant su `tenant_features`
- mantenere audit coerente con il resto della governance

## Cosa risulta coperto

- configurazione tenant letta in forma amministrativa
- configurazione tenant aggiornata con validazione server-side
- incremento automatico `settings_version`
- audit log delle modifiche tenant
- lettura e modifica feature flags tenant in area admin protetta

## Cosa manca ancora per una chiusura totale della fase

### 1. UI amministrativa dedicata

Esistono gli endpoint backend, ma non ancora una schermata frontend per:

- aggiornare tenant config
- vedere audit log
- modificare feature flags da interfaccia

### 2. Schema di validazione piu profondo

L’attuale validazione e pragmatica ma non completa.

Possibili estensioni:

- validazione colori branding
- validazione locale/timezone con insiemi noti
- validazione piu dettagliata di `ui` e `reminders`
- eventuale JSON Schema esplicito versionato

### 3. Audit piu ricco

Oggi viene tracciato:

- tipo azione
- attore
- payload sintetico

Possibili estensioni:

- diff old/new completo
- IP o request id
- distinzione piu fine tra branding, labels, reminders, ruoli

## Esito sintetico

La fase 12 e oggi:

- `tecnicamente avviata in modo concreto`
- `sufficiente per governance backend di base`
- `non ancora completa sul piano prodotto/operativita`

## Prossimo passo consigliato

Se si vuole chiudere il coding principale:

- produrre un documento finale di stato
- decidere se costruire anche la UI admin per tenant governance oppure fermarsi alla sola infrastruttura backend
