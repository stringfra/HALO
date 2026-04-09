# Specifica Tecnica: Pagina Fatture da Incassare

## 1. Obiettivo

L'obiettivo è introdurre in HALO una vista dedicata alle fatture non pagate, raggiungibile sia dalla dashboard sia dalla sezione fatture.

Il risultato atteso è il seguente:

1. nella card `Raccolta fatture` della dashboard deve essere presente un bottone che apre la pagina dedicata;
2. nella sezione `Fatture` deve essere presente un bottone equivalente;
3. la nuova pagina deve mostrare tutte e sole le fatture con stato `da_pagare`;
4. la pagina deve includere un riepilogo operativo con indicatori economici e quantitativi coerenti con la lista mostrata.

## 2. Stato Attuale

### Frontend

- [frontend/src/app/dashboard/page.tsx](/Users/francescostrano/Desktop/HALO/frontend/src/app/dashboard/page.tsx)
  La dashboard mostra una card `Raccolta fatture` con KPI sintetici, ma non offre una navigazione diretta verso una vista completa degli insoluti.
- [frontend/src/app/fatture/page.tsx](/Users/francescostrano/Desktop/HALO/frontend/src/app/fatture/page.tsx)
  La pagina fatture monta solo il componente principale di gestione.
- [frontend/src/features/fatture/fatture-creator.tsx](/Users/francescostrano/Desktop/HALO/frontend/src/features/fatture/fatture-creator.tsx)
  La lista fatture contiene sia fatture pagate sia non pagate, ma non esiste una pagina focalizzata sugli insoluti.
- [frontend/src/features/fatture/api.ts](/Users/francescostrano/Desktop/HALO/frontend/src/features/fatture/api.ts)
  Esiste `listFatture()`, ma non un metodo specializzato per filtrare gli insoluti lato backend.

### Backend

- [backend/src/routes/fatture.routes.js](/Users/francescostrano/Desktop/HALO/backend/src/routes/fatture.routes.js)
  L'endpoint `GET /fatture` restituisce l'intero elenco fatture dello studio senza filtro specifico per stato.

## 3. Problema Tecnico

L'utente oggi deve ricavare manualmente gli insoluti dalla lista completa fatture.

Questo produce tre problemi:

1. la dashboard espone il dato aggregato ma non l'azione operativa immediata;
2. la sezione fatture non offre una vista concentrata sul recupero crediti;
3. il riepilogo degli insoluti non è persistente in una pagina dedicata e riusabile.

## 4. Soluzione Target

La soluzione corretta è introdurre una pagina dedicata alle fatture da incassare, con route frontend autonoma e con supporto dati coerente.

### 4.1 Route frontend target

La nuova pagina deve essere raggiungibile tramite:

- `/fatture/da-incassare`

Scelta consigliata:

- usare una route figlia della sezione fatture, per mantenere coerenza semantica e struttura di navigazione.

### 4.2 Contenuto minimo della pagina

La pagina deve contenere:

1. titolo esplicito, ad esempio `Fatture da incassare`;
2. riepilogo KPI;
3. tabella completa delle fatture `da_pagare`;
4. accesso rapido al dettaglio operativo della fattura, se presente nel flusso attuale;
5. eventuali CTA secondarie come `Apri fatture` o `Torna alla dashboard`.

### 4.3 KPI richiesti nella pagina

Il riepilogo deve includere almeno:

1. `Totale da incassare`
2. `Numero fatture non pagate`
3. opzionale ma consigliato: `Importo medio per fattura aperta`

Formule:

- `totale_da_incassare = SUM(importo) WHERE stato = 'da_pagare'`
- `fatture_non_pagate = COUNT(*) WHERE stato = 'da_pagare'`
- `importo_medio = totale_da_incassare / fatture_non_pagate`

### 4.4 Campi tabella richiesti

La tabella della nuova pagina deve includere almeno:

1. `ID fattura`
2. `Paziente`
3. `Data`
4. `Importo`
5. `Stato`
6. `Stripe status` o stato pagamento esterno, se utile al recupero operativo
7. `Azioni`

Azioni consigliate:

- apri link Stripe se disponibile;
- copia link Stripe se disponibile;
- segna come pagata se consentito dal flusso già implementato;
- eventuale filtro rapido o ordinamento per data/importo.

## 5. Scelta Architetturale

La soluzione consigliata è introdurre un componente frontend dedicato e, in parallelo, estendere l'API fatture con filtro per stato.

### Opzione A: filtro lato frontend riusando `listFatture()`

Vantaggi:

- modifica più veloce;
- nessuna nuova query backend;
- impatto minimo sull'API.

Limiti:

- trasferisce anche fatture pagate non necessarie;
- la pagina dedicata dipende da filtraggio client-side;
- meno efficiente se il numero di fatture cresce.

### Opzione B: filtro lato backend su `GET /fatture`

Vantaggi:

- payload ridotto;
- semantica più corretta;
- base più solida per pagination, export e ricerca futura.

Scelta consigliata:

- introdurre supporto querystring su `GET /fatture?stato=da_pagare`

## 6. Modifiche Backend

## 6.1 Route `GET /fatture`

File coinvolto:

- [backend/src/routes/fatture.routes.js](/Users/francescostrano/Desktop/HALO/backend/src/routes/fatture.routes.js)

Modifiche richieste:

1. leggere `req.query.stato`;
2. ammettere solo valori presenti in `allowedStates`;
3. applicare filtro opzionale sulla query SQL;
4. mantenere comportamento attuale quando il filtro non è presente.

Query concettuale:

```sql
SELECT f.id,
       f.paziente_id,
       p.nome,
       p.cognome,
       f.importo,
       f.stato,
       TO_CHAR(f.data, 'DD MM YYYY') AS data,
       f.stripe_session_id,
       f.stripe_payment_link,
       f.stripe_status,
       f.stripe_generated_at
FROM fatture f
LEFT JOIN pazienti p
  ON p.id = f.paziente_id
 AND p.studio_id = f.studio_id
WHERE f.studio_id = $1
  AND ($2::text IS NULL OR f.stato = $2::text)
ORDER BY f.data DESC, f.id DESC;
```

### Validazioni richieste

- se `stato` è presente ma non valido, restituire `400`;
- `ADMIN` e `SEGRETARIO` mantengono accesso;
- il filtro deve rimanere scoped per `studio_id`.

## 6.2 Evoluzione API frontend

File coinvolto:

- [frontend/src/features/fatture/api.ts](/Users/francescostrano/Desktop/HALO/frontend/src/features/fatture/api.ts)

Modifiche consigliate:

1. estendere `listFatture` con parametro opzionale:

```ts
listFatture({ stato?: "da_pagare" | "pagata" })
```

2. serializzare il filtro in querystring;
3. mantenere compatibilità con le chiamate esistenti.

## 7. Modifiche Frontend

## 7.1 Nuova route applicativa

File da introdurre:

- [frontend/src/app/fatture/da-incassare/page.tsx](/Users/francescostrano/Desktop/HALO/frontend/src/app/fatture/da-incassare/page.tsx)

Responsabilità:

- montare il componente della nuova pagina;
- mantenere il pattern già usato nelle altre route `app`.

## 7.2 Nuovo componente pagina insoluti

File da introdurre:

- [frontend/src/features/fatture/fatture-da-incassare.tsx](/Users/francescostrano/Desktop/HALO/frontend/src/features/fatture/fatture-da-incassare.tsx)

Responsabilità:

1. caricare solo fatture `da_pagare`;
2. calcolare KPI di riepilogo;
3. mostrare tabella completa;
4. mostrare stato loading, empty state ed error state;
5. riutilizzare il linguaggio visivo già presente in dashboard/fatture.

### Stato dati suggerito

```ts
const [fatture, setFatture] = useState<FatturaListItem[]>([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);
```

### Computed values suggeriti

```ts
const totaleDaIncassare = useMemo(
  () => fatture.reduce((sum, item) => sum + Number(item.importo), 0),
  [fatture],
);

const numeroFattureNonPagate = fatture.length;

const importoMedio = useMemo(
  () => (fatture.length > 0 ? totaleDaIncassare / fatture.length : 0),
  [fatture, totaleDaIncassare],
);
```

## 7.3 Bottone nella dashboard

File coinvolto:

- [frontend/src/app/dashboard/page.tsx](/Users/francescostrano/Desktop/HALO/frontend/src/app/dashboard/page.tsx)

Modifica richiesta:

- aggiungere nella card `Raccolta fatture` un bottone/link verso `/fatture/da-incassare`

Comportamento target:

- bottone visibile solo quando `canViewInvoiceData === true`
- label consigliata: `Vedi da incassare`

Posizionamento consigliato:

- sotto l'elenco riepilogativo della card oppure nell'header della card.

## 7.4 Bottone nella sezione fatture

File coinvolto:

- [frontend/src/features/fatture/fatture-creator.tsx](/Users/francescostrano/Desktop/HALO/frontend/src/features/fatture/fatture-creator.tsx)

Modifica richiesta:

- aggiungere un bottone/link verso `/fatture/da-incassare`

Posizionamento consigliato:

- nella testata del pannello principale;
- in alternativa vicino al titolo `Lista fatture`.

Label consigliata:

- `Apri da incassare`

## 7.5 Riepilogo della nuova pagina

La pagina `Fatture da incassare` deve esporre almeno tre blocchi:

1. `Totale da incassare`
2. `Fatture non pagate`
3. `Importo medio`

Formato importi:

- usare lo stesso `currencyFormatter` già presente nella dashboard.

## 7.6 Empty state

Se non esistono fatture aperte, la pagina deve mostrare:

1. messaggio esplicito: `Nessuna fattura da incassare`;
2. KPI a zero;
3. eventuale link di ritorno a `/fatture`.

## 8. Requisiti UX

La nuova pagina deve essere chiaramente leggibile come vista operativa, non come semplice duplicazione della sezione fatture.

Requisiti:

1. titolo coerente con la funzione gestionale;
2. indicatori sintetici in alto;
3. lista leggibile e scansionabile rapidamente;
4. coerenza con badge, bottoni e tabella già presenti nel progetto;
5. mobile-friendly senza perdita di leggibilità.

## 9. Piano di Implementazione per Fasi

## Fase 1. Estensione API fatture

Obiettivo:

- supportare il filtro `stato=da_pagare`

Attività:

1. aggiornare [backend/src/routes/fatture.routes.js](/Users/francescostrano/Desktop/HALO/backend/src/routes/fatture.routes.js);
2. validare querystring `stato`;
3. aggiornare [frontend/src/features/fatture/api.ts](/Users/francescostrano/Desktop/HALO/frontend/src/features/fatture/api.ts) con parametro opzionale.

Deliverable:

- `GET /fatture?stato=da_pagare` funzionante.

## Fase 2. Nuova pagina `Fatture da incassare`

Obiettivo:

- rendere disponibile una vista autonoma degli insoluti.

Attività:

1. creare [frontend/src/app/fatture/da-incassare/page.tsx](/Users/francescostrano/Desktop/HALO/frontend/src/app/fatture/da-incassare/page.tsx);
2. creare [frontend/src/features/fatture/fatture-da-incassare.tsx](/Users/francescostrano/Desktop/HALO/frontend/src/features/fatture/fatture-da-incassare.tsx);
3. implementare KPI e tabella;
4. gestire loading, errore, empty state.

Deliverable:

- pagina navigabile con elenco completo delle fatture non pagate.

## Fase 3. Integrazione navigazione dashboard

Obiettivo:

- collegare il riepilogo dashboard alla vista operativa.

Attività:

1. aggiornare [frontend/src/app/dashboard/page.tsx](/Users/francescostrano/Desktop/HALO/frontend/src/app/dashboard/page.tsx);
2. aggiungere bottone `Vedi da incassare`;
3. verificare visibilità per ruoli corretti.

Deliverable:

- accesso diretto dalla card `Raccolta fatture`.

## Fase 4. Integrazione navigazione sezione fatture

Obiettivo:

- rendere raggiungibile la vista insoluti anche dal modulo fatture.

Attività:

1. aggiornare [frontend/src/features/fatture/fatture-creator.tsx](/Users/francescostrano/Desktop/HALO/frontend/src/features/fatture/fatture-creator.tsx);
2. aggiungere bottone `Apri da incassare`;
3. verificare coerenza visiva e posizionamento.

Deliverable:

- accesso diretto dalla sezione fatture.

## Fase 5. Hardening e test

Obiettivo:

- validare il comportamento end-to-end.

Checklist:

1. verifica che dashboard e sezione fatture aprano correttamente `/fatture/da-incassare`;
2. verifica che la nuova pagina mostri solo fatture con `stato = 'da_pagare'`;
3. verifica che `Totale da incassare` coincida con la somma degli importi esposti;
4. verifica che `Fatture non pagate` coincida col numero righe della lista;
5. verifica empty state con zero fatture aperte;
6. verifica permessi per `ADMIN` e `SEGRETARIO`;
7. verifica responsive su viewport desktop e mobile.

## 10. Estensioni Future

Evoluzioni compatibili con questa architettura:

1. filtri per data, paziente, importo e stato Stripe;
2. ordinamento persistente;
3. esportazione CSV/PDF delle fatture aperte;
4. pagination server-side;
5. invio massivo reminder sulle fatture da incassare.

## 11. Decisione Raccomandata

La soluzione raccomandata è:

1. introdurre filtro backend `GET /fatture?stato=da_pagare`;
2. creare route frontend `/fatture/da-incassare`;
3. aggiungere bottone sia in dashboard sia nella sezione fatture;
4. costruire la nuova pagina come vista operativa dedicata agli insoluti.

Questa impostazione è specifica, estendibile e coerente con la struttura attuale del progetto HALO.
