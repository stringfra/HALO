# Fase 5 - Vertical Defaults E Profili Di Configurazione HALO

Data: `03 Aprile 2026`
Ambito: `database + backend services`
Stato: `completato`

## Obiettivo chiuso in questa fase

Introdurre un catalogo `vertical_templates` persistente e usare i suoi default per risolvere configurazione tenant, labels, ruoli e feature flags.

## Modifiche eseguite

In [schema.sql](/Users/francescostrano/Desktop/HALO/database/schema.sql) ho aggiunto:

- tabella `vertical_templates`
- campi JSON per settings, labels, features e ruoli
- seed iniziale per:
  - `dental`
  - `medical`
  - `physiotherapy`
  - `aesthetics`
  - `consulting`
  - `services`

Service nuovo in [vertical-templates.service.js](/Users/francescostrano/Desktop/HALO/backend/src/services/vertical-templates.service.js):

- lettura del template da database
- fallback al catalogo statico se il DB non e ancora migrato

Service aggiornati:

- [tenant-config.service.js](/Users/francescostrano/Desktop/HALO/backend/src/services/tenant-config.service.js)
- [feature-flags.service.js](/Users/francescostrano/Desktop/HALO/backend/src/services/feature-flags.service.js)

## Logica finale di risoluzione

Configurazione tenant risolta ora come:

1. default core
2. vertical template
3. override tenant specifico

Questo vale per:

- settings
- labels
- feature flags
- ruoli esposti al bootstrap

## Nota tecnica

Durante la transizione resta disponibile anche il fallback al catalogo statico in `multi-sector.js`, cosi il backend non dipende in modo fragile dall'applicazione immediata della migrazione SQL.
