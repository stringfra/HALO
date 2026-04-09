# Creazione Tenant Daemon Fase 8

Data: `04 Aprile 2026`
Stato: `completata`

## Obiettivo

Definire l'esperienza UI della creazione tenant da console `daemon`, in modo leggibile, guidato e coerente con la criticita' dell'operazione.

## Principio guida

La creazione tenant non deve essere trattata come un piccolo form laterale dentro la console attuale.

E' un workflow ad alta responsabilita' che richiede:

- concentrazione
- validazioni progressive
- riepilogo finale
- conferma esplicita

## Scelta UX consigliata

Scelta consigliata:

- usare una route dedicata

Percorso suggerito:

- `/daemon/tenants/new`

Motivo:

- evita di appesantire la dashboard daemon principale
- separa la creazione azienda dalla gestione tenant esistenti
- consente un wizard a step con URL stabile
- riduce errori da contesto misto tra modifica tenant esistente e creazione tenant nuovo

## Scelta alternativa sconsigliata

Meno consigliato:

- inserire il workflow come pannello dentro `/daemon/console`

Rischi:

- UI troppo densa
- conflitto visivo con config editor tenant esistente
- piu difficile gestire bozza, validazioni e riepilogo

## Collocazione nella console daemon

Nella console attuale e' opportuno aggiungere solo:

- CTA chiara `Nuova azienda`
- link alla route dedicata
- eventuale testo breve di spiegazione

Il workflow vero e proprio deve vivere fuori dalla dashboard principale.

## Struttura del wizard consigliata

Wizard a 4 step:

1. Dati azienda
2. Vertical e impostazioni iniziali
3. Admin iniziale
4. Riepilogo e conferma

## Step 1. Dati azienda

Campi mostrati:

- `code`
- `tenant_name`
- `display_name`
- `business_name`

Obiettivo UI:

- raccogliere identita' principale del tenant
- chiarire differenza tra nome tecnico e nome visualizzato

Validazioni client minime:

- campi obbligatori
- trim automatico
- anteprima slug per `code`

## Step 2. Vertical e impostazioni iniziali

Campi mostrati:

- `vertical_key`
- `locale`
- `timezone`

Contenuti utili da mostrare:

- nome leggibile del vertical
- breve descrizione del vertical scelto
- riepilogo non editabile dei moduli previsti

Obiettivo UI:

- rendere esplicito che il vertical determina il bootstrap iniziale

## Step 3. Admin iniziale

Campi mostrati:

- `admin.name`
- `admin.email`
- `admin.password`

Contenuti utili da mostrare:

- nota sulla password forte richiesta
- nota che l'utente verra' creato come `ADMIN`
- nota che potra' accedere subito al tenant

Obiettivo UI:

- chiarire che questo utente e' il primo accesso operativo del tenant

## Step 4. Riepilogo e conferma

Questo step e' obbligatorio.

Deve mostrare in modo leggibile:

- azienda che verra' creata
- codice tenant
- vertical scelto
- locale e timezone
- admin iniziale
- bootstrap previsto

Bootstrap previsto da mostrare in forma sintetica:

- ruoli di sistema iniziali
- moduli/feature derivati dal vertical
- tenant attivo e pronto al bootstrap

## Conferma finale

La conferma finale deve essere esplicita e piu forte di un semplice click.

Scelta consigliata:

- bottone finale `Crea azienda`
- `ConfirmDialog` con descrizione ad alta chiarezza
- motivazione tecnica obbligatoria lato request tramite header daemon

## Copy consigliato nella UI

Lessico da usare:

- `azienda` come testo principale
- `tenant` solo come label tecnica secondaria quando utile

Esempi:

- `Nuova azienda`
- `Codice tenant`
- `Admin iniziale`
- `Bootstrap azienda`

## Stati UI necessari

La schermata deve supportare almeno questi stati:

- bozza iniziale
- validazione locale con errori per campo
- invio in corso
- errore backend leggibile
- successo finale

## Stato di successo

Dopo creazione riuscita, la UI dovrebbe mostrare:

- tenant creato con successo
- codice tenant
- admin iniziale creato
- prossime azioni consigliate

Prossime azioni utili:

- aprire il tenant nella console daemon
- verificare config e feature
- consegnare credenziali in canale sicuro

## Stato di errore

Gli errori devono essere distinti tra:

- errori di campo
- conflitti applicativi
- errori interni

Esempi:

- `Codice tenant gia in uso`
- `Password admin non sufficientemente forte`
- `Vertical non supportato`
- `Errore nella creazione tenant da daemon`

## Navigazione post-successo consigliata

Scelta consigliata:

- non reindirizzare subito in modo automatico senza feedback

Meglio:

1. mostrare esito finale
2. offrire CTA:
   - `Apri azienda appena creata`
   - `Torna al registry tenant`
   - `Crea un'altra azienda`

## Componenti UI riusabili

La nuova schermata puo' riusare pattern gia' presenti:

- `ConfirmDialog`
- card/pannelli della console daemon
- stile dei form gia' usati nel config editor
- alert notice/error gia' presenti

## Decisioni prese in questa fase

- route dedicata consigliata
- wizard a 4 step
- riepilogo finale obbligatorio
- lessico UI centrato su `azienda`
- feedback finale esplicito prima di ogni redirect

## Output prodotto

- architettura UX del workflow
- collocazione schermata nella console
- step del wizard
- stati UI necessari
- regole di copy e conferma finale

## Prossimo passo

La fase successiva e':

- `Fase 9. Gestione errori e rollback`
