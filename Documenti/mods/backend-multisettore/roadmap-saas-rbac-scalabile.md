# Roadmap SaaS Scalable HALO con RBAC Intuitivo

Data: `16 Aprile 2026`
Stato: `documento guida`
Ambito: `prodotto + backend + frontend + governance`

## Obiettivo

Trasformare HALO da gestionale originato per un settore specifico a piattaforma SaaS scalabile, multi-tenant e multi-verticale, con:

- login unico
- tenant resolution chiara
- bootstrap completo guidato dal backend
- moduli attivabili per azienda
- vocabolario adattabile per vertical
- RBAC semplice da capire e da mantenere
- governance centralizzata per configurazioni, feature, ruoli e audit

Il principio guida e:

- un solo core applicativo
- piu vertical
- piu tenant
- meno codice duplicato
- piu configurazione, meno fork

## Punto Di Partenza Reale Del Progetto

La codebase oggi e gia a meta strada verso la piattaforma:

- esiste un backend Express con Postgres
- esiste un frontend Next.js
- esiste un concetto di tenant in `studi`
- esiste un `vertical_key`
- esistono `tenant_features`
- esistono `vertical_templates`
- esiste un endpoint di bootstrap
- esistono labels e navigation risolte dal backend
- esistono guardie feature sul backend
- esiste un layer di alias semantici per il dominio

Riferimenti utili:

- [database/schema.sql](/Users/francescostrano/Desktop/HALO/database/schema.sql)
- [backend/src/config/multi-sector.js](/Users/francescostrano/Desktop/HALO/backend/src/config/multi-sector.js)
- [backend/src/services/feature-flags.service.js](/Users/francescostrano/Desktop/HALO/backend/src/services/feature-flags.service.js)
- [backend/src/services/tenant-config.service.js](/Users/francescostrano/Desktop/HALO/backend/src/services/tenant-config.service.js)
- [backend/src/services/domain-aliases.service.js](/Users/francescostrano/Desktop/HALO/backend/src/services/domain-aliases.service.js)
- [backend/src/routes/bootstrap.routes.js](/Users/francescostrano/Desktop/HALO/backend/src/routes/bootstrap.routes.js)
- [frontend/src/components/layout/app-shell.tsx](/Users/francescostrano/Desktop/HALO/frontend/src/components/layout/app-shell.tsx)
- [frontend/src/features/bootstrap/api.ts](/Users/francescostrano/Desktop/HALO/frontend/src/features/bootstrap/api.ts)

## Mappa Attuale, In Sintesi

### Cose gia buone

- il tenant esiste come concetto applicativo
- il bootstrap backend e il punto giusto da cui far dipendere la UI
- il sistema ha gia una base per labels e feature flag
- il backend protegge diverse route con `requireFeature`
- il frontend legge bootstrap e labels
- esiste un embrione di governance tenant

### Cose ancora legate al dominio originale

- ruoli legacy centrati su `DENTISTA`
- logica operativa ancora centrata su `pazienti`, `medico_id`, `medico`
- alcuni menu e fallback frontend ancora statici
- alcune schermate non sono ancora completamente bootstrap-driven
- il RBAC e ancora una combinazione di ruoli legacy e permission key

### Conclusione tecnica

HALO non va rifatto da zero. Va portato da:

- `applicazione con configurazioni`

a:

- `piattaforma con registry di dominio`

## Architettura Target

La piattaforma deve essere composta da 6 livelli.

### 1. Identity Layer

Gestisce:

- login
- refresh
- logout
- MFA futuro
- eventuale SSO futuro

Responsabilita:

- autenticazione
- issue token
- session lifecycle

### 2. Tenant Layer

Gestisce:

- azienda
- vertical
- branding
- timezone
- locale
- stato attivazione
- eventuale piano/licenza

Responsabilita:

- tenant resolution
- default settings
- override per azienda

### 3. Policy Layer

Gestisce:

- RBAC
- permission
- feature flag
- limiti piano
- guardie di accesso

Responsabilita:

- decidere cosa un utente puo vedere e fare

### 4. Domain Layer

Gestisce i moduli core:

- clienti
- agenda
- fatture
- pagamenti
- magazzino
- utenti
- automazioni
- report

### 5. Customization Layer

Gestisce:

- labels
- form dinamici
- custom fields
- workflow per vertical
- validazioni per settore
- navigation per tenant

### 6. Governance Layer

Gestisce:

- audit
- configurazioni tenant
- feature packs
- vertical templates
- admin console
- support tools
- rollout progressivi

## Flusso Ideale Dalla Login Al Workspace

### Step 1. Login

L’utente inserisce credenziali.

Output minimo:

- access token breve
- refresh token
- user identity
- tenant identity

### Step 2. Token Validation

Il frontend salva la sessione e avvia il refresh automatico.

Il backend deve restituire un token con:

- user id
- studio id
- role key
- permissions
- identity type

### Step 3. Tenant Resolution

Il sistema individua:

- a quale tenant appartiene l’utente
- quale vertical usa quel tenant
- quali feature sono abilitate
- quali label mostrare
- quale menu costruire

### Step 4. Bootstrap

Il frontend chiama un solo endpoint di bootstrap.

Il bootstrap deve contenere:

- tenant
- user
- roles
- permissions
- feature flags
- enabled modules
- labels
- navigation
- custom fields
- limits
- workflow hints

### Step 5. Shell Applicativo

Il frontend costruisce:

- sidebar
- header
- titoli pagina
- CTA
- route iniziale
- route fallback

### Step 6. Moduli

Ogni modulo:

- verifica feature flag
- verifica permission
- usa labels del tenant
- usa payload neutri
- usa alias semantici quando serve

### Step 7. Admin Tenant

Nel workspace o in un’area separata il tenant admin gestisce:

- branding
- feature
- ruoli
- permessi
- custom fields
- configurazione verticale

### Step 8. Admin Piattaforma

Separato dal tenant:

- catalogo verticali
- template globali
- governance config
- audit piattaforma
- support e manutenzione

## Roadmap Di Rifattorizzazione RBAC

L’RBAC attuale e utile per compatibilita, ma non e ancora il modello finale.

### Problema attuale

Oggi il sistema ragiona ancora troppo su:

- `ADMIN`
- `DENTISTA`
- `SEGRETARIO`
- `DIPENDENTE`

Questo e comodo per la migrazione, ma non e un RBAC SaaS veramente scalabile.

### Modello target

Il sistema deve ragionare su:

- `role` come contenitore di permessi
- `permission` come unita minima di autorizzazione
- `feature` come abilitazione funzionale
- `scope` come contesto tenant
- `resource` come entita di dominio

### Regole del nuovo RBAC

1. il permesso deve essere la fonte di verita
2. il ruolo deve essere solo un raggruppatore di permessi
3. il ruolo non deve codificare il settore
4. il ruolo non deve codificare la UI
5. il ruolo non deve codificare il workflow
6. il ruolo deve essere configurabile per tenant
7. i ruoli di sistema servono solo come default iniziali

### Permission model consigliato

Le permission devono essere neutrali e granulari:

- `dashboard.read`
- `clients.read`
- `clients.write`
- `clients.delete`
- `appointments.read`
- `appointments.write`
- `appointments.delete`
- `billing.read`
- `billing.write`
- `billing.manage`
- `inventory.read`
- `inventory.write`
- `users.read`
- `users.write`
- `settings.manage`
- `features.manage`
- `roles.manage`
- `custom-fields.manage`
- `integrations.manage`
- `audit.read`

### Ruoli target

I ruoli non devono essere pensati come professioni.
Devono essere pensati come profili operativi.

Esempio:

- `owner`
- `admin`
- `manager`
- `operator`
- `viewer`
- `billing_clerk`
- `clinical_staff`
- `custom_role_x`

### Transizione consigliata

Non eliminare subito i ruoli legacy.
Fare una migrazione graduale:

- fase 1: legacy roles + permission engine
- fase 2: ruoli tenant-configurabili
- fase 3: ruoli di sistema come template
- fase 4: ruoli completamente custom per tenant

## Roadmap Di Sviluppo Per Fasi

Ogni fase e scritta per essere eseguibile da un’IA in modo atomico.
Ogni fase deve produrre:

- obiettivo
- file coinvolti
- regole di implementazione
- output atteso
- criteri di completamento

---

## Fase 0 - Fondazioni Di Prodotto E Registro Concettuale

### Obiettivo

Definire in modo formale il lessico della piattaforma.

### Cosa fissare

- core entities
- verticals
- modules
- feature flags
- labels
- roles
- permissions
- workflows
- scopes

### Deliverable

- matrice vertical -> moduli -> labels -> ruoli
- catalogo feature
- catalogo permission
- mappa entita core vs entita legacy
- glossario condiviso

### Criterio di completamento

La piattaforma ha una fonte unica per decidere:

- cosa e un modulo
- cosa e un vertical
- cosa e una permission
- cosa e una label

---

## Fase 1 - Identity E Tenant Resolution

### Obiettivo

Rendere il login il primo passo di una catena SaaS chiara.

### Cosa fare

- consolidare il flusso login
- consolidare refresh token
- assicurare che il token contenga il tenant corretto
- preparare la possibilita di tenant multipli per utente in futuro

### Deliverable

- auth context stabile
- token payload coerente
- sessione leggibile dal frontend
- route auth pulite

### Regole

- nessun dato di business nel token
- solo identita e permessi
- il tenant deve sempre essere esplicito

### Criterio di completamento

L’utente autenticato arriva sempre in un contesto tenant deterministico.

---

## Fase 2 - RBAC Nuovo, Intuitivo E SaaS-Ready

### Obiettivo

Rifare il modo in cui si ragiona sui ruoli, rendendolo semplice da leggere e facile da estendere.

### Cosa fare

- introdurre un permission catalog unico
- separare ruoli da permessi
- fare in modo che i ruoli siano configurabili per tenant
- mantenere compatibilita con i ruoli legacy

### Struttura consigliata

- `roles`
  - identificatore
  - nome
  - descrizione
  - is_system
  - tenant_id
- `role_permissions`
  - role_id
  - permission_key
- `user_roles`
  - user_id
  - role_id

### Regole di design

1. il frontend non deve conoscere la logica RBAC interna
2. il backend deve esporre permissions risolte
3. i ruoli di sistema sono solo default
4. ogni tenant puo avere ruoli custom
5. le permission devono essere leggibili e standardizzate

### Compatibilita

Continuare a supportare:

- `ADMIN`
- `DENTISTA`
- `SEGRETARIO`
- `DIPENDENTE`

ma solo come fallback iniziale.

### Criterio di completamento

Tutte le route e le schermate ragionano su permission, non sul nome ruolo.

---

## Fase 3 - Vertical Templates E Configurazione Dominio

### Obiettivo

Trasformare il vertical in un pacchetto di comportamento predefinito.

### Cosa fare

- consolidare `vertical_templates`
- definire default di:
  - labels
  - features
  - roles
  - settings
  - workflow
- aggiungere mapping espliciti tra vertical e moduli

### Vertical suggeriti

- dental
- medical
- physiotherapy
- aesthetics
- consulting
- services

### Deliverable

- template per vertical
- default features
- default labels
- default roles
- default settings

### Criterio di completamento

Creando un tenant nuovo e scegliendo un vertical, il sistema puo generare un set coerente di default.

---

## Fase 4 - Feature Registry E Module Gating

### Obiettivo

Rendere i moduli attivabili o disattivabili per tenant in modo chiaro e governabile.

### Cosa fare

- consolidare catalogo feature
- definire dipendenze tra feature
- definire default per vertical
- definire override per tenant

### Feature base

- dashboard
- agenda
- clients
- billing
- payments.stripe
- inventory
- automation
- reports
- advanced_notes
- custom_fields
- calendar.google

### Regole

- se una feature e off, la route non deve essere esposta
- se una feature e off, il menu non deve mostrarla
- se una feature e off, le API devono rispondere con errore coerente
- se una feature e on, la UI deve poterla usare senza hardcode

### Criterio di completamento

Il tenant puo avere configurazioni diverse senza branching di codice.

---

## Fase 5 - Bootstrap Unico E UI Data-Driven

### Obiettivo

Far dipendere la UI dal backend in modo completo.

### Cosa fare

- consolidare il bootstrap
- arricchirlo con navigation, labels, permissions, modules, limits
- far leggere al frontend solo il bootstrap per costruire il workspace

### Deliverable

- bootstrap unico
- sidebar dinamica
- header dinamico
- route iniziale derivata da bootstrap
- fallback routes coerenti

### Regole

- niente menu statici hardcoded oltre al fallback tecnico
- niente labels hardcoded per il dominio
- niente route visibili se non permesse

### Criterio di completamento

Il frontend puo cambiare comportamento in base al tenant senza rebuild del codice.

---

## Fase 6 - Domain Abstraction E Entity Adapters

### Obiettivo

Rimuovere il lessico verticale dal core applicativo.

### Cosa fare

- introdurre DTO neutrali
- usare alias semantici
- mantenere tabelle legacy solo come storage iniziale
- separare nome dominio da nome storage

### Esempio

- `pazienti` diventa concettualmente `clients`
- `medico_id` diventa `owner_user_id`
- `medico` diventa `owner_display_name`

### Deliverable

- serializer neutrali
- request/response compatibili
- service layer che conosce il dominio astratto

### Criterio di completamento

Il frontend non dipende piu dal vocabolario dentistico per funzionare.

---

## Fase 7 - Custom Fields E Form Schema Dinamici

### Obiettivo

Rendere il modello dati adattabile per settore e tenant senza cambiare il core.

### Cosa fare

- consolidare `custom_field_definitions`
- introdurre schema di form dinamico
- introdurre validation rules per vertical e tenant
- introdurre rendering guidato da metadata

### Deliverable

- custom fields per entity
- regole required/optional
- opzioni per select e multi-select
- ordine di visualizzazione

### Criterio di completamento

Un tenant puo richiedere campi diversi senza alterare la logica core.

---

## Fase 8 - Workflow Engine Leggero E Regole Operative

### Obiettivo

Gestire differenze reali tra aziende e verticali.

### Cosa fare

- definire workflow per modulo
- definire stati e transizioni
- definire regole condizionali
- definire guardie di business

### Esempi

- agenda con stati diversi per vertical
- fattura generata da eventi differenti
- reminder con configurazione tenant
- assegnazione responsabilita diversa per settore

### Deliverable

- workflow registry
- state machine minima
- business rules config-driven

### Criterio di completamento

Le differenze tra aziende non sono piu solo etichette, ma anche comportamento.

---

## Fase 9 - Admin Tenant E Governance Operativa

### Obiettivo

Fornire all’azienda la possibilita di governare il proprio ambiente.

### Cosa fare

- creare area admin tenant
- gestire branding
- gestire feature override
- gestire ruoli
- gestire permessi
- gestire labels
- gestire custom fields
- gestire audit

### Deliverable

- console tenant
- API di configurazione
- audit log leggibile

### Criterio di completamento

Un tenant admin puo configurare il workspace senza intervento sviluppatore.

---

## Fase 10 - Platform Admin E Super-Governance

### Obiettivo

Separare la governance della piattaforma dalla governance del singolo tenant.

### Cosa fare

- catalogo verticali
- template base
- gestione piani
- rollout feature
- support tools
- audit piattaforma

### Deliverable

- console super-admin
- strumenti di diagnosi
- strumenti di override controllato

### Criterio di completamento

La piattaforma puo essere governata a livello globale senza entrare nel tenant.

---

## Fase 11 - Osservabilita, Audit E Sicurezza

### Obiettivo

Rendere la piattaforma manutenibile in produzione.

### Cosa fare

- audit config
- audit security
- audit role changes
- audit feature changes
- logging coerente
- metriche di utilizzo per tenant e vertical

### Deliverable

- log operativi
- audit trail
- alert minimi

### Criterio di completamento

Ogni modifica rilevante e tracciabile.

---

## Fase 12 - QA, Regression Guard E Rollout Progressivo

### Obiettivo

Evitare che la generalizzazione rompa il prodotto esistente.

### Cosa fare

- test RBAC
- test bootstrap
- test feature gating
- test multi-tenant
- test regressione legacy
- smoke test end to end

### Deliverable

- test automatici
- checklist funzionale
- script di smoke
- regole di rollback

### Criterio di completamento

Il sistema puo evolvere senza regressioni visibili per i tenant attivi.

## Mappa Di Esecuzione Consigliata

Se bisogna scegliere l’ordine giusto, la sequenza e questa:

1. fissare il modello RBAC target
2. rendere il bootstrap davvero centrale
3. consolidare vertical templates e feature registry
4. astrarre il dominio dal lessico dentistico
5. rendere la UI completamente data-driven
6. introdurre custom fields e workflow
7. costruire admin tenant
8. costruire super-admin platform
9. aggiungere osservabilita e QA

## Regole Per Un’IA Che Scrive Codice

Quando questa roadmap viene usata come base operativa, ogni task generato da IA deve rispettare queste regole:

- una fase deve produrre un risultato verificabile
- ogni fase deve avere file di confine chiari
- evitare refactor giganteschi in un solo step
- conservare compatibilita fino a quando non esiste sostituzione completa
- evitare di cambiare naming e storage nello stesso passo se non necessario
- separare sempre `policy`, `domain`, `ui` e `storage`
- non introdurre feature nuove senza registrarne catalogo, label e permission

## Definizione Di Successo

HALO e pronto come SaaS scalabile quando:

- il login identifica utente e tenant senza ambiguita
- il bootstrap governa la UI
- i moduli sono attivabili per tenant
- le labels sono risolte dal backend
- il RBAC usa permission come base
- i ruoli possono essere sistemici o custom
- le differenze tra aziende sono config-driven
- l’amministrazione tenant e separata dalla piattaforma
- i workflow possono cambiare per vertical senza fork di codice

