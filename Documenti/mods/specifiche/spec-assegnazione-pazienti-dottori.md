# Specifica Tecnica: Assegnazione Pazienti a un Dottore

## 1. Obiettivo

L'obiettivo è introdurre nel progetto HALO un legame esplicito tra `paziente` e `dottore`, in modo che:

1. in fase di creazione paziente sia possibile indicare il dottore di riferimento;
2. il dato venga salvato in modo strutturato nel database;
3. quando un utente con ruolo `DENTISTA` accede all'interfaccia, visualizzi:
   - tutti e soli i pazienti assegnati a lui;
   - tutti e soli gli appuntamenti relativi ai suoi pazienti.

## 2. Stato Attuale

Ad oggi il progetto contiene già una separazione per `studio_id`, ma il legame tra dottore e paziente non e strutturale.

### Backend

- [database/schema.sql](/Users/francescostrano/Desktop/HALO/database/schema.sql)
  La tabella `pazienti` non contiene alcun riferimento al dottore.
- [database/schema.sql](/Users/francescostrano/Desktop/HALO/database/schema.sql)
  La tabella `appuntamenti` usa il campo testuale `medico VARCHAR(120)`.
- [backend/src/routes/pazienti.routes.js](/Users/francescostrano/Desktop/HALO/backend/src/routes/pazienti.routes.js)
  La lista pazienti per il dentista viene filtrata controllando se esistono appuntamenti con `a.medico = users.nome`.
- [backend/src/routes/appuntamenti.routes.js](/Users/francescostrano/Desktop/HALO/backend/src/routes/appuntamenti.routes.js)
  La lista appuntamenti per il dentista viene filtrata confrontando il testo di `appuntamenti.medico` con `users.nome`.
- [backend/src/routes/users.routes.js](/Users/francescostrano/Desktop/HALO/backend/src/routes/users.routes.js)
  Gli utenti `DENTISTA` esistono gia e sono gestiti correttamente.

### Frontend

- [frontend/src/features/pazienti/api.ts](/Users/francescostrano/Desktop/HALO/frontend/src/features/pazienti/api.ts)
  Il payload paziente non prevede il dottore.
- [frontend/src/features/pazienti/pazienti-manager.tsx](/Users/francescostrano/Desktop/HALO/frontend/src/features/pazienti/pazienti-manager.tsx)
  Il form paziente non consente di associare un dentista.
- [frontend/src/features/agenda/api.ts](/Users/francescostrano/Desktop/HALO/frontend/src/features/agenda/api.ts)
  Gli appuntamenti espongono il campo `medico` come stringa.
- [frontend/src/features/agenda/agenda-calendar.tsx](/Users/francescostrano/Desktop/HALO/frontend/src/features/agenda/agenda-calendar.tsx)
  Il filtro del dentista dipende dal backend ma non da una relazione forte paziente-dottore.

## 3. Problema Tecnico

L'attuale logica e fragile perche si basa sul nome del dottore scritto come testo libero:

- se il nome utente cambia, i filtri possono rompersi;
- se il nome viene scritto in modo diverso, i dati non coincidono;
- un paziente senza appuntamenti non appare al dottore, anche se dovrebbe essergli assegnato;
- gli appuntamenti sono collegati al dottore tramite testo, non tramite chiave esterna.

Questa soluzione non garantisce consistenza applicativa.

## 4. Soluzione Target

La soluzione corretta e introdurre l'assegnazione del dottore direttamente sul paziente.

### Modello target

- ogni record in `pazienti` deve avere un campo `medico_id`;
- `medico_id` deve referenziare `users.id`;
- il valore deve essere ammesso solo per utenti dello stesso `studio_id` e con ruolo `DENTISTA`;
- la vista del dentista deve filtrare pazienti e appuntamenti tramite `pazienti.medico_id = req.user.id`.

### Scelta architetturale

La relazione principale deve essere:

- `users (DENTISTA)` -> `pazienti`

Gli appuntamenti devono poi dipendere dal paziente:

- `pazienti` -> `appuntamenti`

In questo modo il dentista vede gli appuntamenti dei propri pazienti anche se il campo testuale `medico` non coincide perfettamente.

## 5. Modifica Database

### 5.1 Nuovo campo su `pazienti`

Estendere la tabella `pazienti` con:

```sql
ALTER TABLE pazienti
ADD COLUMN medico_id BIGINT NULL;
```

### 5.2 Vincolo relazionale

Aggiungere foreign key verso `users(id)`:

```sql
ALTER TABLE pazienti
ADD CONSTRAINT fk_pazienti_medico_id
FOREIGN KEY (medico_id) REFERENCES users(id) ON DELETE RESTRICT;
```

### 5.3 Indici

Aggiungere indice per le query del dentista:

```sql
CREATE INDEX IF NOT EXISTS idx_pazienti_medico_id
ON pazienti (medico_id);
```

### 5.4 Validazione logica

La foreign key da sola non basta. In applicazione bisogna verificare che:

1. l'utente esista;
2. l'utente abbia ruolo `DENTISTA`;
3. l'utente appartenga allo stesso `studio_id` del paziente.

## 6. Strategia Dati

### 6.1 Migrazione iniziale

Per evitare rotture in produzione:

1. aggiungere `medico_id` come `NULL`;
2. eseguire backfill sui pazienti esistenti;
3. aggiornare backend e frontend;
4. solo dopo stabilizzazione valutare se rendere `medico_id` obbligatorio (`NOT NULL`).

### 6.2 Backfill consigliato

Se esiste gia una corrispondenza coerente tra `appuntamenti.medico` e `users.nome`, si puo valorizzare `medico_id` con una query di backfill.

Script operativo preparato nel progetto:

- [database/backfill_pazienti_medico_id.sql](/Users/francescostrano/Desktop/HALO/database/backfill_pazienti_medico_id.sql)

Logica:

1. per ogni paziente, cercare appuntamenti del suo `studio_id`;
2. individuare il dentista tramite match sul nome;
3. valorizzare `pazienti.medico_id` solo se la corrispondenza e univoca;
4. lasciare `NULL` i casi ambigui per correzione manuale.

### 6.3 Nota importante

Non conviene basare il sistema definitivo sul solo campo `appuntamenti.medico`.

Quel campo puo restare:

- come dato di visualizzazione;
- come compatibilita temporanea;
- oppure essere deprecato in una fase successiva.

## 7. Modifiche Backend

## 7.1 Route `users`

File coinvolto:

- [backend/src/routes/users.routes.js](/Users/francescostrano/Desktop/HALO/backend/src/routes/users.routes.js)

Necessita:

- esporre i dentisti disponibili nello studio;
- il frontend deve poter popolare una select con gli utenti `ruolo = DENTISTA`.

Possibili opzioni:

1. riutilizzare `GET /users` e filtrare lato frontend;
2. aggiungere un endpoint dedicato, ad esempio `GET /users?ruolo=DENTISTA`.

Scelta consigliata:

- supportare filtro backend per ruolo, per evitare di trasferire utenti non necessari.

## 7.2 Route `pazienti`

File coinvolto:

- [backend/src/routes/pazienti.routes.js](/Users/francescostrano/Desktop/HALO/backend/src/routes/pazienti.routes.js)

Modifiche richieste:

1. aggiungere `medico_id` ai campi consentiti in `POST` e `PUT`;
2. validare che `medico_id` sia un intero positivo;
3. verificare in database che il medico esista, sia `DENTISTA` e appartenga allo stesso studio;
4. restituire `medico_id` nella response;
5. opzionale ma raccomandato: restituire anche `medico_nome`.

Esempio payload:

```json
{
  "nome": "Mario",
  "cognome": "Rossi",
  "telefono": "+39 3331234567",
  "email": "mario.rossi@example.com",
  "note": "Prima visita",
  "medico_id": 12
}
```

### Filtro lista pazienti per dentista

La query `GET /pazienti` va modificata.

Comportamento target:

- `ADMIN` e `SEGRETARIO` vedono tutti i pazienti dello studio;
- `DENTISTA` vede solo i pazienti con `p.medico_id = req.user.id`.

Questa modifica elimina la dipendenza dagli appuntamenti per costruire la lista pazienti del dentista.

## 7.3 Route `appuntamenti`

File coinvolto:

- [backend/src/routes/appuntamenti.routes.js](/Users/francescostrano/Desktop/HALO/backend/src/routes/appuntamenti.routes.js)

Modifica chiave sulla `GET /appuntamenti`:

- il dentista deve vedere gli appuntamenti unendo `appuntamenti` a `pazienti`;
- il filtro corretto diventa `p.medico_id = req.user.id`.

Query concettuale:

```sql
SELECT a.*
FROM appuntamenti a
JOIN pazienti p
  ON p.id = a.paziente_id
 AND p.studio_id = a.studio_id
WHERE a.studio_id = $1
  AND p.medico_id = $2;
```

### Gestione del campo `medico`

Ci sono due strategie possibili.

#### Strategia A: mantenere `appuntamenti.medico` come testo di appoggio

- il campo resta nella tabella;
- in creazione appuntamento si puo valorizzare automaticamente con il nome del dentista assegnato al paziente;
- il filtro business non dipende piu da questo campo.

#### Strategia B: introdurre anche `appuntamenti.medico_id`

- piu pulita a lungo termine;
- utile se un appuntamento puo essere assegnato a un dentista diverso dal medico principale del paziente.

Per il requisito espresso ora, la Strategia A e sufficiente e meno invasiva.

## 8. Modifiche Frontend

## 8.1 API pazienti

File coinvolto:

- [frontend/src/features/pazienti/api.ts](/Users/francescostrano/Desktop/HALO/frontend/src/features/pazienti/api.ts)

Aggiornare i tipi:

```ts
export type Paziente = {
  id: number;
  nome: string;
  cognome: string;
  telefono: string | null;
  email: string | null;
  note: string | null;
  medico_id: number | null;
  medico_nome?: string | null;
};
```

Aggiornare anche `PazientePayload` includendo `medico_id`.

## 8.2 Form gestione pazienti

File coinvolto:

- [frontend/src/features/pazienti/pazienti-manager.tsx](/Users/francescostrano/Desktop/HALO/frontend/src/features/pazienti/pazienti-manager.tsx)

Modifiche richieste:

1. aggiungere un campo obbligatorio `Dottore`;
2. caricare la lista dei dentisti disponibili;
3. salvare `medico_id` nel payload;
4. mostrare in tabella il dottore assegnato;
5. in modifica paziente permettere il cambio dottore.

### UX consigliata

Anche se il requisito dice "inserendo il nome del dottore", a livello tecnico il frontend deve:

1. mostrare il nome del dottore all'utente;
2. salvare in backend il suo `id`.

Quindi l'input corretto e una `select` o un `autocomplete`, non un campo testo libero.

## 8.3 API utenti

File coinvolto:

- [frontend/src/features/users/api.ts](/Users/francescostrano/Desktop/HALO/frontend/src/features/users/api.ts)

Necessario aggiungere un metodo per recuperare i dentisti, ad esempio:

```ts
listDentisti()
```

che richiami `GET /users?ruolo=DENTISTA`.

## 8.4 Agenda

File coinvolto:

- [frontend/src/features/agenda/api.ts](/Users/francescostrano/Desktop/HALO/frontend/src/features/agenda/api.ts)
- [frontend/src/features/agenda/agenda-calendar.tsx](/Users/francescostrano/Desktop/HALO/frontend/src/features/agenda/agenda-calendar.tsx)

Il frontend agenda richiedera meno logica custom:

- il backend restituira gia gli appuntamenti filtrati correttamente per il dentista;
- il dentista visualizzera automaticamente solo gli appuntamenti dei propri pazienti.

Opzionale:

- mostrare il nome del medico associato nella card paziente/appuntamento per maggiore chiarezza.

## 9. Passi Implementativi

## Fase 1. Estensione schema dati

1. aggiungere `medico_id` a `pazienti`;
2. aggiungere foreign key e indice;
3. preparare script SQL di migrazione separato.

## Fase 2. Aggiornamento backend pazienti

1. estendere payload `POST /pazienti` e `PUT /pazienti/:id`;
2. aggiungere validazione esistenza/ruolo/studio del dentista;
3. aggiornare `GET /pazienti` per il filtro su `medico_id`.

## Fase 3. Aggiornamento backend utenti

1. esporre elenco dentisti filtrabile;
2. garantire che il frontend possa recuperare solo i dottori selezionabili.

## Fase 4. Aggiornamento backend appuntamenti

1. filtrare gli appuntamenti del dentista tramite join con `pazienti`;
2. opzionalmente valorizzare `appuntamenti.medico` dal medico assegnato al paziente.

## Fase 5. Aggiornamento frontend pazienti

1. estendere tipi TS;
2. caricare elenco dentisti;
3. aggiungere select nel form;
4. inviare `medico_id`;
5. mostrare il dottore assegnato nell'elenco pazienti.

## Fase 6. Verifica interfaccia dentista

1. login come `DENTISTA`;
2. verifica che compaiano solo i pazienti assegnati;
3. verifica che compaiano solo gli appuntamenti dei propri pazienti;
4. verifica che i pazienti senza appuntamenti ma assegnati siano comunque visibili.

## Fase 7. Migrazione dati esistenti

1. eseguire script di backfill;
2. produrre lista dei pazienti rimasti senza `medico_id`;
3. correggere manualmente i casi ambigui;
4. solo dopo completamento valutare `NOT NULL`.

## 10. Regole di Business

Le regole da rispettare sono:

1. un paziente deve appartenere a un solo dottore di riferimento;
2. il dottore assegnato deve essere un utente con ruolo `DENTISTA`;
3. il dottore e il paziente devono appartenere allo stesso studio;
4. il dentista vede solo i pazienti assegnati a lui;
5. il dentista vede solo gli appuntamenti dei pazienti assegnati a lui;
6. `ADMIN` e `SEGRETARIO` mantengono visibilita completa sullo studio.

## 11. Criteri di Accettazione

La modifica si considera completata quando:

1. il form di creazione paziente obbliga la selezione del dottore;
2. il backend rifiuta `medico_id` non valido o non appartenente allo studio;
3. il paziente appena creato risulta associato al dottore corretto;
4. il dentista vede il paziente anche in assenza di appuntamenti;
5. il dentista vede solo gli appuntamenti relativi ai propri pazienti;
6. admin e segreteria continuano a vedere tutti i dati dello studio;
7. la logica non dipende piu dal confronto testuale sul nome del medico.

## 12. Test da Eseguire

### Test backend

1. creazione paziente con `medico_id` valido;
2. creazione paziente con `medico_id` inesistente;
3. creazione paziente con utente esistente ma non `DENTISTA`;
4. creazione paziente con dentista di altro studio;
5. lista pazienti come dentista;
6. lista appuntamenti come dentista;
7. verifica che admin e segretario vedano l'intero dataset dello studio.

### Test frontend

1. caricamento corretto della lista dottori;
2. invio corretto del payload con `medico_id`;
3. visualizzazione del dottore assegnato nella lista pazienti;
4. comportamento corretto delle schermate pazienti e agenda dopo login dentista.

## 13. Rischi e Attenzioni

I punti da controllare con attenzione sono:

1. pazienti storici privi di assegnazione iniziale;
2. possibili omonimie nei nomi dei dentisti durante il backfill;
3. dipendenze residue dal campo `appuntamenti.medico`;
4. casi in cui un appuntamento storico riporti un medico diverso da quello assegnato oggi al paziente.

## 14. Decisione Consigliata

La soluzione raccomandata e:

1. introdurre `pazienti.medico_id` come nuova fonte autorevole;
2. usare `users.id` come identificativo tecnico e `users.nome` solo come etichetta UI;
3. filtrare la vista dentista tramite `pazienti.medico_id`;
4. mantenere `appuntamenti.medico` solo come campo di compatibilita temporanea.

Questa e la modifica minima corretta per ottenere il comportamento richiesto senza lasciare la logica applicativa dipendente da un nome testuale.
