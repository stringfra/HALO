# Creazione Tenant Daemon Fase 5

Data: `04 Aprile 2026`
Stato: `completata`

## Obiettivo

Definire in modo preciso come deve essere creato il primo amministratore operativo del nuovo tenant.

## Principio guida

Il primo admin tenant non e' un passaggio secondario o opzionale.

Nel perimetro di questo piano, il tenant non puo' essere considerato operativo se non nasce insieme a:

- un utente reale
- credenziali valide
- ruolo legacy coerente
- assegnazione RBAC coerente

## Modello dell'admin iniziale

L'admin iniziale deve nascere come utente tenant standard, non come identita' speciale.

Questo significa:

- record nella tabella `users`
- `studio_id` del nuovo tenant
- `ruolo = ADMIN`
- password hashata
- assegnazione al ruolo di sistema `ADMIN`

## Dati minimi richiesti

Campi minimi:

- `admin.name`
- `admin.email`
- `admin.password`

Nella prima versione non sono necessari:

- telefono
- recovery email
- MFA obbligatoria
- invio automatico credenziali

## Requisiti di validazione

Le regole dell'admin iniziale devono essere coerenti con quelle gia' usate nel progetto per la creazione utenti:

- nome obbligatorio
- email valida
- password forte
- ruolo obbligatorio `ADMIN`

La password deve rispettare la policy corrente del progetto:

- almeno 8 caratteri
- almeno una minuscola
- almeno una maiuscola
- almeno un numero
- almeno un simbolo
- nessuno spazio

## Strategia consigliata

Scelta consigliata per la prima versione:

- password inserita manualmente da `daemon`
- nessuna generazione automatica
- nessun invio email automatico
- nessun forced reset password al primo login nella prima iterazione

Motivo:

- riduce complessita' iniziale
- mantiene il contratto esplicito
- evita introdurre subito meccanismi di notifica o lifecycle password

## Flusso tecnico dell'admin iniziale

Ordine consigliato:

1. validare dati admin
2. calcolare password hash
3. creare l'utente in `users`
4. impostare `ruolo = ADMIN`
5. recuperare il ruolo di sistema `ADMIN`
6. creare associazione in `user_roles`
7. rileggere l'utente finale con assegnazioni ruolo

## Coerenza con il modello RBAC attuale

L'admin iniziale deve risultare coerente su due livelli:

- livello legacy
  campo `users.ruolo = ADMIN`

- livello RBAC
  presenza dell'assegnazione al ruolo di sistema `ADMIN`

Non e' sufficiente avere solo uno dei due.

## Stato minimo di successo dell'admin iniziale

La creazione dell'admin iniziale e' corretta solo se:

- esiste il record utente nel tenant appena creato
- la password hash e' persistita correttamente
- `ruolo` e' valorizzato a `ADMIN`
- esiste il collegamento a un ruolo di sistema `ADMIN`
- `getUserPermissions(...)` puo' risolvere i permessi amministrativi corretti

## Casi di fallimento da considerare bloccanti

L'intera creazione tenant deve fallire se fallisce uno di questi punti:

- hashing password
- insert dell'utente
- recupero ruolo `ADMIN`
- insert in `user_roles`
- rilettura finale dell'utente creato

Questo per evitare tenant creati senza un vero accesso amministrativo operativo.

## Strategia per email duplicate

Decisione consigliata:

- trattare email duplicate come errore bloccante

Nel tenant nuovo il caso e' raro, ma deve comunque essere gestito in modo esplicito e coerente con il resto dell'applicazione.

Messaggio consigliato:

- `Email admin gia in uso.`

## Stato login atteso

L'admin iniziale deve essere in grado di:

- autenticarsi via login tenant standard
- ottenere token e refresh token standard
- chiamare `/api/bootstrap`
- risolvere la navigazione amministrativa corretta

Questo e' il vero criterio operativo finale del bootstrap admin.

## Decisioni prese in questa fase

- l'admin iniziale e' obbligatorio
- l'admin iniziale usa il modello utente tenant standard
- il ruolo legacy e il ruolo RBAC devono convivere
- password manuale forte nella prima versione
- nessun forced reset o notifica automatica nella prima iterazione

## Output prodotto

- specifica del primo admin tenant
- sequenza tecnica di creazione
- criteri minimi di successo
- casi bloccanti di fallimento

## Prossimo passo

La fase successiva e':

- `Fase 6. Definizione API daemon per creazione tenant`
