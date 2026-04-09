# Creazione Tenant Daemon Fase 6

Data: `04 Aprile 2026`
Stato: `completata`

## Obiettivo

Definire l'API daemon che esporra' il workflow di creazione tenant alla console amministrativa.

## Endpoint consigliato

Endpoint principale:

- `POST /api/daemon/tenants`

Motivo:

- e' coerente con il tenant registry gia' esistente
- mantiene il flusso dentro il dominio `daemon`
- permette in futuro di aggiungere anche read/list/create nello stesso namespace logico

## Posizionamento architetturale

La route deve vivere nel perimetro:

- `backend/src/routes/daemon.routes.js`

La route non deve contenere la logica orchestrata di creazione, ma limitarsi a:

- validare il payload esterno
- verificare autorizzazione e conferma scrittura
- chiamare il servizio applicativo di creazione tenant
- tradurre il risultato in risposta HTTP

## Protezioni obbligatorie

La route deve essere protetta da:

- `requireDaemon`
- `requireDaemonAccessPolicy`
- `requireDaemonPermission("platform.tenants.write")`
- `requireDaemonWriteConfirmation(...)`

## Azione di conferma scrittura consigliata

Per coerenza con il resto dell'area daemon, la route deve richiedere:

- `X-Daemon-Confirm`
- `X-Daemon-Reason`

Decisione consigliata:

- usare una action key dedicata alla creazione tenant, ad esempio `daemon.tenant.created`

## Payload di request consigliato

Forma minima:

```json
{
  "code": "studio-roma-centro",
  "tenant_name": "Studio Roma Centro",
  "display_name": "Roma Centro",
  "business_name": "Studio Dentistico Roma Centro",
  "vertical_key": "dental",
  "locale": "it-IT",
  "timezone": "Europe/Rome",
  "admin": {
    "name": "Mario Rossi",
    "email": "admin@studioromacentro.it",
    "password": "PasswordTemporaneaMoltoForte123!"
  }
}
```

## Regole del payload

Il payload deve essere chiuso.

Chiavi consentite al top level:

- `code`
- `tenant_name`
- `display_name`
- `business_name`
- `vertical_key`
- `locale`
- `timezone`
- `admin`

Chiavi consentite dentro `admin`:

- `name`
- `email`
- `password`

Non devono essere accettati:

- `settings_json` libero
- `feature_overrides`
- `branding`
- `custom_fields`
- `users_extra`

almeno non nella prima versione.

## Risposta di successo consigliata

Status code consigliato:

- `201 Created`

Forma minima della risposta:

```json
{
  "message": "Tenant creato da daemon.",
  "tenant": {
    "id": 42,
    "code": "studio-roma-centro",
    "tenant_name": "Studio Roma Centro",
    "display_name": "Roma Centro",
    "business_name": "Studio Dentistico Roma Centro",
    "vertical_key": "dental",
    "vertical_name": "Studio dentistico",
    "locale": "it-IT",
    "timezone": "Europe/Rome",
    "is_active": true
  },
  "admin_user": {
    "id": 120,
    "name": "Mario Rossi",
    "email": "admin@studioromacentro.it",
    "role": "ADMIN"
  },
  "bootstrap_summary": {
    "settings_version": 1,
    "system_roles_created": 3,
    "feature_overrides_created": 0
  }
}
```

## Comportamento HTTP consigliato

### `201 Created`

Da usare quando:

- tenant creato correttamente
- admin iniziale creato correttamente
- bootstrap minimo completato

### `400 Bad Request`

Da usare quando:

- payload non valido
- campi mancanti
- vertical non valido
- password non conforme

Forma consigliata:

```json
{
  "message": "Payload creazione tenant non valido.",
  "validation_errors": [
    {
      "path": "code",
      "message": "Deve essere uno slug univoco di 3-80 caratteri."
    }
  ]
}
```

### `409 Conflict`

Da usare quando:

- `code` tenant gia' esistente
- email admin gia' in conflitto nel contesto previsto

Messaggi consigliati:

- `Tenant code gia in uso.`
- `Email admin gia in uso.`

### `500 Internal Server Error`

Da usare quando:

- fallisce il servizio orchestrato per errore non previsto
- fallisce la transazione
- falliscono dipendenze critiche non gestibili come errore utente

Messaggio consigliato:

- `Errore nella creazione tenant da daemon.`

## Relazione con la lista tenant

La nuova route `POST /api/daemon/tenants` deve essere pensata come complementare alla route gia' esistente:

- `GET /api/daemon/tenants`

Flusso atteso:

1. `daemon` crea il tenant
2. la risposta ritorna il tenant appena creato
3. il tenant e' subito visibile nella lista tenant

## Relazione con il bootstrap tenant

La risposta della route non deve limitarsi a confermare l'insert.

La route deve rispondere solo dopo che il tenant e':

- leggibile dal config service
- pronto per bootstrap tenant
- dotato di admin iniziale operativo

## Schema di implementazione consigliato nella route

Struttura logica consigliata:

1. validazione chiavi consentite
2. validazione formale payload
3. chiamata a `createTenantFromDaemon(...)`
4. traduzione errori noti in `400` o `409`
5. risposta `201` con payload strutturato

## Decisioni prese in questa fase

- endpoint dedicato `POST /api/daemon/tenants`
- protezione con `platform.tenants.write`
- conferma scrittura obbligatoria
- payload iniziale stretto
- risposta `201` strutturata
- route sottile, orchestrazione nel service layer

## Output prodotto

- specifica dell'endpoint
- payload request formale
- payload response formale
- regole HTTP consigliate
- standard di protezione e conferma

## Prossimo passo

La fase successiva e':

- `Fase 7. Audit e tracciabilita' della creazione tenant`
