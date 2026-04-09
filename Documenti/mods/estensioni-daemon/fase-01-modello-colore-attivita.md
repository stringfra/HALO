# ESTENSIONI DAEMON FASE 1 - MODELLO COLORE ATTIVITA HALO

## Obiettivo

Definire in modo ufficiale dove vive il colore principale dell'attivita e come il progetto lo espone.

## Decisione applicata

Per HALO il colore principale dell'attivita viene modellato dentro la configurazione tenant:

- `settings.activities.primary_rgb`

Formato ufficiale:

```json
{
  "activities": {
    "primary_rgb": {
      "r": 15,
      "g": 118,
      "b": 110
    }
  }
}
```

## Validazione introdotta

In `backend/src/services/tenant-settings-validation.service.js`:

- `activities` e' ora una chiave supportata in `settings`
- `primary_rgb` deve essere un oggetto
- `r`, `g`, `b` devono essere interi tra `0` e `255`
- canali extra non sono ammessi

## Risoluzione config tenant

In `backend/src/services/tenant-config.service.js`:

- introdotto `DEFAULT_ACTIVITY_STYLE`
- introdotta normalizzazione del valore RGB
- il tenant config ora espone:

- `activity_style.primary_rgb`

Questo consente alle fasi successive di:

- leggere il colore in modo consistente
- applicarlo all'agenda tenant
- governarlo dalla console `daemon`

## Tipizzazione frontend

In `frontend/src/features/bootstrap/api.ts`:

- aggiunto il tipo opzionale `tenant.activity_style.primary_rgb`

## File toccati

- `backend/src/services/tenant-settings-validation.service.js`
- `backend/src/services/tenant-config.service.js`
- `frontend/src/features/bootstrap/api.ts`

## Output fase

- esiste una sorgente dati ufficiale per il colore attivita
- il formato RGB e' validato lato backend
- il payload tenant espone un punto di lettura coerente per le fasi successive
