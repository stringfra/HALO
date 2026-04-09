# ESTENSIONI DAEMON FASE 5 - API DOPPIA NOMENCLATURA HALO

## Obiettivo

Far arrivare al frontend daemon sia il codice tecnico sia il nome semplice per feature e permessi.

## Implementazione applicata

In `backend/src/services/daemon-console.service.js`:

- `feature_catalog` non restituisce piu' solo stringhe
- ora restituisce oggetti strutturati con:
  - `technical_key`
  - `simple_name`
  - `kind`

Esempio:

```json
{
  "technical_key": "agenda.enabled",
  "simple_name": "Agenda",
  "kind": "feature"
}
```

### Ruoli e permessi

Sempre nello stesso servizio:

- `permission_catalog` ora restituisce entry leggibili strutturate
- ogni ruolo mantiene `permissions` tecniche
- ogni ruolo espone anche `permissions_readable`

Esempio:

```json
{
  "technical_key": "appointments.read",
  "simple_name": "Leggere appuntamenti",
  "kind": "tenant_permission"
}
```

## Compatibilita mantenuta

Per ridurre regressioni:

- `resolved_feature_flags` resta indicizzato per chiave tecnica
- `roles[].permissions` resta disponibile come array tecnico
- la UI puo' migrare gradualmente usando i nuovi campi leggibili

## Tipizzazione frontend aggiornata

In `frontend/src/features/daemon-console/api.ts`:

- `feature_catalog` tipizzato come array strutturato
- `permission_catalog` tipizzato come array strutturato
- `roles[].permissions_readable` aggiunto

## File toccati

- `backend/src/services/daemon-console.service.js`
- `frontend/src/features/daemon-console/api.ts`

## Output fase

- le API daemon trasportano ora sia la nomenclatura tecnica sia quella semplice
- la UI puo' essere aggiornata nella fase successiva senza bisogno di un secondo refactor backend
