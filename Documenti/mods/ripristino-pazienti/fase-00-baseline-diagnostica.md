# Fase 0 - Baseline diagnostica ripristino pazienti/appuntamenti

## Obiettivo fase

Stabilire una baseline tecnica verificabile dei failure correnti su:

- assegnazione dottore in creazione paziente
- creazione appuntamento

senza modificare codice e senza introdurre fix.

## Ambito osservato

- backend:
  - [pazienti.routes.js](/Users/francescostrano/Desktop/HALO/backend/src/routes/pazienti.routes.js)
  - [appuntamenti.routes.js](/Users/francescostrano/Desktop/HALO/backend/src/routes/appuntamenti.routes.js)
  - [authMiddleware.js](/Users/francescostrano/Desktop/HALO/backend/middlewares/authMiddleware.js)
  - [permissions.service.js](/Users/francescostrano/Desktop/HALO/backend/src/services/permissions.service.js)
- frontend:
  - [pazienti-manager.tsx](/Users/francescostrano/Desktop/HALO/frontend/src/features/pazienti/pazienti-manager.tsx)
  - [pazienti/api.ts](/Users/francescostrano/Desktop/HALO/frontend/src/features/pazienti/api.ts)
  - [agenda/agenda-calendar.tsx](/Users/francescostrano/Desktop/HALO/frontend/src/features/agenda/agenda-calendar.tsx)
  - [agenda/api.ts](/Users/francescostrano/Desktop/HALO/frontend/src/features/agenda/api.ts)

## Matrice errori endpoint -> causa tecnica

### 1. `POST /api/v2/clients` (creazione paziente)

Messaggi applicativi possibili:

- `medico_id non valido.` ([pazienti.routes.js:182](/Users/francescostrano/Desktop/HALO/backend/src/routes/pazienti.routes.js:182))
- `Il dottore selezionato non esiste o non appartiene allo studio.` ([pazienti.routes.js:202](/Users/francescostrano/Desktop/HALO/backend/src/routes/pazienti.routes.js:202))
- `Errore nella creazione paziente.` ([pazienti.routes.js:219](/Users/francescostrano/Desktop/HALO/backend/src/routes/pazienti.routes.js:219))

Cause tecniche compatibili:

- payload senza `owner_user_id/medico_id` valido
- `medico_id` riferito a utente non presente nel tenant
- utente selezionato con ruolo diverso da `DENTISTA` o `DIPENDENTE` (query filtro su `users.ruolo`)
- errore SQL sottostante intercettato nel `catch` (messaggio generico lato UI)

### 2. `POST /api/v2/appointments` (creazione appuntamento)

Messaggi applicativi possibili:

- `Il paziente selezionato non esiste.` ([appuntamenti.routes.js:147](/Users/francescostrano/Desktop/HALO/backend/src/routes/appuntamenti.routes.js:147))
- `Il paziente selezionato non ha un dottore assegnato.` ([appuntamenti.routes.js:155](/Users/francescostrano/Desktop/HALO/backend/src/routes/appuntamenti.routes.js:155))
- `Errore nella creazione appuntamento.` ([appuntamenti.routes.js:183](/Users/francescostrano/Desktop/HALO/backend/src/routes/appuntamenti.routes.js:183))

Cause tecniche compatibili:

- `paziente_id` inesistente
- paziente con `medico_id` nullo/non valido
- mismatch su ruolo medico (`DENTISTA`/`DIPENDENTE`) nella join utente
- errore SQL sottostante intercettato nel `catch` (messaggio generico lato UI)

### 3. `403 Accesso negato: permesso non autorizzato`

Origine:

- [authMiddleware.js:214](/Users/francescostrano/Desktop/HALO/backend/middlewares/authMiddleware.js:214)

Note:

- i permessi vengono risolti live dal DB via [permissions.service.js:43](/Users/francescostrano/Desktop/HALO/backend/src/services/permissions.service.js:43)
- se RBAC tenant e ruoli utente non sono coerenti, i flussi `clients.write`/`appointments.write` possono essere bloccati

## Verifica payload frontend

### Creazione paziente

Il frontend invia `owner_user_id` (mappato a `medico_id` backend):

- [pazienti/api.ts:76](/Users/francescostrano/Desktop/HALO/frontend/src/features/pazienti/api.ts:76)

### Creazione appuntamento

Il frontend invia `client_id`, `appointment_date`, `appointment_time`:

- [agenda/api.ts:73](/Users/francescostrano/Desktop/HALO/frontend/src/features/agenda/api.ts:73)

Pre-check UI:

- blocca create se il paziente selezionato non ha medico assegnato:
  - [agenda-calendar.tsx:276](/Users/francescostrano/Desktop/HALO/frontend/src/features/agenda/agenda-calendar.tsx:276)

## Ipotesi tecnica primaria (priorita alta)

Possibile mismatch dati/schema post-refactor ruoli:

- query backend su practitioner richiedono `DENTISTA` o `DIPENDENTE`
- se DB/tenant reali non sono pienamente allineati (enum, ruoli, assegnazioni), i flussi falliscono con errori generici in `catch`

## Gap di osservabilita fase 0

- nell'ambiente corrente non e configurata `DATABASE_URL`, quindi non e stato possibile validare direttamente il DB runtime del tenant reale
- mancano log runtime del backend del tuo ambiente (stack trace/`error.detail`) per classificazione finale causa-effetto su ogni caso

## Esito fase

Fase 0 completata a livello di baseline codice + mappa failure.

Per uscita piena della fase in ambiente reale, servono:

1. stack trace backend dei tentativi falliti su `POST /api/v2/clients` e `POST /api/v2/appointments`
2. verifica SQL runtime su tenant reale (ruoli utente, assegnazioni medico, coerenza RBAC)
