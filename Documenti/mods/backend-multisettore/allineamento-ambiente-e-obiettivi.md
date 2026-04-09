# ALLINEAMENTO AMBIENTE E OBIETTIVI TECNICI HALO

## 1. Obiettivo finale del progetto

L'obiettivo finale di HALO e' avere una piattaforma gestionale:

- multi-tenant
- multi-settore
- backend-driven nelle configurazioni principali
- estendibile senza riscritture massive
- operativamente utilizzabile con frontend e backend coerenti

In termini pratici, il sistema deve permettere di:

- servire tenant con vertical diversi usando la stessa base software
- attivare o disattivare moduli tramite feature flags
- adattare etichette, permessi, navigazione e configurazioni per tenant
- mantenere compatibilita' progressiva con il lessico e le API legacy
- amministrare la configurazione tenant in modo governato e tracciabile

## 2. Stato tecnico raggiunto

Il codice implementa gia' gran parte del modello previsto:

- bootstrap tenant backend-driven
- labels tenant/vertical backend-driven
- API versionate `/api/v2` con compatibilita' legacy
- frontend collegato ai principali endpoint `v2`
- feature flags tenant e controllo accessi
- validazione server-side di `settings_json`
- audit log modifiche tenant
- versioning configurazione tenant tramite `settings_version`
- endpoint admin backend per tenant config e tenant features

## 3. Gap reale da chiudere

Per considerare la piattaforma effettivamente pronta in ambiente locale o di staging non basta il codice. Serve che l'ambiente sia allineato in questi punti:

- variabili ambiente backend coerenti
- variabili ambiente frontend coerenti
- database reale allineato a `database/schema.sql`
- dati minimi tenant presenti nel database
- eventuali override feature presenti e coerenti
- verifica del bootstrap reale senza errori

L'errore osservato in precedenza, `Errore nella verifica feature flag tenant`, e' coerente con un ambiente non completamente allineato tra codice, schema e dati.

## 4. Componenti che devono risultare coerenti

### Backend

Percorso principale:

- [backend/src/server.js](/Users/francescostrano/Desktop/HALO/backend/src/server.js)

Servizi e route chiave:

- [backend/src/services/feature-flags.service.js](/Users/francescostrano/Desktop/HALO/backend/src/services/feature-flags.service.js)
- [backend/src/services/tenant-settings-validation.service.js](/Users/francescostrano/Desktop/HALO/backend/src/services/tenant-settings-validation.service.js)
- [backend/src/services/tenant-audit-logs.service.js](/Users/francescostrano/Desktop/HALO/backend/src/services/tenant-audit-logs.service.js)
- [backend/src/routes/tenant-config.routes.js](/Users/francescostrano/Desktop/HALO/backend/src/routes/tenant-config.routes.js)
- [backend/src/routes/bootstrap.routes.js](/Users/francescostrano/Desktop/HALO/backend/src/routes/bootstrap.routes.js)

### Frontend

Configurazione API:

- [frontend/src/features/auth/api.ts](/Users/francescostrano/Desktop/HALO/frontend/src/features/auth/api.ts)

Moduli gia' collegati a `v2`:

- [frontend/src/features/pazienti/api.ts](/Users/francescostrano/Desktop/HALO/frontend/src/features/pazienti/api.ts)
- [frontend/src/features/agenda/api.ts](/Users/francescostrano/Desktop/HALO/frontend/src/features/agenda/api.ts)
- [frontend/src/features/fatture/api.ts](/Users/francescostrano/Desktop/HALO/frontend/src/features/fatture/api.ts)
- [frontend/src/features/magazzino/api.ts](/Users/francescostrano/Desktop/HALO/frontend/src/features/magazzino/api.ts)
- [frontend/src/features/users/api.ts](/Users/francescostrano/Desktop/HALO/frontend/src/features/users/api.ts)

### Database

Schema di riferimento:

- [database/schema.sql](/Users/francescostrano/Desktop/HALO/database/schema.sql)

Tabelle critiche da avere presenti e coerenti:

- `studi`
- `tenant_features`
- `vertical_templates`
- `users`
- `roles`
- `role_permissions`
- `user_roles`
- `tenant_audit_logs`
- `refresh_tokens`

## 5. Obiettivi tecnici dell'allineamento ambiente

L'allineamento ambiente deve arrivare a questo risultato verificabile:

1. Il backend si avvia senza errori di connessione o schema mancante.
2. Il frontend punta in modo esplicito all'API corretta.
3. Il login funziona.
4. Il bootstrap tenant risponde senza eccezioni.
5. Le feature flags vengono lette senza errori.
6. Le route principali `v2` rispondono correttamente.
7. Gli endpoint admin tenant config e tenant features sono raggiungibili con utente autorizzato.

## 6. Allineamento richiesto lato variabili ambiente

### Backend

Il backend risulta configurato tramite:

- [backend/.env](/Users/francescostrano/Desktop/HALO/backend/.env)

Valori minimi richiesti:

- `DATABASE_URL`
- `CLIENT_URL`
- `JWT_SECRET`
- `JWT_EXPIRATION`
- `SALT_ROUNDS`

Valori gia' previsti ma dipendenti dall'ambiente:

- credenziali Stripe
- eventuali refresh token settings

### Frontend

Il frontend deve avere:

- [frontend/.env.local](/Users/francescostrano/Desktop/HALO/frontend/.env.local)

Valore minimo richiesto:

- `NEXT_PUBLIC_API_BASE_URL=http://localhost:4000/api`

Questo evita dipendenze implicite e rende esplicito il collegamento al backend locale.

## 7. Allineamento richiesto lato database

Perche' il sistema sia davvero coerente, il database reale deve essere allineato allo schema corrente.

Operazioni necessarie:

1. Verificare la connessione usando `DATABASE_URL`.
2. Applicare [database/schema.sql](/Users/francescostrano/Desktop/HALO/database/schema.sql).
3. Verificare l'esistenza delle tabelle critiche.
4. Verificare la presenza di almeno un tenant valido in `studi`.
5. Verificare che il tenant abbia `vertical_key` coerente.
6. Verificare che le feature flags tenant siano leggibili.
7. Verificare ruoli, permessi e relazioni utente-ruolo.

## 8. Dati minimi che devono esistere

Anche con schema corretto, il sistema non e' operativo senza dati minimi.

Devono esistere almeno:

- un record tenant in `studi`
- un utente attivo
- almeno un ruolo valido
- almeno una relazione in `user_roles`
- permessi coerenti in `role_permissions`
- template vertical coerente in `vertical_templates` se richiesto dal bootstrap

## 9. Rischi tecnici se l'ambiente non viene allineato

Se il codice viene eseguito senza allineare DB e variabili ambiente, gli errori piu' probabili sono:

- errore nel caricamento bootstrap
- errore nella verifica feature flag tenant
- moduli invisibili o bloccati in modo incoerente
- permessi non risolti correttamente
- login parzialmente funzionante ma applicazione non operativa
- mismatch tra route backend e comportamento frontend

## 10. Strategia operativa di chiusura

Per arrivare all'obiettivo in modo corretto, la sequenza giusta e':

1. allineare le variabili ambiente frontend/backend
2. allineare lo schema del database reale
3. verificare i dati minimi obbligatori
4. avviare backend e frontend
5. validare login e bootstrap
6. validare feature flags, permessi e route principali
7. documentare eventuali seed o dati mancanti

## 11. Criteri di successo

L'ambiente puo' essere considerato allineato quando:

- il backend risponde senza errori strutturali
- il frontend si collega all'API corretta
- il login e' operativo
- il bootstrap risponde con tenant, labels, permissions, navigation e feature flags
- non compare piu' l'errore di verifica feature flag tenant
- almeno un tenant puo' usare i moduli previsti dal proprio vertical

## 12. Intervento eseguibile in questo repository

Nel repository locale si possono allineare subito:

- la configurazione frontend locale
- la documentazione tecnica operativa
- la verifica del codice e delle dipendenze logiche

Per completare l'allineamento reale servono poi:

- accesso al PostgreSQL locale configurato in `DATABASE_URL`
- applicazione dello schema su quel database
- verifica dei dati presenti

## 13. Output atteso del lavoro di allineamento

Alla fine del lavoro devono esistere:

- ambiente frontend esplicitamente configurato
- database coerente con lo schema corrente
- documento tecnico unico per obiettivi e allineamento
- base pronta per QA operativo e test reali

## 14. Documento di riferimento per la chiusura tecnica

Questo documento va usato come checklist operativa per:

- portare il progetto da "codice quasi completo" a "ambiente realmente funzionante"
- verificare dove il problema e' di codice e dove invece e' di configurazione o dati
- evitare ulteriori modifiche cieche prima di aver chiuso l'allineamento infrastrutturale e dati
