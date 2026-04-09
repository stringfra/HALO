# ANALISI REGRESSIONE UTENTI PIATTAFORMA STANDARD E FLUSSI OPERATIVI HALO

## Contesto

Dopo gli interventi completati sulle fasi:

- Fase 0: allineamento lessico e contratto ruoli di sistema default
- Fase 1: refactor backend dei ruoli di sistema default
- Fase 2: migrazione e compatibilita tenant legacy
- Fase 3: aggiornamento vertical template e label esposte
- Fase 4: aggiornamento dropdown e selettori frontend
- Fase 5: revisione bootstrap tenant e dati esposti al frontend
- Fase 6: correzione persistenza reale di `settings_json`
- Fase 7: QA finale e regressione

si osserva una regressione sui flussi tenant standard, cioe non daemon.

Sintomo riportato:

- alcuni utenti creati dalla piattaforma normale risultano non operativi;
- gli stessi utenti, o i flussi eseguiti con essi, ricevono errori applicativi;
- moduli come agenda e altre aree protette a permessi risultano bloccati.

## Obiettivo del documento

Documentare in modo tecnico e preciso:

1. cosa non va;
2. perche il problema si manifesta nel flusso standard e non nel daemon;
3. quali aree sono impattate;
4. quali interventi devono essere eseguiti per correggere il problema;
5. come suddividere il fix in fasi verificabili.

## Esito della diagnosi

La regressione principale e una rottura del contratto RBAC tra:

- `users.ruolo`
- `user_roles`
- `role_permissions`
- bootstrap tenant
- middleware `requirePermission(...)`

In pratica il flusso standard `/api/v2/users` crea e aggiorna l'utente valorizzando `users.ruolo`, ma non assegna il corrispondente ruolo di sistema nella tabella `user_roles`.

Il flusso daemon invece esegue entrambe le cose:

- crea/aggiorna `users.ruolo`;
- allinea anche `user_roles` con il ruolo di sistema del tenant.

Questa divergenza produce utenti semanticamente corretti in anagrafica, ma privi di permessi effettivi nel modello RBAC runtime.

## Evidenze tecniche

### 1. Il flusso standard crea utenti senza assegnazioni `user_roles`

In [backend/src/routes/users.routes.js](/Users/francescostrano/Desktop/HALO/backend/src/routes/users.routes.js#L75) la `POST /api/v2/users` inserisce un record in `users` con `ruolo`, ma si ferma qui.

Punto critico:

- insert su `users` a righe [backend/src/routes/users.routes.js](/Users/francescostrano/Desktop/HALO/backend/src/routes/users.routes.js#L113)
- nessun insert successivo su `user_roles`

Lo stesso problema esiste in update ruolo:

- update di `users.ruolo` a righe [backend/src/routes/users.routes.js](/Users/francescostrano/Desktop/HALO/backend/src/routes/users.routes.js#L181)
- nessuna riallocazione del ruolo di sistema in `user_roles`

### 2. Il middleware permessi usa il RBAC reale, non il solo campo `users.ruolo`

In [backend/middlewares/authMiddleware.js](/Users/francescostrano/Desktop/HALO/backend/middlewares/authMiddleware.js#L201) tutte le route protette con `requirePermission(...)` chiedono i permessi effettivi dell'utente.

La risoluzione avviene in [backend/src/services/permissions.service.js](/Users/francescostrano/Desktop/HALO/backend/src/services/permissions.service.js#L4):

- prima legge `user_roles -> roles -> role_permissions`;
- solo se la query fallisce per schema assente fa fallback ai permessi legacy;
- se la query funziona ma ritorna `0` righe, il fallback legacy non parte.

Conseguenza:

- un utente creato da piattaforma standard puo avere `users.ruolo = DIPENDENTE`;
- ma se non ha record in `user_roles`, i permessi risolti sono vuoti;
- tutte le route protette a permesso rispondono `403 Accesso negato: permesso non autorizzato`.

### 3. Il bootstrap tenant eredita la stessa incoerenza

In [backend/src/services/feature-flags.service.js](/Users/francescostrano/Desktop/HALO/backend/src/services/feature-flags.service.js#L110) `getTenantBootstrap(...)` usa `getUserPermissions(user)`.

Quindi per un utente creato dal flusso standard:

- `current_user.permissions` puo essere vuoto;
- `navigation` puo risultare vuota o incompleta;
- la UI risulta coerente con il backend, ma sbagliata dal punto di vista del business.

Questo spiega perche il problema venga percepito anche come malfunzionamento di agenda, pagine protette e operativita generale.

### 4. Il flusso daemon invece e allineato correttamente

In [backend/src/routes/daemon.routes.js](/Users/francescostrano/Desktop/HALO/backend/src/routes/daemon.routes.js#L1345) il daemon:

- garantisce i ruoli di sistema tenant;
- risolve il ruolo di sistema coerente;
- inserisce il record utente;
- inserisce le assegnazioni in `user_roles` a righe [backend/src/routes/daemon.routes.js](/Users/francescostrano/Desktop/HALO/backend/src/routes/daemon.routes.js#L1396)

Anche l'update daemon del ruolo riallinea le assegnazioni di sistema:

- delete dei system role correnti in `user_roles` a righe [backend/src/routes/daemon.routes.js](/Users/francescostrano/Desktop/HALO/backend/src/routes/daemon.routes.js#L1549)
- insert del nuovo ruolo di sistema a righe [backend/src/routes/daemon.routes.js](/Users/francescostrano/Desktop/HALO/backend/src/routes/daemon.routes.js#L1570)

### 5. Il frontend tenant standard usa davvero il flusso rotto

In [frontend/src/features/users/api.ts](/Users/francescostrano/Desktop/HALO/frontend/src/features/users/api.ts#L95) la UI standard chiama `POST /api/v2/users`.

Questo significa che:

- la regressione non e teorica;
- il bug e nel percorso realmente usato dalla piattaforma normale;
- il comportamento differente rispetto al daemon e strutturale.

### 6. I moduli operativi dipendono da permessi e bootstrap

L'agenda lato frontend carica:

- lista appuntamenti;
- lista pazienti;
- creazione/modifica appuntamenti.

Vedi [frontend/src/features/agenda/agenda-calendar.tsx](/Users/francescostrano/Desktop/HALO/frontend/src/features/agenda/agenda-calendar.tsx#L174).

Queste API passano da route backend protette con `requirePermission("appointments.read")`, `requirePermission("appointments.write")`, `requirePermission("clients.read")` e simili.

Quindi un utente creato senza `user_roles`:

- non carica correttamente agenda e pazienti;
- non puo creare o aggiornare appuntamenti;
- riceve errori backend coerenti con permessi mancanti.

## Cosa non va esattamente

Il problema reale non e un semplice bug di label o dropdown.

Il problema e che la roadmap ha spostato il sistema verso un RBAC tenant-aware basato su ruoli reali e permessi assegnati, ma il flusso standard utenti e rimasto parzialmente legacy.

In sintesi:

- il daemon lavora in modello RBAC completo;
- la piattaforma standard lavora ancora come se `users.ruolo` bastasse da solo;
- dopo il refactor, `users.ruolo` non e piu sufficiente a rendere operativo un utente.

## Impatto

### Impatto funzionale

- utenti creati da piattaforma standard possono autenticarsi ma non operare;
- bootstrap incoerente per gli utenti creati/modificati fuori dal daemon;
- pagine con permessi possono sparire o restituire errore;
- agenda, pazienti, fatture, impostazioni e altre aree possono risultare bloccate.

### Impatto dati

- tenant in stato ibrido: `users.ruolo` valorizzato ma `user_roles` assente o incoerente;
- possibile mismatch fra ruolo base utente e ruolo di sistema realmente assegnato;
- rischio di inconsistenza crescente sugli utenti gia creati/modificati dal flusso standard.

### Impatto QA

La suite esistente passa, ma non copre questa regressione.

Verifica eseguita:

- backend `npm test`: 9 test passati
- frontend `npm test`: 3 test passati

Gap emerso:

- non esiste un test che verifichi il provisioning utente da piattaforma standard con allineamento `users.ruolo` + `user_roles`;
- non esiste un test end-to-end che controlli che un utente creato dal tenant standard possa usare agenda e moduli protetti.

## Piano di fix a fasi

## Fase 1. Riallineare il contratto backend del flusso utenti standard

### Obiettivo

Fare in modo che `POST /api/v2/users` e `PUT /api/v2/users/:id` producano lo stesso stato RBAC minimo garantito dal daemon.

### Interventi richiesti

- estrarre o riusare una funzione applicativa condivisa per:
  - `ensureSystemRolesForTenant(...)`
  - risoluzione del ruolo di sistema coerente col `ruolo`
  - insert/delete su `user_roles`
- aggiornare [backend/src/routes/users.routes.js](/Users/francescostrano/Desktop/HALO/backend/src/routes/users.routes.js) affinche:
  - in create assegni sempre esattamente un ruolo di sistema coerente;
  - in update ruolo riallinei le assegnazioni `user_roles`;
  - lavori in transazione SQL;
  - protegga il caso "ultimo ADMIN" se il tenant standard puo cambiare ruolo ad admin.

### Criteri di accettazione

- un utente creato da piattaforma standard ha subito il suo ruolo di sistema in `user_roles`;
- un cambio ruolo da piattaforma standard aggiorna anche `user_roles`;
- `users.ruolo` e `user_roles` restano coerenti.

## Fase 2. Introdurre repair e backfill degli utenti gia compromessi

### Obiettivo

Riparare i tenant che hanno gia utenti creati o modificati dal flusso standard in stato incoerente.

### Interventi richiesti

- riusare il repair RBAC gia esistente in [backend/src/services/daemon-admin-tools.service.js](/Users/francescostrano/Desktop/HALO/backend/src/services/daemon-admin-tools.service.js);
- esporre un percorso operativo sicuro:
  - comando amministrativo;
  - endpoint daemon di supporto gia presente;
  - eventuale script SQL/Node dedicato se serve batch globale;
- produrre report di quanti utenti hanno:
  - `missing_system_role`
  - `legacy_role_mismatch`
  - `multiple_system_roles`

### Criteri di accettazione

- i tenant esistenti possono essere riallineati senza correzioni manuali record-per-record;
- il numero di utenti incoerenti scende a zero dopo il repair.

## Fase 3. Coprire i flussi con test di regressione reali

### Obiettivo

Evitare che il problema si ripresenti dopo futuri refactor di ruoli, bootstrap o tenant settings.

### Interventi richiesti

- aggiungere test backend per il flusso standard utenti:
  - create user standard assegna `user_roles`;
  - update ruolo standard riallinea `user_roles`;
  - `getUserPermissions(...)` restituisce permessi coerenti dopo create/update standard;
- aggiungere test bootstrap:
  - l'utente creato da piattaforma standard riceve `current_user.permissions` valorizzato;
  - `navigation` contiene le voci previste dal ruolo;
- aggiungere smoke test frontend o integration test:
  - login con utente creato da standard;
  - apertura agenda;
  - caricamento pazienti;
  - creazione appuntamento consentita se il ruolo lo prevede.

### Criteri di accettazione

- la suite fallisce se il flusso standard torna a non valorizzare `user_roles`;
- la suite copre esplicitamente la parita funzionale fra daemon e piattaforma standard.

## Fase 4. Hardening del contratto RBAC applicativo

### Obiettivo

Ridurre il rischio che altri punti della codebase scrivano `users.ruolo` senza riallineare il RBAC.

### Interventi richiesti

- centralizzare la logica di provisioning/aggiornamento utente tenant in un servizio unico;
- vietare nei route handler scritture dirette a `users.ruolo` senza passare dal servizio;
- introdurre audit applicativo sui cambi ruolo anche nel flusso standard;
- valutare assert o check diagnostici che segnalino utenti con `users.ruolo` ma nessun system role assegnato.

### Criteri di accettazione

- esiste un solo punto autorevole per il cambio del ruolo base utente;
- daemon e piattaforma standard non divergono piu a livello di persistenza RBAC.

## Priorita operativa

Ordine consigliato:

1. correggere subito il backend del flusso standard;
2. eseguire repair RBAC sui tenant gia toccati;
3. aggiungere test di regressione;
4. rifattorizzare verso un servizio unico per evitare recidive.

## Conclusione

La causa della regressione e una divergenza implementativa tra flusso daemon e flusso tenant standard introdotta dopo il refactor dei ruoli e del RBAC tenant-aware.

Il campo `users.ruolo` viene ancora aggiornato dalla piattaforma standard, ma non basta piu a rendere operativo un utente. Senza assegnazione coerente in `user_roles`, il sistema calcola permessi vuoti, il bootstrap si impoverisce e i moduli protetti come agenda smettono di funzionare per quegli utenti.

Il fix corretto non e cosmetico: va riallineato il contratto di persistenza RBAC del flusso standard e va poi eseguito un repair dei dati gia compromessi.
