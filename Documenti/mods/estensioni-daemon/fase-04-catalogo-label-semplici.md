# ESTENSIONI DAEMON FASE 4 - CATALOGO LABEL SEMPLICI HALO

## Obiettivo

Creare una fonte centralizzata dei nomi semplici per:

- feature tenant
- permessi tenant
- permessi piattaforma daemon

senza ancora modificare i payload API o la UI.

## Implementazione applicata

Creato il file:

- `backend/src/config/daemon-readable-catalog.js`

Il catalogo contiene tre mapping distinti:

- `FEATURE_SIMPLE_NAMES`
- `TENANT_PERMISSION_SIMPLE_NAMES`
- `PLATFORM_PERMISSION_SIMPLE_NAMES`

## Esempi reali inclusi

Feature:

- `agenda.enabled` -> `Agenda`
- `billing.enabled` -> `Fatture`
- `custom_fields.enabled` -> `Campi personalizzati`

Permessi tenant:

- `appointments.read` -> `Leggere appuntamenti`
- `appointments.write` -> `Gestire appuntamenti`
- `users.write` -> `Gestire utenti`

Permessi piattaforma:

- `platform.audit.read` -> `Leggere log`
- `platform.tenant_config.write` -> `Gestire configurazione tenant`
- `platform.roles.write` -> `Gestire ruoli tenant`

## Helper introdotti

Nel catalogo sono stati aggiunti anche helper per produrre entry strutturate:

- `getReadableFeatureEntry(...)`
- `getReadableTenantPermissionEntry(...)`
- `getReadablePlatformPermissionEntry(...)`

Ogni helper restituisce:

- `technical_key`
- `simple_name`
- `kind`

## Scopo della fase

Questa fase prepara la base per le successive:

- estensione dei payload daemon
- rendering frontend con doppia lettura
- futura leggibilita della dashboard daemon

## File toccati

- `backend/src/config/daemon-readable-catalog.js`

## Output fase

- esiste una fonte unica e centralizzata dei nomi semplici
- il progetto non deve piu' duplicare mapping leggibili in piu componenti o route
