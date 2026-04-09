# Fase 1: Refactor backend dei ruoli di sistema default

## Obiettivo

Introdurre sul backend il nuovo set default per le nuove attivita:

- `ADMIN`
- `SEGRETARIO`
- `DIPENDENTE`

senza rompere immediatamente i tenant legacy che usano ancora `DENTISTA`.

## Interventi applicati

### 1. Nuovo set default per nuove attivita

In [src/config/multi-sector.js](/Users/francescostrano/Desktop/HALO/backend/src/config/multi-sector.js) e stato introdotto:

- `NEW_ACTIVITY_DEFAULT_SYSTEM_ROLES = ["ADMIN", "SEGRETARIO", "DIPENDENTE"]`

Inoltre `DIPENDENTE` e stato aggiunto ai permessi legacy di sistema con lo stesso profilo operativo oggi usato da `DENTISTA`.

### 2. Bootstrap tenant guidato da `settings_json.roles`

In [src/services/daemon-tenant-creation.service.js](/Users/francescostrano/Desktop/HALO/backend/src/services/daemon-tenant-creation.service.js) le nuove attivita create dal daemon salvano ora in `settings_json.roles`:

- `ADMIN`
- `SEGRETARIO`
- `DIPENDENTE`

Questo rende il tenant esplicito rispetto ai propri ruoli di sistema default.

### 3. Generazione ruoli di sistema tenant-aware

In:

- [src/routes/daemon.routes.js](/Users/francescostrano/Desktop/HALO/backend/src/routes/daemon.routes.js)
- [src/services/daemon-admin-tools.service.js](/Users/francescostrano/Desktop/HALO/backend/src/services/daemon-admin-tools.service.js)

la creazione/verifica dei ruoli di sistema non usa piu un set globale hardcoded, ma legge prima `studi.settings_json.roles` del tenant.

Regola applicata:

- se il tenant ha `settings_json.roles`, quelli sono i ruoli di sistema attesi;
- se non li ha, il fallback e `NEW_ACTIVITY_DEFAULT_SYSTEM_ROLES`.

### 4. Accettazione server-side del nuovo ruolo `DIPENDENTE`

Il backend ora accetta `DIPENDENTE` nei punti critici di validazione e parsing:

- [src/services/auth-context.service.js](/Users/francescostrano/Desktop/HALO/backend/src/services/auth-context.service.js)
- [src/services/tenant-settings-validation.service.js](/Users/francescostrano/Desktop/HALO/backend/src/services/tenant-settings-validation.service.js)
- [src/routes/users.routes.js](/Users/francescostrano/Desktop/HALO/backend/src/routes/users.routes.js)
- [src/routes/daemon.routes.js](/Users/francescostrano/Desktop/HALO/backend/src/routes/daemon.routes.js)

### 5. Compatibilita operativa transitoria per i flussi legacy

Per evitare regressioni immediate, i flussi che trattavano `DENTISTA` come ruolo operativo esclusivo ora riconoscono anche `DIPENDENTE`:

- [src/routes/pazienti.routes.js](/Users/francescostrano/Desktop/HALO/backend/src/routes/pazienti.routes.js)
- [src/routes/appuntamenti.routes.js](/Users/francescostrano/Desktop/HALO/backend/src/routes/appuntamenti.routes.js)

Questo vale sia per:

- filtri ruolo sulle viste;
- lookup dell'operatore assegnato;
- comportamento pratico del ruolo nei moduli pazienti/appuntamenti.

## Risultato della fase

Dopo questa fase:

- le nuove attivita hanno un backend pronto a usare `DIPENDENTE` come ruolo di sistema default;
- il bootstrap ruoli dipende dal tenant e non da un universale hardcoded;
- `DIPENDENTE` non viene scartato dal backend;
- i tenant legacy con `DENTISTA` continuano a funzionare.

## Limiti intenzionali della fase

Questa fase non completa ancora:

- migrazione dei tenant legacy da `DENTISTA` a `DIPENDENTE`;
- aggiornamento di template verticali, label e dropdown frontend;
- rimozione definitiva di `DENTISTA` dal lessico esposto in UI;
- fix della persistenza `settings_json`.

Questi punti sono demandati alle fasi successive del piano.

## Verifiche eseguite

- `node -c src/routes/users.routes.js`
- `node -c src/routes/pazienti.routes.js`
- `node -c src/routes/appuntamenti.routes.js`
- `node -c src/routes/daemon.routes.js`
- `node -c src/services/daemon-admin-tools.service.js`
- `node -c src/services/daemon-tenant-creation.service.js`
- `npm test`

Esito: tutto verde.
