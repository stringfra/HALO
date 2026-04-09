# PIANO RUOLI CUSTOM DAEMON E UI UTENTI HALO

## Scopo

Questo documento definisce un piano tecnico a fasi per raggiungere i seguenti obiettivi:

1. ogni attivita' deve avere ruoli custom isolati e non devono assolutamente incrociarsi tra tenant diversi;
2. se creo nuovi ruoli dal daemon, questi devono essere visibili e assegnabili correttamente;
3. nella console daemon va lasciato spazio alla sezione utenti tenant, mentre la sezione ruoli e permessi deve essere incorporata dentro un bottone `Gestisci`.

## Principi di progetto

- il tenant e' il perimetro di isolamento primario;
- nessun ruolo custom deve essere leggibile, assegnabile o modificabile fuori dal proprio `studio_id`;
- ogni utente tenant deve continuare ad avere esattamente un ruolo di sistema;
- i ruoli custom sono additivi rispetto al ruolo di sistema;
- la UI daemon deve rendere chiaro questo modello senza ambiguita';
- la UX deve separare il caso d'uso frequente `gestione utenti` dal caso d'uso avanzato `gestione ruoli e permessi`.

## Stato attuale sintetico

Dal comportamento osservato e dal codice attuale emerge che:

- il backend salva correttamente i ruoli custom tenant;
- il backend gia' filtra i ruoli per `studio_id` in molte query;
- la console daemon aveva problemi di persistenza del tenant selezionato;
- la UX di assegnazione ruolo utente e' fragile perche' separa `ruolo di sistema` e `assigned_roles`;
- la sezione ruoli e permessi occupa spazio direttamente nella pagina principale della console tenant;
- il flusso `crea utente` e il flusso `assegna ruoli` non sono ancora trattati come un modello coerente end-to-end.

## Obiettivo finale

Al termine del lavoro:

- ogni tenant vede e gestisce solo i propri ruoli custom;
- la creazione ruolo dal daemon produce immediata visibilita' nel tenant corretto;
- i ruoli custom risultano assegnabili a utenti tenant in modo affidabile;
- il ruolo di sistema resta obbligatorio e sempre consistente;
- la sezione utenti tenant resta centrale nella console;
- ruoli e permessi vengono spostati in un pannello secondario aperto da bottone `Gestisci`.

## Fase 0. Allineamento modello e invarianti

### Obiettivo

Formalizzare il contratto RBAC tenant, eliminando ambiguita' tra:

- `users.ruolo`;
- `roles.is_system = true`;
- `roles.is_system = false`;
- `user_roles`.

### Decisioni da fissare

- `users.ruolo` resta il ruolo di sistema primario dell'utente;
- `user_roles` contiene sempre:
  - esattamente un ruolo di sistema;
  - zero o piu' ruoli custom;
- i ruoli custom non sostituiscono mai il ruolo di sistema;
- il backend e il frontend devono considerare valida solo questa forma.

### Deliverable

- mini specifica RBAC tenant aggiornata;
- elenco invarianti da applicare in API, UI e test.

### Criteri di accettazione

- ogni sviluppatore puo' descrivere in modo univoco come si rappresenta un utente tenant con ruoli custom;
- non esistono piu' casi in cui UI e backend interpretano il modello in modo diverso.

## Fase 1. Isolamento forte dei ruoli custom per tenant

### Obiettivo

Garantire che i ruoli custom siano sempre e solo tenant-scoped.

### Interventi backend

- rivedere tutte le query daemon che leggono o assegnano ruoli;
- verificare che ogni query su `roles`, `role_permissions`, `user_roles` filtri sempre per `studio_id`;
- bloccare esplicitamente ogni assegnazione di `role_id` appartenente a un tenant diverso;
- mantenere e rafforzare il vincolo logico `UNIQUE (studio_id, role_key)`;
- aggiungere test di regressione sul fatto che un ruolo custom del tenant A non compaia mai nel tenant B.

### Interventi dati/schema

- audit dello schema `roles`, `role_permissions`, `user_roles`;
- eventuale backfill di consistenza se esistono assegnazioni incoerenti;
- script diagnostico per trovare:
  - ruoli senza tenant;
  - assegnazioni cross-tenant;
  - utenti senza ruolo di sistema.

### Deliverable

- check completo isolamento multi-tenant RBAC;
- test backend di isolamento.

### Criteri di accettazione

- un ruolo custom creato nel tenant A non e' mai elencato nelle API del tenant B;
- non e' possibile assegnare via API un ruolo di un tenant diverso;
- gli strumenti di diagnostica segnalano zero contaminazioni cross-tenant.

## Fase 2. Creazione e visibilita' corretta dei ruoli custom da daemon

### Obiettivo

Rendere affidabile il ciclo:

1. creo ruolo custom;
2. lo vedo subito;
3. lo ritrovo dopo refresh;
4. lo ritrovo nel tenant corretto.

### Interventi frontend

- mantenere persistenza del tenant selezionato nella console daemon;
- mostrare in modo evidente il tenant attivo nella vista di dettaglio;
- aggiungere feedback esplicito post-creazione:
  - nome ruolo;
  - tenant;
  - permessi assegnati;
- evidenziare i ruoli custom appena creati nella lista.

### Interventi backend

- confermare che la response di creazione restituisca il record completo e serializzato come quello della lista;
- uniformare `POST /roles`, `GET /roles`, `PUT /roles/:roleId` sullo stesso shape di payload;
- aggiungere test API su create-list-refresh.

### Deliverable

- flusso di creazione ruolo deterministicamente coerente;
- suite test create/list/update ruoli tenant.

### Criteri di accettazione

- dopo creazione, il ruolo e' visibile senza cambiare vista;
- dopo refresh, il ruolo e' ancora visibile nello stesso tenant;
- la lista ruoli non cambia tenant implicitamente.

## Fase 3. Assegnazione corretta dei ruoli custom agli utenti tenant

### Obiettivo

Permettere di assegnare ruoli custom in modo comprensibile e coerente con il ruolo di sistema.

### Interventi backend

- mantenere il vincolo `esattamente un ruolo di sistema`;
- permettere la coesistenza `ruolo di sistema + ruoli custom`;
- allineare tutte le API utente in modo che:
  - aggiornare `users.ruolo` aggiorni anche il ruolo di sistema in `user_roles`;
  - aggiornare `user_roles` aggiorni coerentemente il ruolo di sistema primario;
- estendere `POST /tenants/:tenantId/users` per supportare anche assegnazioni iniziali di ruoli custom;
- estendere il contratto API con `role_ids` o campo equivalente per il create utente.

### Interventi frontend

- nella sezione `Crea utente` mostrare:
  - il ruolo di sistema;
  - i ruoli custom disponibili;
- sincronizzare automaticamente il ruolo di sistema con le assegnazioni;
- impedire UX ambigue:
  - piu' ruoli di sistema selezionati;
  - nessun ruolo di sistema selezionato;
- mostrare hint chiaro:
  - il ruolo custom non sostituisce il ruolo base, lo estende.

### Deliverable

- creazione utente con ruoli coerenti;
- modifica utente con sincronizzazione bidirezionale;
- test backend e frontend sui casi principali.

### Criteri di accettazione

- un utente puo' essere creato come `DENTISTA` con uno o piu' ruoli custom;
- un utente gia' esistente puo' ricevere o perdere un ruolo custom senza rompere il ruolo base;
- non e' possibile salvare utenti con zero ruoli di sistema o con piu' di uno.

## Fase 4. Revisione UX della console: utenti centrali, ruoli dietro `Gestisci`

### Obiettivo

Ridurre il rumore della pagina principale e dare priorita' alla gestione utenti.

### Interventi UI/UX

- mantenere la sezione `Utenti tenant` come sezione principale;
- rimuovere la lista completa `Ruoli e permessi` dalla vista principale;
- introdurre un bottone `Gestisci` vicino al blocco utenti o nel relativo header;
- aprire al click un pannello dedicato, drawer o modal con:
  - elenco ruoli;
  - creazione ruolo;
  - modifica permessi;
  - conteggio utenti assegnati;
- rendere il pannello chiaramente tenant-scoped.

### Struttura target suggerita

- colonna principale:
  - utenti tenant;
  - crea utente;
  - modifica utente;
  - assegnazioni ruolo utente;
- azione secondaria:
  - bottone `Gestisci`;
  - pannello `Ruoli e permessi`.

### Vantaggi attesi

- piu' spazio utile per il caso d'uso frequente;
- minore confusione tra gestione utenti e amministrazione avanzata RBAC;
- minore probabilita' di errore operativo.

### Deliverable

- redesign console daemon tenant users;
- pannello `Gestisci` per ruoli e permessi.

### Criteri di accettazione

- la pagina utenti non mostra piu' direttamente tutta la matrice ruoli/permessi;
- il bottone `Gestisci` apre l'intero perimetro ruoli e permessi;
- la sezione utenti risulta piu' leggibile e meno densa.

## Fase 5. Hardening logico e audit

### Obiettivo

Tracciare e proteggere tutte le operazioni critiche sui ruoli custom.

### Interventi

- audit event specifici per:
  - creazione ruolo custom;
  - modifica permessi;
  - assegnazione ruolo custom a utente;
  - rimozione ruolo custom da utente;
- log differenziati tra:
  - cambio ruolo di sistema;
  - aggiunta/rimozione ruolo custom;
- validazione server-side sui payload di create/update user e role assignment;
- messaggi di errore piu' espliciti quando il vincolo RBAC viene violato.

### Deliverable

- audit trail leggibile e consistente;
- messaggistica di errore piu' chiara.

### Criteri di accettazione

- ogni operazione sui ruoli custom produce un audit leggibile;
- in caso di errore, l'utente daemon capisce se il problema e':
  - tenant errato;
  - ruolo non appartenente al tenant;
  - assenza di ruolo di sistema;
  - conflitto di assegnazione.

## Fase 6. QA funzionale e test di regressione

### Obiettivo

Validare il comportamento end-to-end prima del rilascio.

### Scenari minimi da testare

#### Isolamento tenant

- creo ruolo custom in tenant A;
- verifico che non compaia nel tenant B;
- provo assegnazione cross-tenant e verifico rifiuto.

#### Visibilita'

- creo ruolo custom;
- verifico comparsa immediata;
- aggiorno la pagina;
- verifico che resti visibile nel tenant corretto.

#### Assegnazione utente

- creo utente con ruolo di sistema e ruolo custom;
- aggiorno utente aggiungendo un ruolo custom;
- rimuovo solo il ruolo custom;
- cambio ruolo di sistema mantenendo il ruolo custom;
- verifico impossibilita' di salvare senza ruolo di sistema.

#### UX `Gestisci`

- apro la console tenant;
- verifico che utenti tenant sia la sezione dominante;
- apro `Gestisci`;
- creo e modifico un ruolo custom dal pannello dedicato.

### Deliverable

- checklist QA;
- test manuali;
- test automatici backend;
- eventuali test frontend sui flussi critici.

### Criteri di accettazione

- zero regressioni su utenti, ruoli di sistema e tenant isolation;
- flusso daemon coerente e ripetibile per creazione e assegnazione ruoli custom.

## Sequenza consigliata di implementazione

1. Fase 0: allineamento invarianti RBAC.
2. Fase 1: isolamento forte cross-tenant.
3. Fase 2: stabilizzazione create/list/refresh ruoli.
4. Fase 3: assegnazione corretta e creazione utente con ruoli custom.
5. Fase 4: redesign UI con bottone `Gestisci`.
6. Fase 5: audit e hardening.
7. Fase 6: QA finale.

## Priorita' pratica

Se si vuole massimizzare valore in tempi brevi:

- priorita' alta:
  - isolamento tenant;
  - assegnazione corretta;
  - visibilita' ruoli dopo refresh;
- priorita' media:
  - creazione utente con ruoli custom direttamente dalla form;
  - redesign `Gestisci`;
- priorita' finale:
  - raffinamento audit e QA esteso.

## Risultato atteso

Alla fine di questo piano HALO avra' un modello RBAC tenant piu' robusto, leggibile e governabile:

- i ruoli custom saranno realmente per-attivita';
- il daemon li gestira' senza ambiguita';
- gli utenti tenant potranno riceverli correttamente;
- la console avra' una UX piu' pulita, con `Utenti tenant` in primo piano e `Ruoli e permessi` concentrati nel bottone `Gestisci`.
