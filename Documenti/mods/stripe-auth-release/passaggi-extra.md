# PASSAGGI EXTRA - Roadmap Tecnica Sequenziale

## Obiettivo
Completare in ordine unico tutti i miglioramenti post-RBAC:
- task gia iniziate (hardening password + messaggi token),
- task essenziali (validazioni estese + refresh token),
- task originariamente opzionali/scartabili ma ora incluse (multi-clinic `studio_id` e rifiniture finali).

## Regole operative
- Si lavora un passaggio alla volta (atomico).
- Dopo ogni passaggio: verifica minima e stop.
- Non si salta l'ordine.

---

## BLOCCO A - Consolidamento task gia iniziate

### EX-01 - Allineamento policy password su tutto il backend utenti
- Verificare che `isStrongPassword` sia usata in tutti i punti `users` (`POST`, `PUT`).
- Verificare messaggi errore coerenti.
- Output atteso: policy unica e coerente lato backend.

### EX-02 - Allineamento policy password su tutto il frontend utenti
- Verificare che la stessa regola sia applicata in create/edit utente.
- Uniformare testo hint + errori.
- Output atteso: UX coerente con backend (nessun mismatch).

### EX-03 - Rifinitura gestione token scaduto/non valido
- Verificare il mapping backend (`token_expired` vs `token_invalid`) e frontend (`reason=...`).
- Controllare che `/login` mostri messaggio giusto per `expired`, `invalid`, `unauthorized`.
- Output atteso: feedback sessione chiaro e consistente.

---

## BLOCCO B - Task essenziali (priorita alta)

### EX-04 - Hardening validazioni input backend (moduli core)
- Applicare validazioni piu strette dove mancanti:
  - `pazienti` (email/telefono/nome/cognome/note),
  - `appuntamenti` (data/ora/stato/medico),
  - `fatture` (importo/stato/data),
  - `prodotti` (nome/quantita/soglia).
- Uniformare i messaggi di errore lato API.
- Output atteso: input invalidi bloccati in modo prevedibile.

### EX-05 - Hardening validazioni input frontend (moduli core)
- Aggiungere/rafforzare controlli locali nei form per ridurre errori evitabili prima dell'API.
- Non duplicare logica complessa: mantenere allineamento con backend.
- Output atteso: meno roundtrip falliti e UX piu robusta.

### EX-06 - Design tecnico refresh token
- Definire strategia:
  - durata access token,
  - durata refresh token,
  - rotazione refresh token,
  - revoca token.
- Definire struttura dati (tabella refresh token con hash/jti/scadenza/revoca).
- Output atteso: mini-spec approvata.

### EX-07 - Implementazione backend refresh token
- Aggiungere endpoint:
  - `POST /api/login` (emette access + refresh),
  - `POST /api/refresh` (ruota e rinnova),
  - `POST /api/logout` (revoca refresh corrente).
- Aggiornare middleware/autenticazione dove necessario.
- Output atteso: ciclo token completo lato server.

### EX-08 - Implementazione frontend refresh token
- Aggiornare session store client per gestire access/refresh.
- In `api-client`, su `401` tentare refresh (una sola volta) prima del redirect login.
- Gestire logout pulito e cleanup.
- Output atteso: sessione stabile senza logout aggressivi.

### EX-09 - Test regressione auth end-to-end
- Testare:
  - login,
  - access token scaduto + refresh riuscito,
  - refresh scaduto/revocato -> redirect login,
  - logout + token non riusabili.
- Output atteso: flusso auth robusto e predicibile.

---

## BLOCCO C - Task originariamente opzionali/scartabili (ora incluse)

### EX-10 - Preparazione multi-clinic: modello dati `studio_id`
- Introdurre tabella `studi` (o equivalente) e default studio iniziale.
- Aggiungere `studio_id` a tabelle dominio principali (`users`, `pazienti`, `appuntamenti`, `fatture`, `prodotti`).
- Migrazione/backfill dati esistenti su studio default.
- Output atteso: schema pronto al partizionamento per studio.

### EX-11 - Propagazione `studio_id` in JWT e middleware
- Inserire `studio_id` nel token.
- Middleware deve estrarre e validare contesto studio.
- Output atteso: contesto studio disponibile in tutte le request autenticate.

### EX-12 - Scoping query backend per studio
- Applicare filtro `studio_id` in tutte le query CRUD.
- Evitare leak cross-studio.
- Output atteso: isolamento dati garantito.

### EX-13 - UI/admin minima per contesto studio
- Esporre studio attivo in UI (header/impostazioni).
- Predisporre selezione studio (anche disabilitata se singolo studio).
- Output atteso: base UX per multi-clinic.

---

## BLOCCO D - Chiusura tecnica

### EX-14 - Aggiornamento documentazione operativa
- Aggiornare:
  - `HANDOFF-IA-RBAC.md`
  - checklist test
  - note API auth (login/refresh/logout)
- Output atteso: documentazione allineata allo stato reale.

### EX-15 - Smoke test finale completo
- Eseguire test ruoli (`ADMIN`, `DENTISTA`, `SEGRETARIO`) su flussi principali.
- Verificare auth, RBAC, utenti, agenda, pazienti, fatture, magazzino.
- Output atteso: conferma finale "ready".

### EX-16 - Freeze/release interno
- Snapshot stato finale (changelog breve + punti noti).
- Output atteso: chiusura sprint ordinata e ripartenza semplice.

---

## Ordine di esecuzione deciso
`EX-01 -> EX-02 -> EX-03 -> EX-04 -> EX-05 -> EX-06 -> EX-07 -> EX-08 -> EX-09 -> EX-10 -> EX-11 -> EX-12 -> EX-13 -> EX-14 -> EX-15 -> EX-16`

