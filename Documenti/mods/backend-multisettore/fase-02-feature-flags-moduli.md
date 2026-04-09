# Fase 2 - Feature Flags E Moduli Tenant HALO

Data: `03 Aprile 2026`
Ambito: `database + backend api`
Stato: `completato`

## Obiettivo chiuso in questa fase

Consentire al backend di attivare o disattivare moduli per tenant, risolvere i default dal vertical e pubblicare un bootstrap iniziale per il client.

## Modifiche eseguite

Schema aggiornato in [schema.sql](/Users/francescostrano/Desktop/HALO/database/schema.sql):

- nuova tabella `tenant_features`
- supporto `config_json`
- timestamp `created_at` e `updated_at`
- indici su `studio_id` e `feature_key`

Service aggiunto in [feature-flags.service.js](/Users/francescostrano/Desktop/HALO/backend/src/services/feature-flags.service.js):

- merge `vertical defaults` + override tenant
- risoluzione `enabled_modules`
- costruzione payload bootstrap

Middleware aggiunto in [feature-flags.js](/Users/francescostrano/Desktop/HALO/backend/src/middleware/feature-flags.js):

- `requireFeature(featureKey)`

Endpoint aggiunto in [bootstrap.routes.js](/Users/francescostrano/Desktop/HALO/backend/src/routes/bootstrap.routes.js):

- `GET /api/bootstrap`

## Guardie modulo applicate

- `clients.enabled` su route pazienti
- `agenda.enabled` su route appuntamenti
- `billing.enabled` su route fatture
- `payments.stripe.enabled` su link Stripe e reconcile Stripe
- `inventory.enabled` su route prodotti
- `reports.enabled` su route statistiche
- `automation.enabled` su route automazioni

## Output disponibile ora

Il backend puo gia restituire:

- tenant
- current user
- enabled modules
- feature flags
- labels
- ruoli legacy esposti come configurazione tenant
- navigation logica filtrata per feature e permission legacy

## Nota tecnica

Il frontend non e ancora stato migrato a usare `GET /api/bootstrap`. In questa fase il backend espone pero gia il contratto necessario per farlo nella fase successiva.
