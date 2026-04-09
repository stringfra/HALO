# PIANO ESTENSIONI DAEMON COLORI LABEL LOGS HALO

## 1. Obiettivo

Estendere la console `daemon` per coprire tre esigenze operative aggiuntive:

1. permettere a `daemon` di modificare il colore principale di un'attivita tramite RGB
2. affiancare ai nomi tecnici di feature e permessi un nome semplice, sintetico e leggibile anche da utenti non tecnici
3. separare la consultazione dei log in una sezione dedicata della dashboard `daemon`

Il piano e' adattato al progetto reale HALO, che oggi usa:

- dominio agenda / appuntamenti sotto `appointments`
- feature flags con chiavi tipo `agenda.enabled`
- permessi con chiavi tipo `appointments.read`
- audit unificato oggi mostrato dentro la console principale

## 2. Stato attuale rilevato

### Agenda / attivita

Nel progetto esiste il dominio appuntamenti:

- backend: `backend/src/routes/appuntamenti.routes.js`
- frontend: `frontend/src/features/agenda/*`

Non emerge oggi un modello esplicito di "colore principale attivita" governato da `daemon`.

### Cataloghi tecnici

La console `daemon` espone ancora cataloghi puramente tecnici:

- `feature_catalog` con chiavi tipo `agenda.enabled`
- `permission_catalog` con chiavi tipo `appointments.read`
- ruoli con array `permissions`

Questo e' corretto per debugging ma poco leggibile per utenti non tecnici.

### Log

I log sono gia disponibili via audit unificato, ma sono mostrati nella stessa vista della dashboard `daemon`, non in una sezione dedicata e distinta.

## 3. Principi di implementazione

- non rompere i codici tecnici esistenti
- non sostituire i nomi tecnici con i nomi semplici: devono convivere
- mantenere `daemon` separato dagli endpoint tenant standard
- tutte le scritture devono restare auditabili
- le informazioni visuali e i metadati leggibili devono essere centralizzati, non duplicati in piu punti UI

## 4. Fasi di lavoro

## Fase 1. Definizione modello colore attivita

### Obiettivo

Definire dove vive il colore principale dell'attivita e come `daemon` lo governa.

### Decisione tecnica consigliata

Usare un campo esplicito RGB per il dominio appuntamenti/attivita, senza mischiarlo con il branding tenant.

Opzioni realistiche:

1. campo dedicato nella configurazione tenant:
   - `settings_json.activities.primary_rgb`
2. configurazione feature:
   - `tenant_features.config_json` per una feature agenda
3. tabella dedicata futura se il colore diventasse per-tipo-attivita

### Scelta consigliata per HALO

Per il progetto attuale la soluzione piu pragmatica e':

- memorizzare il colore in `settings_json`
- esporlo in `daemon` come sotto-sezione del config editor o come pannello dedicato agenda

Motivo:

- evita migrazioni strutturali immediate
- mantiene la modifica cross-tenant semplice
- e' coerente con il perimetro gia esistente del tenant config editor daemon

### Output atteso

- chiave ufficiale, ad esempio `settings.activities.primary_rgb`
- formato ufficiale del valore
- regole di validazione RGB

### Criteri di chiusura

- esiste una sorgente dati univoca per il colore attivita
- il formato e' validato server-side

## Fase 2. Backend daemon per modifica colore attivita RGB

### Obiettivo

Permettere a `daemon` di leggere e modificare il colore principale dell'attivita.

### Intervento tecnico previsto

Backend:

- estendere `GET /api/daemon/tenants/:tenantId/config`
- estendere `PUT /api/daemon/tenants/:tenantId/config`

oppure introdurre route dedicate:

- `GET /api/daemon/tenants/:tenantId/activities/style`
- `PUT /api/daemon/tenants/:tenantId/activities/style`

### Validazioni richieste

Accettare solo RGB esplicito con schema chiaro.

Formato consigliato:

- oggetto:
  - `r`
  - `g`
  - `b`

con vincoli:

- interi
- minimo `0`
- massimo `255`

Esempio:

```json
{
  "primary_rgb": {
    "r": 15,
    "g": 118,
    "b": 110
  }
}
```

### Audit richiesto

- `daemon.activity_style.read`
- `daemon.activity_style.updated`

Classificazione consigliata:

- read: `read_sensitive`
- update: `write_reversible`

### Output atteso

- endpoint daemon scrivibile per il colore attivita
- validazione RGB rigorosa

### Criteri di chiusura

- `daemon` puo' modificare il colore via RGB
- il valore viene persistito in modo consistente

## Fase 3. Integrazione frontend agenda con il colore attivita

### Obiettivo

Fare in modo che il colore configurato da `daemon` venga effettivamente usato nel frontend agenda.

### Intervento tecnico previsto

Frontend tenant:

- leggere il colore attivita dal bootstrap tenant o dalla config agenda
- applicarlo ai componenti di agenda / calendar

Punti probabili da toccare:

- `frontend/src/features/agenda/agenda-calendar.tsx`
- `frontend/src/features/bootstrap/api.ts`
- eventuale normalizzazione del payload tenant branding/config

### Strategia consigliata

Separare:

- branding tenant generale
- stile operativo agenda / attivita

Quindi:

- non riusare `brand_primary_color`
- introdurre un mapping esplicito per il colore attivita

### Output atteso

- il colore modificato da `daemon` impatta davvero l'interfaccia agenda

### Criteri di chiusura

- il cambiamento si vede in agenda senza refresh applicativo anomalo
- il fallback e' definito se il valore non esiste

## Fase 4. Catalogo label semplici per feature e permessi

### Obiettivo

Affiancare ai nomi tecnici un nome semplice e comprensibile.

### Requisito importante

Non serve una descrizione lunga.

Serve un nome breve, ad esempio:

- `appointments.read` -> `Leggere appuntamenti`
- `appointments.write` -> `Gestire appuntamenti`
- `agenda.enabled` -> `Agenda`

### Intervento tecnico previsto

Creare un catalogo centralizzato, ad esempio:

- `backend/src/config/daemon-readable-catalog.js`

Con strutture distinte:

- feature key -> simple name
- permission key -> simple name
- eventuale entity key -> simple name

### Forma consigliata

```js
{
  features: {
    "agenda.enabled": {
      simple_name: "Agenda"
    }
  },
  permissions: {
    "appointments.read": {
      simple_name: "Leggere appuntamenti"
    }
  }
}
```

### Output atteso

- una fonte unica per i nomi leggibili

### Criteri di chiusura

- la nomenclatura semplice non e' duplicata in piu componenti

## Fase 5. Estensione API daemon con doppia nomenclatura

### Obiettivo

Far arrivare al frontend sia il nome tecnico sia il nome semplice.

### Intervento tecnico previsto

Estendere i payload di:

- `feature_catalog`
- `permission_catalog`
- ruoli con `permissions`

Invece di restituire solo stringhe, restituire oggetti strutturati.

Esempio feature:

```json
{
  "feature_key": "agenda.enabled",
  "simple_name": "Agenda"
}
```

Esempio permission:

```json
{
  "permission_key": "appointments.read",
  "simple_name": "Leggere appuntamenti"
}
```

### Compatibilita

Per ridurre regressioni si puo' procedere in due modi:

1. mantenere i campi attuali e aggiungere metadati paralleli
2. migrare direttamente a payload strutturati aggiornando il frontend daemon nello stesso step

### Scelta consigliata

Per HALO conviene:

- aggiungere metadati paralleli in una prima fase
- migrare poi il rendering frontend

### Output atteso

- API daemon ricche ma retrocompatibili

### Criteri di chiusura

- il frontend puo' mostrare sia codice tecnico sia nome semplice

## Fase 6. UI daemon con doppia lettura tecnica + semplice

### Obiettivo

Rendere config editor, feature manager, permission catalog e ruoli piu leggibili.

### Intervento tecnico previsto

Aggiornare:

- `frontend/src/app/daemon/console/page.tsx`
- `frontend/src/features/daemon-console/api.ts`

Per mostrare, nello stesso elemento UI:

- codice tecnico
- nome semplice

Esempi di resa:

- `Agenda` / `agenda.enabled`
- `Leggere appuntamenti` / `appointments.read`

### Regola UX consigliata

- nome semplice come testo principale
- codice tecnico come secondaria visibile

Questo preserva:

- leggibilita per utenti non tecnici
- precisione per troubleshooting tecnico

### Output atteso

- feature manager comprensibile
- permission catalog comprensibile
- ruoli e permessi leggibili senza perdere precisione

### Criteri di chiusura

- nessuna sezione mostra solo chiavi tecniche nude

## Fase 7. Sezione log separata nella dashboard daemon

### Obiettivo

Spostare la consultazione log in una sezione dedicata, visibile e distinta.

### Intervento tecnico previsto

Frontend:

- estrarre l'attuale audit viewer dalla dashboard principale
- introdurre una sezione dedicata, ad esempio:
  - tab interna `Logs`
  - route dedicata `/daemon/logs`
  - pannello separato nella console con navigazione chiara

### Scelta consigliata per HALO

La soluzione piu pulita e':

- route dedicata `/daemon/logs`

Motivi:

- separa davvero i log dalla dashboard operativa
- rende i log raggiungibili con URL stabile
- evita una dashboard `daemon` eccessivamente densa

### Backend

Le API audit possono restare le stesse:

- `GET /api/daemon/audit`

eventualmente estese con filtri server-side successivi.

### Output atteso

- sezione log separata e riconoscibile

### Criteri di chiusura

- i log non sono piu mischiati con overview, config e supporto tecnico

## Fase 8. Rifinitura logs UI e filtri operativi

### Obiettivo

Rendere la nuova sezione log utile nel lavoro quotidiano.

### Intervento tecnico previsto

UI log dedicata con:

- filtri per scope
- filtri per severita
- filtri per tipo evento
- filtro tenant
- eventuale filtro testo per `action_key`

Opzionale ma utile:

- link rapido dal log al tenant coinvolto
- badge per azioni RGB attivita
- badge per modifiche config / feature / permessi

### Output atteso

- schermata log separata, leggibile e filtrabile

### Criteri di chiusura

- un operatore daemon puo' usare i log senza passare dalla dashboard principale

## Fase 9. Audit e QA finale delle nuove estensioni

### Obiettivo

Chiudere le estensioni con verifiche coerenti.

### Verifiche richieste

Backend:

- validazione RGB
- persistenza colore attivita
- payload cataloghi con nomi semplici
- audit modifica colore attivita

Frontend:

- visualizzazione doppia nome semplice + codice tecnico
- agenda che rispetta il colore configurato
- route o sezione log separata funzionante

### Scenari E2E minimi

1. `daemon` modifica il colore attivita via RGB
2. l'agenda tenant riflette il nuovo colore
3. feature manager mostra `Agenda` e `agenda.enabled`
4. permission catalog mostra `Leggere appuntamenti` e `appointments.read`
5. i log sono consultabili in sezione separata
6. la modifica colore attivita e' auditata

### Output atteso

- nuova estensione daemon validata end-to-end

## 5. File/moduli probabilmente impattati

Backend:

- `backend/src/routes/daemon.routes.js`
- `backend/src/services/daemon-console.service.js`
- `backend/src/config/multi-sector.js`
- nuovo catalogo leggibile:
  - `backend/src/config/daemon-readable-catalog.js`
- eventuale validazione tenant config:
  - `backend/src/services/tenant-settings-validation.service.js`

Frontend daemon:

- `frontend/src/features/daemon-console/api.ts`
- `frontend/src/app/daemon/console/page.tsx`
- eventuale nuova pagina:
  - `frontend/src/app/daemon/logs/page.tsx`

Frontend tenant:

- `frontend/src/features/agenda/agenda-calendar.tsx`
- `frontend/src/features/bootstrap/api.ts`

## 6. Ordine consigliato

Ordine pragmatico:

1. Fase 1 modello colore attivita
2. Fase 2 backend RGB daemon
3. Fase 4 catalogo label semplici
4. Fase 5 estensione API
5. Fase 6 aggiornamento UI cataloghi
6. Fase 3 integrazione agenda colore
7. Fase 7 sezione log separata
8. Fase 8 filtri log
9. Fase 9 QA finale

## 7. Risultato atteso finale

Alla fine di questo piano HALO avra':

- configurazione daemon del colore attivita via RGB
- cataloghi tecnici leggibili anche da utenti non informatici
- sezione log separata e dedicata nella console daemon
- audit coerente delle nuove operazioni
