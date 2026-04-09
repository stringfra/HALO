# PIANO RUOLI DEFAULT ATTIVITA E PERSISTENZA SETTINGS HALO

## Scopo

Questo documento definisce un piano tecnico a fasi per raggiungere i seguenti obiettivi:

1. per ogni nuova attivita' creata dal daemon devono esistere 3 ruoli default:
   - `ADMIN`
   - `SEGRETARIO`
   - `DIPENDENTE`
2. la semantica deve essere:
   - `ADMIN = admin`
   - `SEGRETARIO = segretario`
   - `DIPENDENTE = ruolo operativo base equivalente all'attuale dentista`
3. non deve piu' comparire `DENTISTA` come ruolo default universale per qualsiasi attivita';
4. i ruoli devono comparire correttamente nei menu a tendina e nei punti di selezione UI;
5. `settings_json` deve salvarsi davvero e restare persistente anche dopo riavvio.

## Problema attuale sintetico

Dalla codebase emerge che oggi il sistema e' ancora fortemente ancorato al modello legacy:

- i ruoli di sistema default sono `ADMIN`, `DENTISTA`, `SEGRETARIO`;
- i vertical template espongono ancora `DENTISTA` come ruolo base comune;
- parte della UI usa direttamente il lessico legacy;
- la create user e le assegnazioni ruolo lavorano ancora sul modello storico;
- `settings_json` viene letto, validato e mergeato con template di verticale, ma il comportamento osservato indica che qualcosa nel flusso salvataggio/lettura/bootstrapping non resta persistente in modo affidabile.

## Obiettivo finale

Al termine del lavoro:

- ogni nuovo tenant/attivita' nasce con i 3 ruoli default corretti;
- `DENTISTA` non appare piu' come ruolo universale di default nelle nuove attivita';
- il ruolo operativo base diventa `DIPENDENTE` nel modello di piattaforma;
- tutti i selettori UI mostrano i ruoli effettivi corretti;
- `settings_json` viene salvato nel database e riletto correttamente anche dopo riavvio applicazione.

## Principi guida

- preservare compatibilita' controllata con il legacy finche' il refactor non e' completo;
- distinguere il nome tecnico di piattaforma dal label visibile per verticale;
- evitare migrazioni distruttive non reversibili senza backfill e audit;
- trattare `settings_json` come fonte persistente di verita' tenant-specifica;
- non mescolare il fix UI con il fix persistenza: vanno validati separatamente.

## Fase 0. Allineamento lessico e contratto ruoli di sistema

### Obiettivo

Definire il nuovo contratto dei ruoli di sistema per le attivita' nuove.

### Decisioni da fissare

- i ruoli di sistema target diventano:
  - `ADMIN`
  - `SEGRETARIO`
  - `DIPENDENTE`
- `DIPENDENTE` sostituisce `DENTISTA` come ruolo operativo base di piattaforma;
- i vertical possono continuare a visualizzare label contestuali:
  - dentistico: `Dentista`
  - medicale: `Medico`
  - servizi: `Operatore`
  - ecc.
- il nome tecnico di piattaforma non deve piu' obbligare il dominio dentistico.

### Deliverable

- specifica aggiornata del modello ruoli di sistema;
- mappa compatibilita' legacy `DENTISTA -> DIPENDENTE` dove necessaria.

### Criteri di accettazione

- e' chiaro cosa e' nome tecnico di piattaforma e cosa e' label verticale;
- il team puo' implementare il refactor senza ambiguita' semantiche.

## Fase 1. Refactor backend dei ruoli di sistema default

### Obiettivo

Fare in modo che ogni nuova attivita' creata dal daemon riceva i 3 ruoli default corretti.

### Interventi backend

- aggiornare il catalogo ruoli di sistema in:
  - `multi-sector.js`
  - seed SQL
  - servizi di bootstrap/repair RBAC
  - provisioning tenant da daemon
- sostituire il ruolo tecnico `DENTISTA` con `DIPENDENTE` nelle nuove inizializzazioni;
- aggiornare alias e display name dei ruoli di sistema;
- aggiornare il mapping permessi del ruolo operativo base;
- garantire che `ensureSystemRolesForTenant(...)` crei:
  - `ADMIN`
  - `SEGRETARIO`
  - `DIPENDENTE`

### Compatibilita'

Va deciso se:

- migrare immediatamente anche i tenant esistenti;
- oppure supportare una fase transitoria con:
  - vecchi tenant su `DENTISTA`
  - nuovi tenant su `DIPENDENTE`

La scelta consigliata e' una transizione controllata con script di migrazione dedicato, non un mix indefinito.

### Deliverable

- nuovo catalogo ruoli di sistema backend;
- bootstrap tenant aggiornato;
- seed/schema coerenti.

### Criteri di accettazione

- una nuova attivita' creata da daemon nasce con i soli ruoli:
  - `ADMIN`
  - `SEGRETARIO`
  - `DIPENDENTE`
- `DENTISTA` non viene piu' creato come default su nuovi tenant.

## Fase 2. Migrazione e compatibilita' dei tenant esistenti

### Obiettivo

Gestire il passaggio dei tenant esistenti dal modello legacy al nuovo modello.

### Interventi dati

- analizzare tenant e utenti che oggi usano `DENTISTA`;
- definire script SQL o servizio di migrazione per:
  - rinominare o sostituire il ruolo di sistema;
  - aggiornare `users.ruolo`;
  - aggiornare `roles.role_key`;
  - mantenere consistenza di `user_roles`;
- aggiornare gli strumenti di repair RBAC per il nuovo set di ruoli.

### Rischi da gestire

- perdita di coerenza tra `users.ruolo` e `user_roles`;
- rottura di filtri o dropdown frontend che si aspettano `DENTISTA`;
- mismatch audit/logs su tenant migrati.

### Deliverable

- piano di migrazione tenant esistenti;
- script di backfill;
- checklist rollback.

### Criteri di accettazione

- i tenant esistenti possono essere migrati senza perdere utenti o assegnazioni;
- il sistema non resta in stato ibrido non controllato.

## Fase 3. Aggiornamento dei vertical template e delle label

### Obiettivo

Separare definitivamente il ruolo tecnico di piattaforma dalla label di verticale.

### Interventi

- aggiornare `VERTICALS` e `vertical_templates`;
- sostituire il concetto di `DENTISTA` come ruolo standard con un ruolo base neutro;
- mantenere label contestuali nelle UI e nei bootstrap tenant;
- usare i label/domain aliases per mostrare:
  - dentista
  - medico
  - operatore
  - terapista
  - consulente

senza reintrodurre `DENTISTA` come ruolo tecnico universale.

### Deliverable

- vertical template coerenti col nuovo modello;
- labels verticali correttamente separate dai role key tecnici.

### Criteri di accettazione

- i vertical continuano a parlare il loro lessico;
- il backend platform non usa piu' `DENTISTA` come default universale.

## Fase 4. Aggiornamento UI: menu a tendina e selettori ruolo

### Obiettivo

Fare in modo che tutti i ruoli corretti siano visibili nei menu a tendina e nelle UI operative.

### Interventi frontend

- aggiornare tutti i selettori hardcoded che oggi mostrano:
  - `ADMIN`
  - `DENTISTA`
  - `SEGRETARIO`
- sostituire l'assunzione statica con dati reali lato daemon/tenant;
- allineare:
  - create user
  - update user
  - assegnazioni ruolo
  - eventuali filtri utenti
  - eventuali onboarding tenant
- mostrare nel dropdown il ruolo di sistema corretto (`DIPENDENTE`) o la label verticale corrispondente.

### Punti da verificare

- console daemon;
- eventuale area tenant standard;
- bootstrap frontend;
- eventuali componenti shared che usano union type statiche.

### Deliverable

- dropdown e menu a tendina aggiornati;
- rimozione di stringhe hardcoded legacy dove non piu' corrette.

### Criteri di accettazione

- su un tenant nuovo non compare `DENTISTA` come default tecnico nei selettori;
- i ruoli attivi del tenant sono realmente selezionabili;
- la UI non mostra opzioni obsolete.

## Fase 5. Revisione del bootstrap tenant e dei dati esposti al frontend

### Obiettivo

Assicurare che il frontend riceva i ruoli corretti dal bootstrap e non ricada su default legacy.

### Interventi backend/frontend

- rivedere `getTenantBootstrap(...)`;
- verificare cosa viene esposto in:
  - `current_user`
  - `roles`
  - `labels`
  - `navigation`
- evitare che il frontend ricostruisca ruoli default localmente con valori hardcoded;
- fare in modo che il bootstrap guidi i menu e i selettori.

### Deliverable

- contratto bootstrap coerente col nuovo modello ruoli;
- frontend che usa dati bootstrap e non enum legacy locali.

### Criteri di accettazione

- i ruoli mostrati lato frontend coincidono con quelli reali del tenant;
- un riavvio applicazione non reintroduce il vecchio default nei menu.

## Fase 6. Persistenza reale di `settings_json`

### Obiettivo

Capire e correggere il motivo per cui `settings_json` sembra non salvarsi o non riapparire dopo riavvio.

### Analisi da fare

Il problema puo' stare in uno o piu' di questi punti:

- il `PUT /tenant-config` non salva davvero nel DB in alcuni casi;
- il salvataggio avviene ma viene sovrascritto da bootstrap o template;
- il merge `template settings + tenant settings` nasconde i dati salvati;
- il frontend ricarica uno stato stale o locale e sembra perdere il salvataggio;
- esiste un problema di serializzazione/parsing del JSON;
- il daemon salva su un tenant ma il riavvio rilegge un tenant diverso o un record non aggiornato.

### Interventi backend

- tracciare il flusso completo:
  - request `PUT /tenant-config`
  - `UPDATE studi.settings_json`
  - lettura successiva via `GET /tenant-config`
  - lettura successiva via `/api/bootstrap`
- aggiungere audit e log diagnostico sul salvataggio;
- verificare `settings_version`;
- verificare che non ci siano scritture concorrenti che sovrascrivono il valore;
- aggiungere test di persistenza reale:
  - save
  - reload service
  - re-read from DB

### Interventi frontend

- verificare che il draft configurazione venga ricaricato dal backend dopo il save;
- evitare che il valore mostrato venga ricostruito da defaults locali;
- mostrare chiaramente:
  - `settings_version`
  - esito save
  - ultimo payload persistito.

### Deliverable

- bugfix persistenza `settings_json`;
- test backend su save/read;
- verifica manuale daemon su riavvio.

### Criteri di accettazione

- modifico `settings_json`;
- salvo;
- riavvio backend/frontend;
- il valore resta presente e viene riletto correttamente dal tenant.

## Fase 7. QA funzionale finale

### Obiettivo

Validare end-to-end il nuovo comportamento.

### Scenari minimi

#### Nuova attivita'

1. creo una nuova attivita' da daemon;
2. verifico i ruoli default presenti;
3. verifico assenza di `DENTISTA` come default tecnico;
4. verifico presenza di:
   - `ADMIN`
   - `SEGRETARIO`
   - `DIPENDENTE`

#### Menu a tendina

1. apro create user;
2. apro edit user;
3. apro assegnazioni ruolo;
4. verifico che i menu mostrino i ruoli corretti.

#### Settings JSON

1. modifico `settings_json`;
2. salvo;
3. verifico `GET /tenant-config`;
4. riavvio backend;
5. rileggo configurazione;
6. verifico che il valore sia rimasto persistito.

#### Tenant esistenti

1. verifico comportamento di tenant legacy migrato;
2. verifico coerenza tra `users.ruolo`, `roles`, `user_roles`;
3. verifico assenza di regressioni UI.

### Deliverable

- report QA finale;
- checklist manuale;
- elenco eventuali gap residui.

## Ordine consigliato di implementazione

1. Fase 0: allineamento lessico e contratto.
2. Fase 1: backend ruoli di sistema default.
3. Fase 2: migrazione tenant esistenti.
4. Fase 3: vertical template e labels.
5. Fase 4: dropdown e menu a tendina.
6. Fase 5: bootstrap frontend e dati esposti.
7. Fase 6: persistenza `settings_json`.
8. Fase 7: QA finale.

## Priorita' pratica

Se vuoi massimizzare il valore in poco tempo:

- priorita' altissima:
  - Fase 1
  - Fase 4
  - Fase 6
- priorita' alta:
  - Fase 2
  - Fase 5
- priorita' media:
  - Fase 3
  - Fase 7

## Risultato atteso

Alla fine di questo piano HALO avra':

- un modello ruoli default piu' coerente con attivita' multi-settore;
- un backend che non impone piu' il lessico dentistico a ogni nuova attivita';
- menu a tendina e selettori che mostrano i ruoli corretti;
- `settings_json` realmente persistente e affidabile anche dopo riavvio.
