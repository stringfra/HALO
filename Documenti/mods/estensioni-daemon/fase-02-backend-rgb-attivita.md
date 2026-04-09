# ESTENSIONI DAEMON FASE 2 - BACKEND RGB ATTIVITA HALO

## Obiettivo

Permettere a `daemon` di leggere e modificare il colore principale dell'attivita via RGB.

## Scelta applicata

Il dato continua a vivere dentro:

- `settings.activities.primary_rgb`

ma viene esposto tramite route daemon dedicate per evitare ambiguita con il config editor generico.

## Route introdotte

In `backend/src/routes/daemon.routes.js`:

- `GET /api/daemon/tenants/:tenantId/activities/style`
- `PUT /api/daemon/tenants/:tenantId/activities/style`

## Regole lato backend

### Read

La route di lettura:

- carica il tenant tramite `getTenantConfigForDaemon`
- restituisce `primary_rgb`
- audit evento:
  - `daemon.activity_style.read`

### Write

La route di scrittura:

- richiede `platform.tenant_config.write`
- richiede `requireDaemonWriteConfirmation(...)`
- accetta solo:

```json
{
  "primary_rgb": {
    "r": 15,
    "g": 118,
    "b": 110
  }
}
```

- valida `r/g/b` come interi `0..255`
- persiste in `settings_json.activities.primary_rgb`
- incrementa `settings_version`
- audit eventi:
  - `daemon.activity_style.updated`

Scrive su:

- `tenant_audit_logs`
- `platform_audit_logs`

## Catalogo eventi

In `backend/src/config/daemon-event-catalog.js` sono stati aggiunti:

- `daemon.activity_style.read`
- `daemon.activity_style.updated`

## Tipizzazione frontend

In `frontend/src/features/daemon-console/api.ts`:

- esteso `DaemonTenantConfig` con `activity_style`
- aggiunto tipo `DaemonTenantActivityStyle`
- aggiunte API:
  - `getDaemonTenantActivityStyle`
  - `updateDaemonTenantActivityStyle`

Queste API servono alla fase successiva di integrazione UI daemon.

## File toccati

- `backend/src/routes/daemon.routes.js`
- `backend/src/config/daemon-event-catalog.js`
- `frontend/src/features/daemon-console/api.ts`

## Output fase

- il backend daemon supporta la lettura e scrittura del colore attivita via RGB
- il dato resta coerente con il tenant config model definito nella Fase 1
- la superficie API e' pronta per la futura UI di modifica
