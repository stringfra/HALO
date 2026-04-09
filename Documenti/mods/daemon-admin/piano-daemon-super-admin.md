# PIANO DAEMON SUPER-ADMIN HALO

## 1. Obiettivo generale

L'obiettivo e' introdurre in HALO un account speciale di sistema chiamato `daemon`, con privilegi massimi su tutta la piattaforma, pensato per:

- amministrazione completa della base applicativa
- controllo globale di tenant, moduli, configurazioni e dati di governance
- accesso a una propria interfaccia dedicata
- isolamento dell'accesso rispetto all'interfaccia utente standard

L'interfaccia `daemon` dovra' essere accessibile solo tramite percorso dedicato:

- `localhost/daemon`

## 2. Obiettivo funzionale finale

Alla fine del lavoro il sistema dovra' permettere di:

1. autenticare un account speciale `daemon`
2. separare il suo accesso dal normale backend tenant-driven
3. fornire una UI dedicata solo per operazioni ad alta criticita'
4. garantire privilegi massimi e non limitati ai soli permessi tenant standard
5. proteggere l'accesso con regole piu' forti rispetto agli utenti normali
6. tracciare ogni azione critica eseguita da `daemon`

## 3. Principi architetturali

L'introduzione di `daemon` deve rispettare questi principi:

- `daemon` non e' un utente tenant normale
- `daemon` non deve dipendere dal modello autorizzativo standard pensato per operatori applicativi
- `daemon` deve essere trattato come identita' di piattaforma
- l'area `/daemon` deve essere chiaramente separata dalla UI applicativa normale
- tutte le azioni critiche devono essere auditabili
- ogni operazione pericolosa deve essere esplicita e difendibile

## 4. Ambito di potere del profilo daemon

L'account `daemon` dovra' avere controllo massimo almeno su:

- tenant
- configurazioni globali
- feature flags tenant
- branding tenant
- labels tenant
- permessi e ruoli
- vertical templates
- custom fields globali o tenant
- utenti e assegnazioni ruolo
- strumenti di diagnostica amministrativa
- audit log di piattaforma

Facoltativamente, in una fase successiva:

- manutenzione dati
- operazioni correttive multi-tenant
- pannello di supporto tecnico avanzato

## 5. Vincoli di sicurezza

L'introduzione di `daemon` non deve ridurre la sicurezza del sistema.

Vincoli obbligatori:

- accesso separato dalla normale UI autenticata
- route dedicate sotto `/daemon`
- middleware dedicato, non riuso ingenuo dei soli permessi tenant
- audit log obbligatorio per ogni operazione critica
- impossibilita' per utenti normali di elevare i privilegi a `daemon`
- protezione contro accesso accidentale o esposizione non voluta

Vincoli consigliati:

- allowlist locale o ambiente controllato
- credenziali o bootstrap iniziale gestito in modo esplicito
- eventuale MFA o secondo fattore in una fase successiva
- doppia conferma per operazioni distruttive

## 6. Obiettivo UX dell'interfaccia daemon

L'interfaccia `daemon` non deve essere una copia della UI operativa del gestionale.

Deve essere una console tecnica, dedicata a:

- configurazione tenant
- feature governance
- ruoli e permessi
- stato ambiente
- audit e diagnostica
- strumenti di manutenzione amministrativa

La UI `/daemon` deve risultare:

- separata concettualmente dal prodotto tenant
- orientata ad amministrazione e governo
- piu' sobria, leggibile e tecnica
- chiara nel distinguere azioni di sola lettura da azioni distruttive

## 7. Fasi di sviluppo

## Fase 1. Definizione del modello di identita' daemon

### Obiettivo

Definire cosa sia `daemon` nel sistema.

### Decisioni da formalizzare

- se `daemon` vive nella tabella `users` oppure in un modello separato
- se `daemon` e' associato a un tenant oppure e' globale
- se `daemon` usa JWT separati o claims dedicate
- come distinguere tecnicamente utente tenant e identita' di piattaforma

### Output atteso

- modello dati chiaro
- strategia di autenticazione chiara
- strategia di autorizzazione chiara

## Fase 2. Definizione del perimetro autorizzativo massimo

### Obiettivo

Stabilire esattamente cosa puo' fare `daemon`.

### Da definire

- elenco operazioni consentite
- operazioni vietate o protette ulteriormente
- regole di override sui tenant
- separazione tra poteri di lettura e poteri di scrittura

### Output atteso

- matrice privilegi `daemon`
- elenco endpoint/azioni da proteggere con middleware dedicato

## Fase 3. Progettazione sicurezza e accesso dedicato

### Obiettivo

Impostare il perimetro di accesso a `/daemon`.

### Da progettare

- entrypoint dedicato `localhost/daemon`
- route frontend dedicate
- route backend dedicate per la console daemon
- middleware `requireDaemon`
- sessione o token riconoscibili come contesto `daemon`

### Output atteso

- schema dei flussi di accesso
- policy di protezione dell'area daemon

## Fase 4. Progettazione backend della console daemon

### Obiettivo

Definire i servizi backend da esporre alla console.

### Moduli minimi previsti

- overview tenant
- gestione tenant config
- gestione tenant features
- gestione ruoli e permessi
- gestione utenti e assegnazioni ruolo
- lettura audit log
- diagnostica bootstrap e configurazione

### Output atteso

- mappa endpoint `/api/daemon/...`
- regole di protezione per ciascun endpoint

## Fase 5. Progettazione frontend dedicato `/daemon`

### Obiettivo

Definire la UI separata per l'amministrazione massima.

### Sezioni minime previste

- dashboard daemon
- tenant registry
- tenant config editor
- feature flags manager
- ruoli e permessi
- audit viewer
- strumenti diagnostici

### Output atteso

- sitemap della console daemon
- priorita' delle schermate

## Fase 6. Audit e tracciabilita' estesa

### Obiettivo

Tracciare in modo affidabile ogni azione di `daemon`.

### Da coprire

- login daemon
- cambio configurazione tenant
- cambio feature flags
- modifica ruoli
- modifica utenti privilegiati
- operazioni di governance

### Output atteso

- strategia audit specifica per daemon
- definizione eventi critici

## Fase 7. Hardening operativo

### Obiettivo

Ridurre il rischio introdotto da un profilo con poteri massimi.

### Misure previste

- warning espliciti in UI
- conferme per azioni sensibili
- limitazioni ambiente locale/staging/produzione
- differenziazione tra operazioni reversibili e irreversibili
- controllo rigoroso della visibilita' del pannello

### Output atteso

- checklist sicurezza operativa

## Fase 8. QA e validazione finale

### Obiettivo

Verificare che `daemon` funzioni senza rompere il modello multi-tenant.

### Scenari minimi

- accesso corretto a `/daemon`
- blocco accesso per utenti normali
- visibilita' completa dei tenant
- modifica feature tenant con audit
- modifica config tenant con audit
- verifica che la UI standard resti separata
- verifica che i tenant normali non possano raggiungere endpoint daemon

### Output atteso

- report QA dedicato
- elenco rischi residui

## 8. Decisioni tecniche chiave da prendere prima di implementare

Prima di scrivere codice vanno chiuse queste decisioni:

1. `daemon` globale o legato a un tenant tecnico
2. login condiviso con auth attuale o flusso separato
3. JWT standard con claim `is_daemon` o token completamente separato
4. audit log riusato o tabella audit dedicata
5. route backend mischiate all'admin tenant o namespace separato `/api/daemon`
6. UI daemon nello stesso frontend o shell separata

## 9. Strategia consigliata

La strategia piu' pulita, in base all'architettura gia' introdotta, e':

- trattare `daemon` come identita' di piattaforma separata
- usare namespace backend dedicato `/api/daemon`
- usare middleware dedicato
- costruire frontend dedicato su `/daemon`
- non riusare semplicemente `settings.manage` come se bastasse
- estendere l'audit con eventi specifici `daemon.*`

## 10. Cosa non fare

Per non indebolire il sistema bisogna evitare:

- creare `daemon` come semplice utente admin tenant standard
- esporre funzioni daemon dentro la UI normale
- affidarsi solo a un flag frontend per proteggere l'accesso
- introdurre privilegi massimi senza audit
- mescolare permessi daemon e permessi tenant senza separazione semantica

## 11. Definizione del risultato atteso

Il progetto puo' considerarsi arrivato all'obiettivo quando:

- esiste un'identita' `daemon` con privilegi massimi reali
- il suo accesso e' separato sotto `localhost/daemon`
- ha una propria interfaccia dedicata
- puo' governare tenant, features, ruoli, permessi e configurazioni
- ogni azione critica e' tracciata
- gli utenti normali non possono mai raggiungere le sue capacita'

## 12. Ordine di esecuzione consigliato

L'ordine corretto per arrivare all'obiettivo e':

1. chiudere il modello identita' e sicurezza
2. definire il perimetro privilegiato
3. progettare API e middleware dedicati
4. progettare la UI `/daemon`
5. implementare backend
6. implementare frontend
7. integrare audit e hardening
8. fare QA finale

## 13. Scopo del presente documento

Questo documento serve come base decisionale e tecnica per introdurre `daemon` senza fare scorciatoie architetturali.

Lo scopo non e' solo aggiungere un super-admin, ma costruire una console di governo della piattaforma coerente con l'obiettivo finale di HALO:

- piattaforma funzionante
- configurabile
- governabile
- estendibile
- sicura
