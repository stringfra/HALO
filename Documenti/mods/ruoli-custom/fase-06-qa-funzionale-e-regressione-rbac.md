# FASE 6 - QA FUNZIONALE E REGRESSIONE RBAC HALO

Data: `05 Aprile 2026`
Ambito: `verifica finale roadmap ruoli custom daemon`
Stato: `completata`

## Scopo

Chiudere la roadmap con una verifica finale dei cambi introdotti su:

- isolamento tenant dei ruoli custom;
- creazione e visibilita' ruoli tenant da daemon;
- assegnazione corretta dei ruoli custom agli utenti tenant;
- revisione UX della console con bottone `Gestisci`;
- hardening logico e audit.

## Verifiche automatiche eseguite

### Backend test suite

Comando eseguito:

```bash
npm test
```

Esito:

- `4/4 PASS`

Copertura diretta:

- middleware hardening daemon;
- catalogo eventi daemon;
- classificazione eventi aggiornata.

### Controllo sintattico backend

Comandi eseguiti:

```bash
node -c src/routes/daemon.routes.js
node -c src/services/daemon-admin-tools.service.js
```

Esito:

- sintassi valida per i file backend modificati nella roadmap.

### Lint frontend mirato

Comando eseguito:

```bash
npx eslint src/app/daemon/console/page.tsx src/features/daemon-console/api.ts
```

Esito:

- nessun errore lint sui file frontend toccati.

## Verifiche funzionali coperte dal codice

In base alle modifiche completate, risultano coperti a livello implementativo i seguenti punti:

### Isolamento tenant

- i ruoli tenant continuano a essere filtrati per `studio_id`;
- le assegnazioni cross-tenant sono diagnosticate;
- il repair RBAC tenant puo' rimuoverle;
- esiste uno script SQL dedicato di audit.

### Creazione e visibilita' ruoli

- `POST /roles`, `GET /roles`, `PUT /roles/:id` usano un payload coerente;
- il tenant selezionato in console resta persistente al refresh;
- il ruolo appena creato viene evidenziato nella UI;
- il tenant attivo e' mostrato in modo esplicito.

### Assegnazione ruoli agli utenti

- la create user supporta `role_ids` iniziali;
- il backend garantisce un solo ruolo di sistema coerente;
- i ruoli custom iniziali sono tenant-scoped;
- update utente e update assegnazioni restano coerenti con `users.ruolo`.

### UX console

- la sezione utenti tenant e' ora il focus principale;
- ruoli e permessi sono spostati nel pannello aperto da `Gestisci`;
- la console principale e' meno densa.

### Audit

- esistono eventi dedicati per:
  - update ruoli utente;
  - cambio ruolo di sistema;
  - update ruoli custom;
  - creazione e update ruoli tenant;
  - update permessi ruolo tenant.

## Limiti della verifica automatica

Non e' stata eseguita in questa fase una suite E2E browser reale sulla console daemon.

Quindi restano da verificare manualmente in ambiente locale/runtime:

- apertura pannello `Gestisci`;
- creazione ruolo da UI reale;
- refresh pagina con tenant persistente;
- creazione utente con ruoli custom iniziali;
- modifica assegnazioni utente in presenza di piu' ruoli custom;
- lettura audit log da sezione daemon dedicata.

## Checklist manuale raccomandata

### Caso 1. Creazione ruolo custom

1. aprire `/daemon/console`;
2. selezionare un tenant non di default;
3. cliccare `Gestisci`;
4. creare un ruolo custom;
5. verificare comparsa immediata del ruolo;
6. chiudere e riaprire il pannello;
7. refresh della pagina;
8. verificare che il tenant resti lo stesso e il ruolo sia ancora presente.

### Caso 2. Creazione utente con ruoli custom

1. restare sul tenant corretto;
2. creare un utente con ruolo base `DENTISTA`;
3. selezionare uno o piu' ruoli custom iniziali;
4. creare l'utente;
5. verificare che l'utente abbia:
   - ruolo base `DENTISTA`;
   - ruolo di sistema `DENTISTA` assegnato;
   - ruoli custom selezionati.

### Caso 3. Update assegnazioni utente

1. aprire un utente esistente;
2. aggiungere un ruolo custom;
3. salvare assegnazioni;
4. rimuovere un ruolo custom;
5. cambiare ruolo di sistema;
6. verificare che resti sempre un solo ruolo di sistema.

### Caso 4. Isolamento tenant

1. creare un ruolo custom nel tenant A;
2. passare al tenant B;
3. verificare che il ruolo non compaia;
4. provare a creare utenti nel tenant B;
5. verificare che il ruolo del tenant A non sia selezionabile.

### Caso 5. Audit operativo

1. creare ruolo custom;
2. modificare permessi ruolo;
3. creare utente con ruoli custom;
4. cambiare ruolo di sistema utente;
5. aggiungere/rimuovere ruoli custom;
6. verificare che i log daemon riflettano i nuovi eventi in modo leggibile.

## Esito finale della roadmap

La roadmap definita nel documento:

- [PIANO-RUOLI-CUSTOM-DAEMON-E-UI-UTENTI-HALO.md](/Users/francescostrano/Desktop/HALO/Documenti/v1.2/PIANO-RUOLI-CUSTOM-DAEMON-E-UI-UTENTI-HALO.md)

puo' considerarsi completata sul piano implementativo principale.

Risultato ottenuto:

- i ruoli custom sono trattati come tenant-scoped;
- la console daemon li rende visibili e governabili in modo piu' coerente;
- gli utenti tenant possono ricevere correttamente ruoli custom;
- la UX ha separato meglio gestione utenti e gestione ruoli;
- audit e hardening risultano piu' leggibili e piu' utili operativamente.

## Prossimo passo consigliato

Eseguire una sessione manuale breve di smoke test in browser sulla console daemon con due tenant distinti e almeno:

- 1 ruolo custom per tenant;
- 1 utente creato con ruoli custom iniziali;
- 1 cambio ruolo di sistema;
- 1 verifica log.
