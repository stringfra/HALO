# PIANO COMPLETAMENTO GAP DAEMON HALO

Data: `04 Aprile 2026`
Stato: `aperto`

## 1. Scopo del documento

Questo documento raccoglie in modo tecnico e operativo tutti i punti `daemon` che risultano ancora:

- non coperti
- coperti solo parzialmente
- validati solo a livello strutturale ma non ancora chiusi end-to-end

L'obiettivo e' trasformare i gap residui in un piano di completamento ordinato, suddiviso in fasi eseguibili.

## 2. Gap residui identificati

### Gap non ancora coperti

- bootstrap iniziale esplicito delle credenziali `daemon`
- MFA o secondo fattore per accesso `daemon`
- manutenzione dati multi-tenant
- operazioni correttive multi-tenant avanzate
- pannello di supporto tecnico avanzato
- strumenti completi di manutenzione amministrativa
- test end-to-end reali con database popolato e account `daemon` reale

### Gap coperti solo parzialmente

- gestione ruoli e permessi tenant: lettura `OK`, scrittura non completa
- gestione utenti e assegnazioni ruolo tenant: lettura `OK`, scrittura non completa
- audit daemon: eventi principali coperti, ma non tutti gli endpoint read-only sono auditati singolarmente
- hardening operativo: base presente, ma senza MFA e senza catalogo formale di operazioni irreversibili
- validazione runtime ambiente: policy e allowlist implementate ma non ancora verificate con scenari reali di staging/produzione

## 3. Obiettivo finale del completamento

Il perimetro `daemon` puo' considerarsi chiuso in senso pienamente ingegneristico quando:

- l'account `daemon` puo' essere bootstrapato in modo esplicito e difendibile
- l'accesso `daemon` puo' essere protetto con secondo fattore o equivalente
- utenti, ruoli e assegnazioni tenant sono governabili in modo completo dalla console
- esistono strumenti amministrativi avanzati per supporto tecnico e operazioni correttive
- l'audit copre in modo sistematico l'intera superficie critica
- esistono test automatici e test operativi reali che validano il comportamento

## 4. Strategia di completamento consigliata

La sequenza consigliata e':

1. chiudere bootstrap credenziali e accesso forte
2. completare la governance scrivibile di utenti e ruoli
3. completare audit e classificazione operazioni critiche
4. introdurre tooling amministrativo avanzato
5. eseguire test reali e validazione finale ambiente

## 5. Fasi di completamento

## Fase 9. Bootstrap esplicito account daemon

### Obiettivo

Permettere la creazione o inizializzazione dell'account `daemon` senza seed impliciti o inserimenti manuali opachi.

### Problema attuale

Nel codice esiste il modello `platform_accounts`, ma non esiste ancora un flusso ufficiale per:

- creare il primo account `daemon`
- ruotare credenziali iniziali
- documentare la procedura operativa in modo sicuro

### Intervento tecnico previsto

Backend:

- introdurre comando o script dedicato di bootstrap
- impedire bootstrap multipli accidentali se un account `daemon` e' gia presente
- registrare l'evento nel `platform_audit_logs`

Database:

- nessuna nuova tabella obbligatoria
- eventuale supporto a flag `bootstrap_completed` se utile

Documentazione:

- runbook operativo per creazione iniziale e rotazione password

### Output atteso

- script o comando `bootstrap-daemon`
- procedura documentata di first setup
- audit dell'inizializzazione

### Criteri di chiusura

- un ambiente nuovo puo' ottenere il primo account `daemon` senza SQL manuale
- il bootstrap e' idempotente o esplicitamente protetto
- esiste documentazione tecnica eseguibile

## Fase 10. Accesso forte e secondo fattore

### Obiettivo

Rendere l'accesso `daemon` piu' forte rispetto all'autenticazione tenant standard.

### Problema attuale

L'hardening corrente copre:

- policy ambiente
- allowlist IP opzionale
- conferma per scritture critiche

Ma l'accesso vero e proprio e' ancora solo password-based.

### Intervento tecnico previsto

Backend:

- supporto a TOTP o meccanismo equivalente
- estensione del login `daemon` a due step
- rotazione o recovery flow controllato

Schema dati:

- eventuale aggiunta a `platform_accounts` di campi come:
  - `mfa_enabled`
  - `mfa_secret_encrypted`
  - `mfa_recovery_codes_json`

Frontend:

- schermata `daemon/login` estesa a secondo step
- gestione errore MFA dedicata

Audit:

- eventi `daemon.mfa.enabled`
- `daemon.login.challenge.passed`
- `daemon.login.challenge.failed`

### Output atteso

- login daemon con MFA opzionale o obbligatorio
- strategia chiara per abilitazione e recovery

### Criteri di chiusura

- il sistema puo' richiedere secondo fattore per `daemon`
- gli eventi MFA sono tracciati
- il flusso e' usabile dalla UI daemon

## Fase 11. Gestione completa utenti tenant da console daemon

### Obiettivo

Completare la gestione scrivibile degli utenti tenant dal pannello daemon.

### Problema attuale

La console daemon espone:

- lettura utenti tenant

Ma non copre ancora:

- creazione utenti tenant
- modifica utenti tenant
- disattivazione o cancellazione controllata
- eventuali operazioni su password

### Intervento tecnico previsto

Backend:

- endpoint `POST /api/daemon/tenants/:tenantId/users`
- endpoint `PUT /api/daemon/tenants/:tenantId/users/:userId`
- endpoint `DELETE /api/daemon/tenants/:tenantId/users/:userId`

Frontend:

- form dedicati in console daemon
- conferma per operazioni sensibili
- warning su azioni irreversibili

Audit:

- `daemon.tenant_user.created`
- `daemon.tenant_user.updated`
- `daemon.tenant_user.deleted`
- `daemon.tenant_user.password_reset`

### Output atteso

- gestione utenti tenant completa da console daemon

### Criteri di chiusura

- un tenant puo' essere amministrato lato utenti senza passare dalla UI tenant
- tutte le scritture sono auditabili

## Fase 12. Gestione completa ruoli, permessi e assegnazioni

### Obiettivo

Completare la governance di ruoli e permessi tenant dal perimetro daemon.

### Problema attuale

Esiste solo lettura di:

- ruoli tenant
- permessi associati

Mancano:

- creazione ruolo
- update ruolo
- assegnazione permessi
- assegnazione o rimozione ruolo da utenti

### Intervento tecnico previsto

Backend:

- endpoint `POST /api/daemon/tenants/:tenantId/roles`
- endpoint `PUT /api/daemon/tenants/:tenantId/roles/:roleId`
- endpoint `PUT /api/daemon/tenants/:tenantId/users/:userId/roles`

Servizi:

- regole di validazione su ruoli di sistema e ruoli custom
- protezione contro downgrade o inconsistenze autorizzative

Frontend:

- editor ruoli
- editor permessi
- schermata assegnazioni utente-ruolo

Audit:

- `daemon.tenant_role.created`
- `daemon.tenant_role.updated`
- `daemon.tenant_role.permissions_updated`
- `daemon.tenant_user.roles_updated`

### Output atteso

- controllo completo di RBAC tenant dalla console daemon

### Criteri di chiusura

- ruoli e assegnazioni sono modificabili da daemon
- i ruoli di sistema restano protetti da regole esplicite

## Fase 13. Catalogo azioni critiche e audit esteso

### Obiettivo

Rendere sistematica la tracciabilita di tutta la superficie daemon.

### Problema attuale

Gli eventi principali esistono, ma manca ancora:

- catalogo formale degli eventi
- copertura omogenea per endpoint read-only rilevanti
- classificazione delle operazioni per rischio

### Intervento tecnico previsto

Definizioni:

- catalogo centralizzato `daemon event catalog`
- classificazione:
  - `read_sensitive`
  - `write_reversible`
  - `write_irreversible`
  - `security_event`

Backend:

- audit per endpoint read-only critici come:
  - lettura config tenant
  - lettura users tenant
  - lettura roles tenant
  - lettura diagnostics
  - lettura audit

Frontend:

- visualizzazione severita evento in audit viewer
- filtri per scope, tenant, tipo evento, severita

### Output atteso

- audit daemon esteso e classificato
- catalogo eventi difendibile

### Criteri di chiusura

- ogni endpoint daemon critico ha un evento audit definito
- esiste una mappa ufficiale evento -> severita -> reversibilita

## Fase 14. Strumenti amministrativi avanzati

### Obiettivo

Introdurre i moduli avanzati previsti dal piano originario ma non ancora implementati.

### Ambiti da coprire

- manutenzione dati
- operazioni correttive multi-tenant
- pannello di supporto tecnico avanzato
- strumenti di manutenzione amministrativa

### Intervento tecnico previsto

Moduli possibili:

- job viewer tecnico
- strumenti di reindex/backfill controllato
- ispezione incoerenze tenant
- azioni correttive con preview e conferma forte
- pannello supporto con query diagnostiche predefinite

Vincoli:

- ogni operazione deve dichiarare se e':
  - sola lettura
  - reversibile
  - irreversibile
- per le operazioni irreversibili serve doppia conferma forte
- tutte le operazioni devono essere auditabili

### Output atteso

- moduli avanzati daemon separati dalla governance base

### Criteri di chiusura

- esiste almeno un primo set di strumenti tecnici reali utilizzabili da supporto o amministrazione

## Fase 15. Validazione reale ambiente, test automatici e E2E

### Obiettivo

Passare da validazione strutturale locale a validazione ingegneristica piena.

### Problema attuale

Oggi esistono:

- lint
- build frontend
- controlli sintattici backend

Mancano invece:

- test automatici backend
- test automatici frontend
- scenari E2E daemon
- validazione con PostgreSQL reale e account daemon reale

### Intervento tecnico previsto

Backend:

- test su auth daemon
- test su hardening policy
- test su audit platform
- test su endpoint `/api/daemon`

Frontend:

- test UI per `/daemon/login`
- test console daemon base
- test conferme scrittura

E2E:

- login daemon corretto
- blocco token tenant su endpoint daemon
- blocco accesso daemon se policy ambiente lo vieta
- update config tenant con audit
- update feature tenant con audit
- logout daemon

### Output atteso

- suite minima automatica backend/frontend
- checklist E2E daemon
- report test ambiente reale

### Criteri di chiusura

- il perimetro daemon e' validato in modo ripetibile
- esiste evidenza tecnica dei principali scenari di sicurezza e funzionamento

## 6. Ordine di esecuzione consigliato

Ordine pragmatico:

1. Fase 9 bootstrap account daemon
2. Fase 10 accesso forte e MFA
3. Fase 11 gestione completa utenti tenant
4. Fase 12 gestione completa ruoli e assegnazioni
5. Fase 13 catalogo audit esteso
6. Fase 14 strumenti amministrativi avanzati
7. Fase 15 test automatici ed E2E reali

## 7. Note di implementazione

Per mantenere coerenza col lavoro gia svolto:

- non riportare `daemon` dentro il modello tenant standard
- mantenere namespace `/api/daemon`
- mantenere sessione frontend separata
- mantenere audit di piattaforma separato da quello tenant
- evitare strumenti distruttivi senza hardening e audit prima

## 8. Risultato atteso dopo questo piano

Alla fine del presente piano di completamento HALO avra':

- console daemon architetturalmente separata
- accesso forte e bootstrap gestito
- governance completa su tenant, utenti, ruoli e permessi
- audit sistematico dell'area tecnica
- strumenti avanzati di supporto e manutenzione
- validazione tecnica reale e ripetibile
