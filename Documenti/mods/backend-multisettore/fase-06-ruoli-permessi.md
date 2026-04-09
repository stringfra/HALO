# Fase 6 - Ruoli E Permessi Non Legati Al Settore HALO

Data: `03 Aprile 2026`
Ambito: `database + auth + route guards`
Stato: `completato`

## Obiettivo chiuso in questa fase

Separare autorizzazione e terminologia dentistica introducendo permission key persistenti e un modello ruoli/permessi tenant-aware, mantenendo i ruoli legacy per compatibilita.

## Modifiche eseguite

In [schema.sql](/Users/francescostrano/Desktop/HALO/database/schema.sql) ho aggiunto:

- `roles`
- `role_permissions`
- `user_roles`

Con seed e backfill iniziali per i ruoli legacy:

- `ADMIN`
- `DENTISTA`
- `SEGRETARIO`

Service aggiunto in [permissions.service.js](/Users/francescostrano/Desktop/HALO/backend/src/services/permissions.service.js):

- risoluzione permessi effettivi per utente
- fallback ai permessi legacy se le nuove tabelle non sono ancora migrate nel DB reale

Middleware aggiornato in [authMiddleware.js](/Users/francescostrano/Desktop/HALO/backend/middlewares/authMiddleware.js):

- nuovo `requirePermission(permissionKey)`

## Route convertite a permission key

- pazienti -> `clients.read` / `clients.write`
- appuntamenti -> `appointments.read` / `appointments.write`
- fatture -> `billing.read` / `billing.write`
- utenti -> `users.read` / `users.write`
- statistiche -> `reports.read`
- prodotti -> `inventory.read` + `inventory.write`

## Compatibilita

`authorize(...)` resta disponibile ma non e piu il meccanismo principale sulle route core migrate.

Il bootstrap tenant ora espone i permessi reali risolti per l'utente, non solo il mapping statico del ruolo legacy.
