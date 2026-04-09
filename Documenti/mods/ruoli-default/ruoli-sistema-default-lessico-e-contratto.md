# RUOLI SISTEMA DEFAULT - LESSICO E CONTRATTO HALO

Data: `05 Aprile 2026`
Ambito: `ruoli di sistema tenant + semantica multi-settore`
Stato: `fase 0 completata`

## Scopo

Questo documento formalizza il contratto semantico dei ruoli di sistema per le nuove attivita' create da daemon.

Serve a separare:

- nome tecnico di piattaforma;
- label mostrata all'utente per verticale;
- compatibilita' con il legacy `DENTISTA`.

Tutte le fasi successive del piano devono rispettare questo contratto.

## Problema semantico attuale

Oggi HALO usa `DENTISTA` come ruolo di sistema tecnico in molti punti del codice.

Questo crea un problema strutturale:

- il ruolo sembra corretto solo per il verticale dentistico;
- finisce per apparire come default universale anche per attivita' non dentistiche;
- la UI e il bootstrap ereditano un lessico di dominio che non e' neutro.

## Nuovo contratto target per le nuove attivita'

Per ogni nuova attivita' creata da daemon i ruoli di sistema target devono essere:

- `ADMIN`
- `SEGRETARIO`
- `DIPENDENTE`

## Significato dei ruoli di sistema

### `ADMIN`

Ruolo amministrativo principale del tenant.

Significato:

- gestione completa tenant;
- configurazione;
- utenti;
- supervisione operativa.

### `SEGRETARIO`

Ruolo di coordinamento operativo e amministrativo.

Significato:

- agenda;
- clienti;
- fatture;
- automazioni compatibili col perimetro assegnato.

### `DIPENDENTE`

Ruolo operativo base neutro di piattaforma.

Significato:

- sostituisce `DENTISTA` come ruolo tecnico universale;
- rappresenta il ruolo esecutivo/operativo del professionista o operatore;
- non impone un lessico dentistico al sistema.

## Distinzione tra nome tecnico e label di verticale

Il ruolo tecnico di piattaforma puo' essere `DIPENDENTE`, ma la label mostrata puo' cambiare in base al verticale.

Esempi:

- verticale dental: label visibile `Dentista`
- verticale medical: label visibile `Medico`
- verticale physiotherapy: label visibile `Terapista`
- verticale aesthetics: label visibile `Operatore`
- verticale consulting: label visibile `Consulente`
- verticale services: label visibile `Operatore`

Quindi:

- `DIPENDENTE` e' il role key tecnico;
- la label mostrata dipende dal verticale;
- il frontend non deve dedurre il dominio dal role key tecnico.

## Compatibilita' legacy

Il sistema ha ancora molti punti che usano `DENTISTA`:

- enum DB legacy;
- seed SQL;
- route e validazioni backend;
- union type frontend;
- filtri UI;
- bootstrap e dashboard.

Per questo il passaggio va trattato come refactor controllato, non come semplice rename superficiale.

## Regola di transizione

Durante la transizione valgono queste regole:

- per i tenant nuovi il target e' `DIPENDENTE`;
- per i tenant esistenti bisogna prevedere una migrazione dedicata;
- finche' la migrazione non e' completata, il sistema deve sapere distinguere:
  - tenant legacy con `DENTISTA`
  - tenant nuovi con `DIPENDENTE`

La transizione non deve restare implicita o indefinita.

## Invarianti semantiche

### Invariante 1. `DENTISTA` non deve piu' essere il default tecnico universale

Può sopravvivere solo:

- come label verticale;
- come valore legacy da migrare;
- come compatibilita' transitoria.

### Invariante 2. Le nuove attivita' hanno tre ruoli di sistema fissi

Per le nuove attivita':

- `ADMIN`
- `SEGRETARIO`
- `DIPENDENTE`

e nessun altro ruolo di sistema di default.

### Invariante 3. Il lessico di verticale non ridefinisce il role key tecnico

Il verticale cambia la label mostrata, non il contratto tecnico sottostante.

### Invariante 4. Dropdown e menu devono usare dati reali del tenant

I selettori UI non devono piu' essere guidati da enum statiche legacy se il backend espone un set reale e aggiornato di ruoli.

### Invariante 5. `settings_json` resta indipendente dal refactor dei ruoli

Il problema di persistenza di `settings_json` va trattato come bug separato:

- non va nascosto dal refactor ruoli;
- non va risolto con workaround UI locali.

## Implicazioni per le fasi successive

### Backend

Nelle fasi successive dovranno cambiare:

- cataloghi ruoli;
- permessi default;
- provisioning tenant;
- repair RBAC;
- seed/schema;
- bootstrap.

### Frontend

Nelle fasi successive dovranno cambiare:

- menu a tendina hardcoded;
- union types statiche ruolo;
- mapping label di ruolo;
- pagine che assumono `DENTISTA` come caso standard.

### Dati

Nelle fasi successive dovra' essere definita:

- migrazione dei tenant esistenti;
- strategia di convivenza temporanea;
- verifica consistenza su utenti e user_roles.

## Casi target validi per nuove attivita'

### Caso A

Nuovo tenant `services`:

- ruoli di sistema:
  - `ADMIN`
  - `SEGRETARIO`
  - `DIPENDENTE`
- label visibile del ruolo operativo:
  - `Operatore`

### Caso B

Nuovo tenant `dental`:

- ruoli di sistema:
  - `ADMIN`
  - `SEGRETARIO`
  - `DIPENDENTE`
- label visibile del ruolo operativo:
  - `Dentista`

### Caso C

Nuovo tenant `medical`:

- ruoli di sistema:
  - `ADMIN`
  - `SEGRETARIO`
  - `DIPENDENTE`
- label visibile del ruolo operativo:
  - `Medico`

## Casi non validi

### Caso D

Nuovo tenant creato con ruoli default:

- `ADMIN`
- `SEGRETARIO`
- `DENTISTA`

Non valido: il default tecnico universale resta legato al dental.

### Caso E

Dropdown frontend che mostra sempre:

- `ADMIN`
- `DENTISTA`
- `SEGRETARIO`

Non valido: la UI continua a usare un enum legacy fisso.

### Caso F

Role key tecnico `DIPENDENTE` ma label visibile uguale per tutti i vertical.

Non valido: si perderebbe la contestualizzazione di dominio lato UX.

## Definizione di completamento Fase 0

La Fase 0 si considera completata quando:

- il nuovo set di ruoli di sistema target e' esplicitato;
- e' chiaro che `DIPENDENTE` e' il role key tecnico target;
- e' chiaro che `DENTISTA` puo' restare solo come label verticale o compatibilita' legacy;
- le fasi successive possono intervenire su backend, frontend e dati con un contratto univoco.
