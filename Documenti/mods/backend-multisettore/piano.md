# Piano Tecnico Multi-Settore HALO

## Obiettivo

Evolvere HALO da gestionale orientato allo studio dentistico a piattaforma utilizzabile da piu tipi di attivita, mantenendo la stessa struttura applicativa di base e demandando al backend la configurazione di:

- nome prodotto e nome tenant
- settore operativo
- moduli attivi/disattivi
- etichette e terminologia di dominio
- ruoli disponibili
- campi opzionali o obbligatori
- feature flag per funzionalita progressive

Il principio guida e: **un solo core applicativo, piu configurazioni di dominio**.

## Stato Attuale

Dalla codebase attuale emerge che il dominio dentistico e ancora incorporato in modo forte:

- schema DB con entita nominate `pazienti`, `appuntamenti`, `fatture`, `prodotti`
- enum ruoli con `ADMIN`, `DENTISTA`, `SEGRETARIO`
- logica backend che usa direttamente `DENTISTA` e campi come `medico_id`, `medico`
- copy e naming coerenti solo con studio dentistico
- routing API non ancora astratto per modulo o dominio

Riferimenti principali:

- [database/schema.sql](/Users/francescostrano/Desktop/HALO/database/schema.sql)
- [backend/src/server.js](/Users/francescostrano/Desktop/HALO/backend/src/server.js)
- [backend/controllers/authController.js](/Users/francescostrano/Desktop/HALO/backend/controllers/authController.js)
- [backend/middlewares/authMiddleware.js](/Users/francescostrano/Desktop/HALO/backend/middlewares/authMiddleware.js)
- [backend/src/routes/pazienti.routes.js](/Users/francescostrano/Desktop/HALO/backend/src/routes/pazienti.routes.js)
- [backend/src/routes/appuntamenti.routes.js](/Users/francescostrano/Desktop/HALO/backend/src/routes/appuntamenti.routes.js)

## Principio Architetturale

La trasformazione non va fatta duplicando il software per ogni settore. Va introdotto un livello di configurazione per `studio/tenant` che governa:

1. identita del tenant
2. vertical di appartenenza
3. moduli disponibili
4. vocabolario UI/API
5. permessi e ruoli
6. campi e regole business opzionali

Il frontend deve leggere questa configurazione da backend e adattare menu, etichette e schermate senza cambiare la base tecnica.

## Risultato Atteso

Lo stesso software deve poter servire, ad esempio:

- studio dentistico
- studio medico
- centro estetico
- studio fisioterapico
- consulenza professionale
- piccola attivita di servizi con agenda, clienti, fatture e magazzino

con differenze gestite da configurazione, non da fork del codice.

## Fase 0 - Definizione Del Modello Multi-Tenant E Multi-Vertical

### Obiettivo

Stabilire il modello concettuale unico che regola tenant, vertical, moduli e branding.

### Passaggi Tecnici

- introdurre il concetto di `vertical` come categoria di business del tenant
- distinguere tra:
  - `core entities`
  - `domain labels`
  - `feature modules`
- definire quali entita restano stabili nel core e quali diventano solo etichette

### Decisione Tecnica Consigliata

Mantenere nel core queste aree:

- anagrafiche clienti/contatti
- appuntamenti o slot agenda
- fatturazione e pagamenti
- inventario o stock
- utenti e permessi
- automazioni e reminder

Astrarre invece:

- nome delle entita
- ruoli operativi
- terminologia clinica o settoriale
- campi extra vertical-specific

### Deliverable

- matrice vertical -> moduli -> etichette -> ruoli
- catalogo feature flags
- mappa entita core vs entita di dominio

## Fase 1 - Configurazione Tenant E Branding Backend-Driven

### Obiettivo

Permettere a ogni tenant di definire identita, branding e comportamento base dal backend.

### Passaggi Tecnici

- estendere la tabella `studi` in [database/schema.sql](/Users/francescostrano/Desktop/HALO/database/schema.sql)
- rinominare concettualmente `studi` in tenant applicativo, anche se il nome tabella puo restare per compatibilita iniziale
- aggiungere campi configurabili:
  - `display_name`
  - `business_name`
  - `vertical_key`
  - `brand_logo_url`
  - `brand_primary_color`
  - `brand_secondary_color`
  - `default_locale`
  - `default_timezone`
  - `settings_json`

### Specifiche DB Consigliate

Nuovi campi su `studi`:

- `vertical_key VARCHAR(80) NOT NULL DEFAULT 'dental'`
- `display_name VARCHAR(120) NOT NULL`
- `settings_json JSONB NOT NULL DEFAULT '{}'::jsonb`
- `is_active BOOLEAN NOT NULL DEFAULT TRUE`

### Uso Di `settings_json`

Conservare configurazioni non critiche o evolutive come:

- testi custom
- opzioni UI
- impostazioni reminder
- naming entity
- comportamenti moduli

Non usare `settings_json` per dati transazionali core o relazioni critiche.

## Fase 2 - Feature Flags E Moduli Attivabili/Disattivabili

### Obiettivo

Consentire al backend di attivare o disattivare sezioni e funzionalita per tenant.

### Passaggi Tecnici

- creare tabella `tenant_features`
- associare ogni feature a uno `studio_id`
- supportare override per tenant rispetto al vertical di default

### Schema Consigliato

Tabella `tenant_features`:

- `id`
- `studio_id`
- `feature_key`
- `enabled`
- `config_json`
- `created_at`
- `updated_at`

### Feature Key Esempio

- `dashboard.enabled`
- `agenda.enabled`
- `clients.enabled`
- `billing.enabled`
- `payments.stripe.enabled`
- `inventory.enabled`
- `automation.enabled`
- `reports.enabled`
- `advanced_notes.enabled`
- `custom_fields.enabled`

### Regole Tecniche

- il backend deve esporre un endpoint unico di bootstrap tenant
- il frontend non deve hardcodare moduli disponibili
- ogni route backend sensibile deve verificare che il modulo sia attivo per il tenant

### Endpoint Consigliato

`GET /api/bootstrap`

Response minima:

- tenant
- current_user
- enabled_modules
- feature_flags
- labels
- roles
- navigation

## Fase 3 - Astrazione Del Vocabolario Di Dominio

### Obiettivo

Rimuovere i riferimenti hardcoded al solo settore dentistico senza rompere subito il database esistente.

### Passaggi Tecnici

- introdurre una mappa backend di label per vertical
- esporre alias semantici al frontend
- mantenere temporaneamente le tabelle legacy, ma smettere di propagare i nomi legacy nel client

### Esempio

Nel core:

- `pazienti` diventa concettualmente `clienti`
- `medico_id` diventa concettualmente `assignee_user_id` o `owner_user_id`
- `medico` diventa `assignee_label`

Per vertical:

- dental:
  - `clientSingular = Paziente`
  - `assigneeSingular = Dentista`
- physiotherapy:
  - `clientSingular = Paziente`
  - `assigneeSingular = Terapista`
- consulting:
  - `clientSingular = Cliente`
  - `assigneeSingular = Consulente`

### Strategia Tecnica

Prima fase:

- mantenere tabelle attuali
- introdurre DTO/API response neutrali
- introdurre traduzione semantica nel layer service

Seconda fase:

- migrare naming interno verso termini piu generici

## Fase 4 - Refactor Del Modello Dati Verso Entita Core

### Obiettivo

Portare il database da schema settoriale a schema core estendibile.

### Passaggi Tecnici

- introdurre nuove entita core con naming neutro
- migrare gradualmente le route a usare il nuovo modello
- mantenere compatibilita retroattiva durante la transizione

### Mapping Consigliato

- `pazienti` -> `contacts` o `clients`
- `medico_id` -> `owner_user_id`
- `appuntamenti` -> `appointments`
- `fatture` -> `invoices`
- `prodotti` -> `inventory_items`

### Strategia Di Migrazione

1. creare nuove viste o nuove tabelle compatibili
2. popolare i dati esistenti
3. aggiornare service e route
4. introdurre alias API
5. deprecare i nomi legacy

### Nota Pragmatica

Se si vuole ridurre rischio e tempo:

- lasciare per ora le tabelle legacy
- astrarre al livello service e response DTO
- rinviare il rename fisico delle tabelle a una fase successiva

## Fase 5 - Vertical Defaults E Profili Di Configurazione

### Obiettivo

Fornire profili standard per settore, poi personalizzabili per singolo tenant.

### Passaggi Tecnici

- creare catalogo `vertical_templates`
- definire un set iniziale di vertical supportati
- ogni vertical fornisce default per:
  - moduli attivi
  - labels
  - ruoli
  - campi custom
  - configurazioni reminder e documenti

### Struttura Consigliata

Tabella `vertical_templates`:

- `key`
- `name`
- `default_settings_json`
- `default_labels_json`
- `default_features_json`
- `default_roles_json`

### Logica Di Risoluzione

Configurazione finale tenant:

1. default core
2. override vertical template
3. override tenant specific

## Fase 6 - Ruoli E Permessi Non Legati Al Settore

### Obiettivo

Separare autorizzazione da terminologia dentistica.

### Stato Attuale

Il middleware usa ruoli fissi:

- `ADMIN`
- `DENTISTA`
- `SEGRETARIO`

### Passaggi Tecnici

- sostituire il modello rigido con:
  - ruoli tenant-specific
  - permission key standard
- introdurre tabelle:
  - `roles`
  - `role_permissions`
  - `user_roles`

### Permission Key Esempio

- `clients.read`
- `clients.write`
- `appointments.read`
- `appointments.write`
- `billing.read`
- `billing.write`
- `inventory.read`
- `inventory.write`
- `settings.manage`

### Strategia Di Transizione

Prima fase:

- mantenere i ruoli legacy
- mappare i ruoli legacy a permission key

Seconda fase:

- autorizzare le route per permission key, non per ruolo hardcoded

### Impatto Diretto

File da rifattorizzare:

- [backend/middlewares/authMiddleware.js](/Users/francescostrano/Desktop/HALO/backend/middlewares/authMiddleware.js)
- [backend/controllers/authController.js](/Users/francescostrano/Desktop/HALO/backend/controllers/authController.js)
- tutte le route che oggi invocano `authorize([...])`

## Fase 7 - Configurazione Moduli E Navigazione Dal Backend

### Obiettivo

Fare in modo che il frontend costruisca menu e sezioni in base al bootstrap backend.

### Passaggi Tecnici

- creare response `bootstrap` per il client
- includere:
  - tenant identity
  - ruoli/permessi utente
  - moduli attivi
  - voci menu disponibili
  - label entita
  - impostazioni visuali

### Response Esempio

```json
{
  "tenant": {
    "id": 1,
    "display_name": "HALO Med",
    "vertical_key": "medical"
  },
  "modules": {
    "agenda": true,
    "clients": true,
    "billing": true,
    "inventory": false
  },
  "labels": {
    "client_singular": "Paziente",
    "client_plural": "Pazienti",
    "owner_singular": "Medico",
    "owner_plural": "Medici"
  },
  "permissions": [
    "clients.read",
    "clients.write",
    "appointments.read"
  ],
  "navigation": [
    { "key": "dashboard", "label": "Dashboard", "href": "/dashboard" },
    { "key": "agenda", "label": "Agenda", "href": "/agenda" },
    { "key": "clients", "label": "Pazienti", "href": "/clienti" }
  ]
}
```

### Regola Chiave

Il frontend deve usare i `key` logici e non basarsi sul nome del settore.

## Fase 8 - Campi Custom E Metadati Di Dominio

### Obiettivo

Supportare differenze tra settori senza riscrivere lo schema per ogni vertical.

### Passaggi Tecnici

- introdurre `custom_field_definitions`
- introdurre `custom_field_values`
- associare i campi custom a entita core

### Esempio D'Uso

- dental:
  - numero cartella clinica
  - anamnesi
- aesthetics:
  - tipo trattamento
  - consenso
- consulting:
  - azienda
  - partita IVA

### Schema Consigliato

`custom_field_definitions`

- `id`
- `studio_id`
- `entity_key`
- `field_key`
- `label`
- `type`
- `required`
- `options_json`
- `sort_order`
- `active`

`custom_field_values`

- `id`
- `studio_id`
- `entity_key`
- `record_id`
- `field_key`
- `value_json`

### Vincoli

- non usare i custom fields per sostituire completamente il modello core
- usare i custom fields solo per estensioni settoriali o tenant-specific

## Fase 9 - Servizi Applicativi E Guardie Di Feature

### Obiettivo

Centralizzare le regole per tenant, feature e vertical evitando logica sparsa nelle route.

### Passaggi Tecnici

- introdurre un service layer dedicato:
  - `tenant-config.service`
  - `feature-flags.service`
  - `permissions.service`
  - `labels.service`
- ogni route deve leggere configurazione dal service, non da query ad hoc
- introdurre middleware come:
  - `requireFeature('billing.enabled')`
  - `requirePermission('clients.write')`

### Benefici

- meno hardcode
- piu testabilita
- comportamento uniforme
- minore rischio di bypass sulle feature disattivate

## Fase 10 - Compatibilita Retroattiva E Migrazione Progressiva

### Obiettivo

Evitare una riscrittura big-bang.

### Strategia

1. aggiungere configurazione tenant e feature flags
2. aggiungere endpoint bootstrap
3. spostare frontend a leggere configurazione backend
4. introdurre permission key
5. neutralizzare i nomi nel service layer
6. migrare gradualmente rotte e DTO
7. solo dopo valutare rename tabelle

### Compatibilita API

Durante la transizione:

- mantenere endpoint legacy attivi
- aggiungere nuove response shape neutre
- usare versionamento API se necessario:
  - `/api/v1/...` legacy
  - `/api/v2/...` neutral

## Fase 11 - QA Tecnico E Validazione Multi-Vertical

### Obiettivo

Verificare che lo stesso core funzioni davvero in piu configurazioni.

### Test Minimi

- tenant dental con tutti i moduli
- tenant medical senza magazzino
- tenant consulting senza agenda clinica e senza terminologia paziente
- tenant servizi con agenda + fatture + clienti

### Casi Da Validare

- login e bootstrap tenant
- menu dinamico
- route non accessibili se modulo disattivato
- permessi coerenti per ruolo
- labels corrette in API e UI
- custom fields caricati correttamente
- export/report senza naming hardcoded

## Fase 12 - Osservabilita E Governance Configurazioni

### Obiettivo

Gestire in sicurezza i tenant configurabili nel tempo.

### Passaggi Tecnici

- tracciare audit log su cambi configurazione tenant
- versionare `settings_json`
- validare le configurazioni con schema noto
- impedire configurazioni corrotte o incomplete

### Strumenti Consigliati

- JSON Schema o validazione server-side esplicita
- tabella audit per modifica feature e branding
- endpoint admin protetti per aggiornare configurazioni

## Modello Dati Minimo Consigliato

Tabelle nuove o evolute:

- `studi` estesa come tenant config
- `tenant_features`
- `vertical_templates`
- `roles`
- `role_permissions`
- `user_roles`
- `custom_field_definitions`
- `custom_field_values`
- `tenant_audit_logs`

## Priorita Tecniche Consigliate

### Sprint 1

- estensione `studi`
- tabella `tenant_features`
- endpoint `/api/bootstrap`
- lettura config tenant nel login/bootstrap

### Sprint 2

- mapping labels backend-driven
- menu dinamico frontend
- guardie `requireFeature`

### Sprint 3

- permission key e mapping ruoli legacy
- eliminazione hardcode `DENTISTA` e `SEGRETARIO` dalle autorizzazioni

### Sprint 4

- custom fields
- vertical templates
- primi tenant non-dental

### Sprint 5

- rifinitura DTO neutri
- deprecazione naming legacy
- test multi-vertical completi

## Interventi Immediati Sui File Attuali

### Database

Aggiornare [database/schema.sql](/Users/francescostrano/Desktop/HALO/database/schema.sql) per introdurre:

- config tenant
- feature flags
- ruoli e permessi piu flessibili
- struttura per custom fields

### Auth

Aggiornare [backend/controllers/authController.js](/Users/francescostrano/Desktop/HALO/backend/controllers/authController.js) per includere nel contesto sessione:

- tenant id
- vertical key
- permission set o bootstrap linkato

### Middleware

Aggiornare [backend/middlewares/authMiddleware.js](/Users/francescostrano/Desktop/HALO/backend/middlewares/authMiddleware.js) per:

- validare permission key
- non dipendere solo da enum ruolo legacy

### Route Di Dominio

Rifattorizzare progressivamente:

- [backend/src/routes/pazienti.routes.js](/Users/francescostrano/Desktop/HALO/backend/src/routes/pazienti.routes.js)
- [backend/src/routes/appuntamenti.routes.js](/Users/francescostrano/Desktop/HALO/backend/src/routes/appuntamenti.routes.js)

per spostare la logica da naming dentistico a naming neutro nel layer service.

## Rischi Da Evitare

- creare fork separati per ogni settore
- mettere tutta la logica in JSON non validato
- lasciare le autorizzazioni dipendenti da ruoli hardcoded
- cambiare subito tutte le tabelle rompendo il sistema esistente
- far dipendere il frontend da label statiche

## Conclusione

La strada corretta non e riscrivere HALO per ogni attivita, ma introdurre un **core multi-tenant e multi-vertical configurabile dal backend**.

La sequenza piu pragmatica e:

1. tenant config
2. feature flags
3. bootstrap backend-driven
4. permessi astratti
5. labels di dominio
6. custom fields
7. migrazione progressiva del naming legacy

In questo modo la struttura attuale resta riconoscibile, ma il software smette di essere vincolato al solo caso d'uso dentistico.
