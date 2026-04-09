# Fase 7: QA e regressione finale

## Obiettivo

Chiudere la roadmap con una verifica finale delle aree toccate:

- ruoli di sistema default per nuove attivita;
- migrazione legacy `DENTISTA -> DIPENDENTE`;
- vertical template e label;
- dropdown e selettori frontend;
- bootstrap tenant;
- persistenza reale di `settings_json`.

## Verifiche automatiche eseguite

### Backend

Comando:

- `npm test`

Esito:

- 9 test passati
- 0 falliti

Copertura verificata dai test presenti:

- hardening e catalogo eventi daemon;
- coerenza dei vertical statici col nuovo set default;
- alias verticale del ruolo practitioner;
- merge sicuro dei payload `settings_json`.

### Frontend

Comandi:

- `npm test`
- `eslint` locale sui file frontend modificati

Esito:

- test frontend: 3 passati, 0 falliti
- lint file modificati: verde

Copertura verificata:

- smoke test area daemon gia presente nel frontend;
- coerenza statica dei file toccati in:
  - sessione auth
  - bootstrap
  - app shell
  - dashboard
  - utenti
  - pazienti
  - daemon console
  - wizard nuova azienda daemon

## Esito complessivo della roadmap

La roadmap e chiusa su tutte le fasi previste.

Risultato raggiunto:

- le nuove attivita usano `ADMIN`, `SEGRETARIO`, `DIPENDENTE`;
- `DENTISTA` non e piu il default tecnico universale per le nuove attivita;
- i tenant legacy hanno un percorso di migrazione controllato;
- backend e frontend accettano `DIPENDENTE`;
- i selettori principali non dipendono piu da hardcode legacy;
- il bootstrap tenant e usato come fonte primaria dal frontend;
- `settings_json` non viene piu perso su update parziali supportati.

## Limiti residui

Questa chiusura non sostituisce ancora uno smoke test manuale completo su browser e tenant reali.

Restano consigliati i seguenti test manuali:

1. creare una nuova attivita da daemon e verificare che i ruoli di sistema siano:
   - `ADMIN`
   - `SEGRETARIO`
   - `DIPENDENTE`
2. verificare che nella console daemon il ruolo operativo base appaia con label verticale corretta.
3. creare/modificare utenti tenant e controllare che `DIPENDENTE` sia selezionabile e persistente.
4. migrare un tenant legacy da daemon e verificare che utenti e assegnazioni restino coerenti.
5. modificare `settings_json`, ricaricare pagina e riavviare applicazione, poi controllare che i valori restino presenti.

## Conclusione

Dal punto di vista implementativo e di regressione automatica, la roadmap puo essere considerata chiusa.
