# PIANO CREAZIONE TENANT DAEMON HALO

## 1. Obiettivo

Introdurre in HALO la possibilita' di creare nuovi tenant dalla console `daemon`, con un workflow guidato, sicuro e coerente con l'architettura multi-tenant gia' esistente.

L'obiettivo non e' aggiungere una semplice `INSERT` nella tabella `studi`, ma costruire un flusso amministrativo completo che produca un tenant immediatamente operativo.

## 2. Obiettivo funzionale finale

Alla fine del lavoro il sistema dovra' permettere a un operatore `daemon` di:

1. creare un nuovo tenant dalla console
2. scegliere vertical, identita' base e impostazioni iniziali
3. bootstrapare automaticamente feature, labels, ruoli e configurazioni iniziali
4. creare il primo utente amministratore del tenant
5. tracciare l'operazione in audit platform e tenant
6. ottenere un tenant pronto per login, bootstrap e navigazione

## 3. Principi di implementazione

- la creazione tenant deve essere orchestrata come workflow unico
- il risultato finale deve essere consistente o completamente rollbackato
- il codice tenant deve essere stabile e univoco
- il vertical scelto deve guidare default di feature, labels e ruoli
- il primo admin tenant deve essere creato nello stesso flusso
- tutte le scritture devono essere auditabili
- la creazione tenant deve restare confinata alla console `daemon`

## 4. Normalizzazione lessico

Nel perimetro di questo piano e' importante evitare ambiguita' tra il lessico operativo del prodotto e il lessico piattaforma.

### Regola terminologica consigliata

Nel piano di creazione nuovi ambienti, i termini devono essere normalizzati cosi':

- `tenant` = entita' tecnica multi-tenant della piattaforma
- `azienda` = termine funzionale leggibile per l'utente
- `studio` = nome legacy gia' presente nel modello HALO attuale

### Regola pratica

Nel backend e nelle strutture dati puo' restare il termine tecnico o legacy:

- `tenant`
- `studio`

Nella UI daemon e nella documentazione operativa rivolta a utenti non tecnici e' invece consigliato usare come etichetta primaria:

- `azienda`

### Termine da evitare in questo piano

Il termine `attivita` non deve essere usato per indicare il tenant, perche' nel progetto HALO e' gia' semanticamente vicino a:

- agenda
- appuntamenti
- attivita operative
- styling agenda

Questo creerebbe ambiguita' con il piano colori/RGB delle attivita agenda.

### Obiettivo della normalizzazione

Il risultato atteso e':

- linguaggio tecnico coerente nel backend
- linguaggio chiaro nella UI daemon
- eliminazione dell'ambiguita' tra azienda tenant e attivita agenda

## 5. Stato attuale rilevato

Nel progetto esistono gia':

- registry tenant in `studi`
- bootstrap tenant dinamico
- vertical templates
- feature flags tenant
- configurazione tenant
- ruoli, permessi e utenti tenant
- console `daemon` con gestione tenant esistenti

Nel progetto non emerge oggi:

- una route `POST /api/daemon/tenants`
- un servizio orchestrato di creazione tenant
- una schermata UI dedicata a creazione nuovo tenant
- una procedura transazionale che inizializzi tenant + admin + ruoli di sistema

## 6. Perimetro funzionale minimo

Il workflow di creazione tenant dovrebbe coprire almeno:

- anagrafica tenant
- scelta vertical
- impostazioni locali base
- bootstrap configurazione iniziale
- creazione admin iniziale
- audit operazione

Fuori dal perimetro minimo iniziale:

- clonazione tenant esistente
- import massivo di tenant
- cancellazione tenant
- provisioning infrastrutturale esterno
- invio automatico email credenziali

## 7. Dati minimi da raccogliere

Campi consigliati per la prima versione:

- `code`
- `tenant_name`
- `display_name`
- `business_name`
- `vertical_key`
- `locale`
- `timezone`
- `admin_name`
- `admin_email`
- `admin_password`

Campi opzionali per una fase successiva:

- branding iniziale
- labels personalizzate iniziali
- feature override iniziali
- stato attivo/disattivo alla creazione

## 8. Fasi tecniche

## Fase 0. Allineamento terminologico tenant / azienda / studio

### Obiettivo

Allineare il linguaggio del progetto prima di introdurre la creazione nuova azienda da `daemon`.

### Da formalizzare

- usare `tenant` come termine tecnico backend
- usare `azienda` come termine principale nella UI daemon
- tollerare `studio` come termine legacy dove gia' presente nel modello dati
- evitare `attivita` come sinonimo di tenant

### Output atteso

- glossario minimo condiviso
- naming coerente per endpoint, documentazione e copy UI future

### Criteri di chiusura

- il piano usa lessico non ambiguo
- la futura UI non confonde tenant azienda con attivita agenda

## Fase 1. Definizione del contratto di creazione tenant

### Obiettivo

Definire in modo formale cosa significa "creare un tenant" in HALO.

### Da formalizzare

- entita' coinvolte nella creazione
- ordine delle operazioni
- dati obbligatori e opzionali
- vincoli di consistenza
- risultato minimo atteso di un tenant creato con successo

### Output atteso

- contratto funzionale della creazione tenant
- payload di input formale
- payload di output formale

### Criteri di chiusura

- esiste una definizione univoca del workflow
- e' chiaro quali record devono esistere a fine procedura

## Fase 2. Progettazione validazioni e regole di dominio

### Obiettivo

Definire le validazioni server-side necessarie prima di qualunque scrittura.

### Validazioni minime

- `code` obbligatorio, slug stabile, univoco
- `tenant_name` obbligatorio
- `display_name` obbligatorio
- `business_name` obbligatorio
- `vertical_key` valido e supportato
- `locale` valida
- `timezone` valida
- `admin_email` valida e non gia' usata nello stesso tenant
- `admin_password` forte

### Regole di dominio

- il codice tenant non dovrebbe essere modificabile liberamente dopo la creazione
- il primo admin deve essere creato come parte del workflow
- il tenant non deve uscire "vuoto" senza ruoli di sistema

### Output atteso

- matrice validazioni input
- regole di rifiuto esplicite

### Criteri di chiusura

- tutti i campi critici hanno regole chiare
- i casi di errore sono definiti prima dell'implementazione

## Fase 3. Progettazione servizio backend orchestrato

### Obiettivo

Definire un servizio applicativo unico che esegua la creazione tenant end-to-end.

### Strategia consigliata

Introdurre un servizio tipo:

- `createTenantFromDaemon(...)`

Responsabilita' del servizio:

- creare il record tenant base
- applicare vertical template
- inizializzare settings e labels
- inizializzare feature flags di default
- creare i ruoli di sistema
- creare il primo utente admin
- collegare l'admin ai ruoli corretti

### Requisito tecnico importante

La procedura deve essere transazionale.

Se un passaggio fallisce:

- rollback completo
- nessun tenant parziale lasciato nel database

### Output atteso

- disegno del servizio orchestratore
- elenco dipendenze e sottoservizi coinvolti

### Criteri di chiusura

- il flusso backend e' centralizzato
- non esistono creazioni spezzate su piu endpoint indipendenti

## Fase 4. Progettazione bootstrap iniziale del tenant

### Obiettivo

Definire cosa viene inizializzato automaticamente alla nascita del tenant.

### Da bootstrapare

- settings base
- labels base
- ruoli base
- permessi ruolo base
- feature flags risolte dal vertical
- eventuali override iniziali

### Scelta consigliata

Riutilizzare al massimo gli elementi gia' esistenti:

- `multi-sector`
- `vertical-templates`
- `tenant-config`
- `feature-flags`
- servizi ruoli/permessi esistenti

### Output atteso

- mappa di bootstrap iniziale tenant

### Criteri di chiusura

- un tenant nuovo puo' completare correttamente il bootstrap `/api/bootstrap`
- la navigazione risulta coerente con le feature attive

## Fase 5. Progettazione creazione admin iniziale

### Obiettivo

Definire il bootstrap del primo utente operativo del tenant.

### Requisiti minimi

- creazione utente con ruolo `ADMIN`
- password forte obbligatoria oppure generazione controllata
- assegnazione dei ruoli di sistema corretti
- utente immediatamente abilitato al login tenant

### Decisioni da prendere

- password inserita manualmente o generata
- obbligo di reset password al primo accesso oppure no
- eventuale invio credenziali fuori perimetro iniziale

### Output atteso

- specifica creazione admin iniziale

### Criteri di chiusura

- il tenant creato ha sempre almeno un amministratore operativo

## Fase 6. Definizione API daemon per creazione tenant

### Obiettivo

Definire l'endpoint di creazione dalla console daemon.

### Endpoint consigliato

- `POST /api/daemon/tenants`

### Protezioni richieste

- `requireDaemon`
- permesso `platform.tenants.write`
- write confirmation obbligatoria
- audit platform obbligatorio

### Payload esempio

```json
{
  "code": "studio-roma-centro",
  "tenant_name": "Studio Roma Centro",
  "display_name": "Roma Centro",
  "business_name": "Studio Dentistico Roma Centro",
  "vertical_key": "dental_clinic",
  "locale": "it-IT",
  "timezone": "Europe/Rome",
  "admin": {
    "name": "Mario Rossi",
    "email": "admin@studioromacentro.it",
    "password": "PasswordTemporaneaMoltoForte123!"
  }
}
```

### Output atteso

- endpoint unico di creazione tenant
- risposta che includa tenant creato e admin iniziale

### Criteri di chiusura

- la console daemon puo' creare un tenant con una sola operazione server-side

## Fase 7. Audit e tracciabilita' della creazione tenant

### Obiettivo

Garantire tracciabilita' forte della nascita di un tenant.

### Eventi audit consigliati

- `daemon.tenant.created`
- `daemon.tenant.bootstrap.completed`
- `daemon.tenant_admin.created`

### Dati audit utili

- tenant id
- tenant code
- vertical scelto
- daemon account che ha eseguito l'operazione
- motivazione conferma scrittura
- admin iniziale creato

### Output atteso

- catalogo eventi audit dedicato alla creazione tenant

### Criteri di chiusura

- ogni creazione tenant e' ricostruibile da audit

## Fase 8. Progettazione UI daemon di creazione tenant

### Obiettivo

Definire un'esperienza amministrativa leggibile e sicura.

### Scelta consigliata

Usare un wizard a step, non un form unico troppo denso.

Step consigliati:

1. Dati tenant
2. Vertical e impostazioni iniziali
3. Admin iniziale
4. Riepilogo e conferma

### Requisiti UI

- validazioni preliminari lato client
- riepilogo finale completo prima della scrittura
- doppia conferma testuale
- messaggio finale con tenant creato e prossimi passi

### Output atteso

- specifica UX della creazione tenant
- collocazione schermata nella console daemon

### Criteri di chiusura

- il workflow UI rende difficile creare tenant inconsistenti per errore umano

## Fase 9. Gestione errori e rollback

### Obiettivo

Definire in anticipo come trattare i fallimenti.

### Casi da coprire

- codice tenant duplicato
- vertical non valido
- errore nella creazione ruoli
- errore nella creazione admin
- errore nelle feature iniziali
- errore audit successivo alla scrittura

### Strategia consigliata

- transazione database per tutte le scritture core
- errori parlanti e specifici
- nessun tenant parziale persistito

### Output atteso

- matrice errori e rollback

### Criteri di chiusura

- i fallimenti non lasciano dati inconsistenti

## Fase 10. QA tecnica finale

### Obiettivo

Chiudere il workflow con verifiche realistiche.

### Verifiche backend

- creazione tenant valida
- rifiuto di `code` duplicato
- rollback su errore intermedio
- audit creato correttamente
- bootstrap tenant leggibile subito dopo la creazione

### Verifiche frontend

- wizard completabile
- validazioni client coerenti col backend
- riepilogo finale corretto
- stato finale leggibile

### Scenari E2E minimi

1. `daemon` crea un tenant valido
2. il tenant appare nel registry daemon
3. l'admin iniziale puo' autenticarsi
4. `/api/bootstrap` risponde correttamente per il nuovo tenant
5. la navigazione tenant e' coerente col vertical scelto
6. la creazione e' auditata

### Output atteso

- report finale di validazione del workflow

## 9. File/moduli probabilmente impattati

Backend:

- `backend/src/routes/daemon.routes.js`
- nuovo servizio applicativo dedicato alla creazione tenant
- `backend/src/services/daemon-console.service.js`
- `backend/src/services/tenant-config.service.js`
- `backend/src/services/feature-flags.service.js`
- servizi ruoli/permessi gia' presenti
- `backend/src/config/daemon-event-catalog.js`

Frontend:

- `frontend/src/app/daemon/console/page.tsx`
- `frontend/src/features/daemon-console/api.ts`
- eventuale nuova route dedicata:
  - `frontend/src/app/daemon/tenants/new/page.tsx`

## 10. Ordine consigliato

Ordine pragmatico:

1. Fase 0 allineamento terminologico
2. Fase 1 contratto di creazione
3. Fase 2 validazioni
4. Fase 3 servizio orchestrato backend
5. Fase 4 bootstrap iniziale tenant
6. Fase 5 admin iniziale
7. Fase 6 API daemon
8. Fase 7 audit
9. Fase 8 UI wizard
10. Fase 9 errori e rollback
11. Fase 10 QA finale

## 11. Risultato atteso finale

Alla fine di questo piano HALO avra':

- creazione tenant governata da console `daemon`
- workflow transazionale e auditabile
- bootstrap coerente con il modello multi-tenant esistente
- admin iniziale creato nello stesso flusso
- tenant subito operativo per login, bootstrap e navigazione
