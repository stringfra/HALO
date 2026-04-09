# HALO: documento tecnico e business per comprensione da parte di una IA

## 1. Scopo del documento

Questo documento descrive HALO in modo leggibile da una IA, combinando:

- contesto business;
- architettura tecnica;
- modello dati implicito;
- moduli applicativi;
- flussi principali;
- limiti e assunzioni attuali.

L'obiettivo non e' fare marketing, ma fornire una mappa operativa del progetto per permettere a un agente IA di capire rapidamente cosa esiste, come e' organizzato e dove intervenire.

## 2. Sintesi del progetto

HALO e' una piattaforma SaaS gestionale multi-tenant pensata per piccole e medie attivita' professionali a prenotazione o relazione continuativa con il cliente.

Nel codice attuale il caso d'uso piu' esplicito e' lo studio dentistico, ma la piattaforma e' stata progettata per supportare piu' verticali:

- studio dentistico;
- studio medico;
- studio fisioterapico;
- centro estetico;
- studio di consulenza;
- attivita' di servizi.

HALO unisce due livelli:

- livello tenant: il gestionale usato dal singolo studio/attivita';
- livello platform/daemon: il backoffice centrale che governa tutti i tenant.

In termini business, HALO vuole essere un sistema operativo leggero per studi e servizi: anagrafiche clienti/pazienti, agenda, fatturazione, incassi, magazzino, utenti, configurazione e automazioni.

## 3. Visione business

### 3.1 Problema che HALO risolve

Molte realta' verticali piccole o medie gestiscono i processi operativi con strumenti frammentati: agenda separata, anagrafiche sparse, fatture fuori dal gestionale, configurazioni manuali e poca standardizzazione tra sedi o clienti.

HALO centralizza questi processi in un'unica piattaforma con tre benefici principali:

- standardizzazione operativa;
- configurazione per settore senza sviluppare un prodotto diverso per ogni verticale;
- controllo centrale della piattaforma tramite il layer daemon.

### 3.2 Cliente ideale

Il cliente diretto sembra essere il singolo studio/azienda tenant. Tuttavia, l'esistenza del layer daemon suggerisce anche un modello B2B2B o managed SaaS, dove un operatore centrale:

- crea tenant;
- assegna configurazioni iniziali;
- abilita feature;
- governa utenti, ruoli e compliance operativa.

### 3.3 Valore di business

Il valore generato da HALO e' soprattutto organizzativo:

- riduce il tempo di setup di un nuovo cliente;
- consente personalizzazione controllata per verticale;
- abilita upsell tramite feature flags;
- rende possibile una governance centralizzata multi-tenant;
- prepara il prodotto a scalare oltre il solo dominio dentistico.

## 4. Posizionamento funzionale del prodotto

HALO e' un gestionale verticale configurabile, non un ERP generalista.

Le capability core oggi visibili nel backend sono:

- clienti/pazienti;
- appuntamenti/agenda;
- fatture;
- pagamenti e riconciliazione Stripe;
- magazzino;
- utenti e ruoli;
- statistiche;
- automazioni operative;
- custom fields;
- configurazione tenant;
- audit e governance piattaforma.

## 5. Architettura ad alto livello

### 5.1 Componenti applicativi

Il repository mostra almeno due applicazioni:

- `backend`: API Node.js/Express con PostgreSQL;
- `frontend`: applicazione Next.js/React.

Il backend e' il centro logico del sistema. Il frontend e' presente come client separato e consuma le API.

### 5.2 Stack tecnico

Backend:

- Node.js;
- Express 5;
- PostgreSQL tramite `pg`;
- `jsonwebtoken` per auth JWT;
- `bcrypt` per hash password.

Frontend:

- Next.js 16;
- React 19;
- TypeScript;
- Tailwind CSS 4;
- Axios;
- `react-big-calendar` per la parte agenda.

### 5.3 Pattern architetturale

Il backend segue un pattern pragmatico a strati:

- `routes/`: definizione endpoint HTTP;
- `services/`: logica applicativa e accesso dati;
- `config/`: cataloghi, permessi, verticali, database;
- `middleware/`: auth, feature gating, hardening, error handling;
- `controllers/`: auth classica e auth daemon;
- PostgreSQL come persistenza principale.

Non emerge un ORM: le query sono SQL raw.

## 6. Modello operativo multi-tenant

### 6.1 Tenant

Il tenant corrisponde a uno studio o a una singola attivita' cliente. Nel database il tenant sembra essere modellato principalmente tramite la tabella `studi`.

Campi concettuali rilevanti:

- identificativo tenant;
- codice tenant;
- nome interno;
- display name;
- business name;
- verticale di appartenenza;
- branding;
- locale;
- timezone;
- settings JSON;
- stato attivo/non attivo.

### 6.2 Isolamento dati

Quasi tutte le entita' di business sono filtrate per `studio_id`. Questo indica un modello shared-database/shared-schema con isolamento logico a livello riga, non un database separato per tenant.

### 6.3 Provisioning

Il tenant puo' essere creato dal layer daemon. Il provisioning include:

- validazione dei metadati tenant;
- selezione del verticale;
- caricamento di impostazioni iniziali;
- creazione dei ruoli di sistema;
- creazione dell'utente admin iniziale;
- bootstrap della configurazione iniziale.

Questo rende HALO una piattaforma con onboarding strutturato, non solo un'app monoutente duplicata.

## 7. Layer daemon / platform governance

### 7.1 Cosa significa "daemon" in HALO

Nel progetto, `daemon` rappresenta l'identita' e il perimetro di amministrazione della piattaforma sopra i tenant. Non e' un demone di sistema Unix: e' un pannello/insieme di API con privilegi cross-tenant.

### 7.2 Responsabilita' del daemon

Il layer daemon consente di:

- autenticare un account di piattaforma separato dagli utenti tenant;
- elencare tenant;
- leggere overview globale;
- creare tenant;
- leggere e modificare configurazione tenant;
- leggere e modificare feature flags tenant;
- gestire ruoli e utenti tenant;
- consultare audit log e diagnostica;
- applicare policy di sicurezza e conferme esplicite su operazioni sensibili.

### 7.3 Implicazione business

Questo layer trasforma HALO da semplice gestionale a piattaforma governabile centralmente. E' coerente con scenari di:

- software house che gestisce piu' clienti;
- franchising o gruppo multi-sede;
- operatore interno che fa onboarding e supporto;
- ambiente SaaS con controllo delle capability per tenant.

## 8. Verticalizzazione del prodotto

HALO usa un modello "core + vertical templates".

Esiste un core comune con entita' e moduli standard:

- clients;
- appointments;
- billing;
- payments;
- inventory;
- users;
- automations.

Su questo core si innestano configurazioni verticali che definiscono:

- naming del dominio;
- moduli abilitati di default;
- ruoli di default;
- labels del frontend;
- feature flags iniziali;
- impostazioni predefinite.

Esempi:

- nel dental e medical il cliente e' un paziente;
- in consulting o services il cliente resta "cliente";
- l'inventory puo' essere disabilitato in verticali dove non e' centrale;
- le note avanzate o alcuni moduli cambiano per verticale.

Questo approccio evita fork di prodotto e permette di riconfigurare la stessa base software.

## 9. Feature flags e personalizzazione

Le feature flags sono un meccanismo centrale di HALO.

Catalogo attuale visibile:

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

Uso pratico:

- abilitano/disabilitano sezioni del prodotto per tenant;
- influenzano la navigazione disponibile;
- permettono differenze per verticale o per piano cliente;
- consentono rollout progressivi.

Businessmente, sono un punto chiave per packaging commerciale e governance del prodotto.

## 10. Moduli di dominio principali

### 10.1 Clienti / Pazienti

Modulo per le anagrafiche del tenant.

Responsabilita':

- gestione dati anagrafici e contatti;
- assegnazione a un owner/professionista;
- gestione note;
- estensione tramite custom fields.

Nel verticale dental/medical il dominio usa spesso il naming `pazienti`, ma il progetto sta gia' introducendo alias piu' generici come `clients`.

### 10.2 Appuntamenti / Agenda

Modulo per pianificare slot e visite.

Responsabilita':

- creazione appuntamenti;
- assegnazione a paziente/cliente;
- associazione al professionista;
- gestione stato appuntamento;
- vista filtrata per ruolo.

E' una capability core per attivita' a prenotazione.

### 10.3 Fatture e pagamenti

Modulo amministrativo per il ciclo economico operativo.

Responsabilita':

- creazione fatture per cliente/paziente;
- stato fattura (`da_pagare`, `pagata`);
- integrazione checkout Stripe;
- webhook di aggiornamento stato;
- log eventi di pagamento.

Non sembra ancora un sistema contabile completo: e' piu' vicino a un billing operativo integrato nel gestionale.

### 10.4 Magazzino

Modulo per prodotti e giacenze.

Responsabilita':

- gestione articoli;
- quantita' disponibili;
- soglia minima;
- elenco articoli sotto soglia;
- supporto al riordino.

Ha senso soprattutto per verticali con consumo materiali o vendita accessoria.

### 10.5 Utenti, ruoli e permessi

Il sistema supporta:

- utenti tenant;
- ruoli legacy (`ADMIN`, `DENTISTA`, `SEGRETARIO`);
- evoluzione verso RBAC piu' granulare con `roles`, `role_permissions`, `user_roles`.

Questo indica una transizione da autorizzazione per ruolo fisso a un modello piu' flessibile a permessi.

### 10.6 Configurazione tenant

Ogni tenant ha una configurazione amministrabile:

- branding;
- locale;
- timezone;
- settings JSON;
- versionamento settings;
- labels di dominio;
- audit log tenant.

Questa configurazione rende HALO adattabile senza modifiche codice per ogni cliente.

### 10.7 Custom fields

I custom fields permettono di estendere il modello dati per entita' core senza alterare ogni volta lo schema applicativo.

Valore business:

- evita richieste di sviluppo per piccole personalizzazioni;
- aumenta adattabilita' per verticale e cliente;
- rende il prodotto piu' "configurable SaaS".

### 10.8 Automazioni

Le automazioni oggi visibili sono operative e leggere:

- reminder appuntamenti;
- recall pazienti/clienti inattivi o senza visite recenti.

Non sono workflow BPM complessi: sono automazioni pratiche per retention e continuita' operativa.

### 10.9 Reporting / statistiche

Al momento si vede almeno il calcolo guadagni. Il modulo e' quindi presente ma non sembra ancora esteso a una BI completa.

## 11. Modello di sicurezza e identita'

### 11.1 Due identita' distinte

HALO distingue chiaramente:

- `tenant_user`: utente operativo del singolo tenant;
- `daemon`: identita' di piattaforma cross-tenant.

Questa distinzione e' importante per un'IA: i privilegi daemon non vanno trattati come privilegi tenant elevati, ma come dominio separato.

### 11.2 Meccanismi auth

Nel backend sono presenti:

- login tenant;
- access token JWT;
- refresh token persistiti in DB;
- login daemon separato;
- bootstrap account daemon;
- supporto MFA per daemon;
- middleware di verifica token e permessi.

### 11.3 Modello autorizzativo

L'autorizzazione combina:

- feature flags;
- permessi applicativi;
- ruoli legacy;
- policy specifiche per daemon;
- conferme esplicite per operazioni sensibili nel layer platform.

## 12. API surface osservabile

Le API del backend si dividono in quattro famiglie:

- API legacy/domain-specific in italiano: `/pazienti`, `/appuntamenti`, `/fatture`, `/prodotti`;
- API auth e bootstrap: `/api/login`, `/api/refresh`, `/api/bootstrap`;
- API v2 piu' neutre semanticamente: `/api/v2/clients`, `/api/v2/appointments`, `/api/v2/invoices`, `/api/v2/inventory-items`, `/api/v2/users`;
- API platform/daemon: `/api/daemon/...`.

Questo suggerisce una fase di transizione:

- compatibilita' con il dominio storico dentistico;
- graduale evoluzione verso naming piu' generale e platform-oriented.

## 13. Modello dati implicito

Le principali tabelle deducibili dal codice sono:

- `studi`: tenant;
- `users`: utenti tenant;
- `pazienti`: anagrafiche clienti/pazienti;
- `appuntamenti`: agenda;
- `fatture`: billing;
- `fatture_pagamenti`: storico pagamenti;
- `prodotti`: inventario;
- `tenant_features`: override feature flags;
- `tenant_audit_logs`: audit tenant;
- `platform_accounts`: account daemon/platform;
- `roles`, `role_permissions`, `user_roles`: RBAC tenant;
- `refresh_tokens`: sessioni refresh;
- `vertical_templates`: template verticali.

Esistono anche riferimenti a entita' core astratte:

- `core_clients`
- `core_appointments`
- `core_invoices`
- `core_inventory_items`

Queste sembrano un livello di astrazione/futuro consolidamento sopra le tabelle legacy.

## 14. Flussi business principali

### 14.1 Onboarding nuovo tenant

Flusso:

1. un operatore daemon crea il tenant;
2. sceglie verticale, locale e timezone;
3. il sistema inizializza settings e ruoli;
4. viene creato l'admin del tenant;
5. il tenant entra in esercizio con feature di default.

### 14.2 Operativita' quotidiana tenant

Flusso tipico:

1. gestione anagrafiche clienti/pazienti;
2. pianificazione appuntamenti;
3. esecuzione servizio/visita;
4. emissione fattura;
5. registrazione pagamento o checkout Stripe;
6. consultazione statistiche e automazioni.

### 14.3 Governance centrale

Flusso tipico:

1. il team platform legge overview tenant;
2. controlla feature, config e ruoli;
3. applica modifiche mirate per tenant;
4. consulta audit e diagnostica;
5. mantiene consistenza RBAC e setup cross-tenant.

## 15. Stato evolutivo del progetto

Dalla struttura del codice si deduce che HALO e' in una fase intermedia di maturazione.

Segnali di evoluzione:

- coesistenza tra naming legacy dentistico e naming neutro multi-verticale;
- presenza di API v2 parallele alle route storiche;
- passaggio da ruoli fissi a RBAC;
- introduzione del layer daemon come control plane;
- template verticali statici con supporto a template persistiti su DB;
- presenza di entita' core astratte oltre alle tabelle legacy.

Quindi HALO non e' un prodotto puramente greenfield, ma un sistema in rifattorizzazione verso una piattaforma piu' generalizzata.

## 16. Limiti e aree da trattare con cautela

Una IA che lavora su HALO dovrebbe assumere quanto segue:

- il backend attuale e' fortemente guidato da SQL raw e naming storico;
- alcune entita' sono ancora legacy-first;
- non tutto il dominio e' completamente astratto rispetto al dental;
- il layer daemon e' centrale e non va confuso con l'admin di un singolo tenant;
- feature flags e permessi sono parte del comportamento, non dettagli accessori;
- il prodotto e' multi-tenant logico, quindi ogni query va pensata con `studio_id`.

## 17. Come una IA dovrebbe interpretare HALO

Per una IA, HALO va modellato cosi':

- tipo di sistema: SaaS gestionale multi-tenant verticalizzabile;
- unita' cliente: tenant/studio/attivita';
- control plane: daemon/platform;
- data plane: moduli operativi del tenant;
- entita' core: clienti, appuntamenti, fatture, pagamenti, prodotti, utenti;
- meccanismi di adattamento: vertical templates, feature flags, custom fields, labels;
- vincolo architetturale principale: compatibilita' tra dominio legacy e architettura futura piu' generica.

## 18. Riassunto operativo finale

HALO e' una piattaforma software per gestire attivita' professionali verticali con una forte enfasi su:

- multi-tenancy;
- onboarding centralizzato;
- configurabilita' per settore;
- governance di piattaforma;
- gestione operativa quotidiana del tenant.

Il prodotto oggi appare piu' maturo sul backend e sulle API che sulla formalizzazione documentale. Per questo motivo, chiunque lavori con HALO dovrebbe considerarlo come una piattaforma in transizione da gestionale verticale specializzato a framework SaaS multi-verticale governato centralmente.
