# Creazione Tenant Daemon Fase 2

Data: `04 Aprile 2026`
Stato: `completata`

## Obiettivo

Definire la matrice di validazioni server-side e le regole di dominio del workflow di creazione tenant da `daemon`.

## Principio guida

Le validazioni devono impedire tre classi di errore:

- input formalmente non valido
- input formalmente valido ma semanticamente incoerente
- creazione di un tenant tecnicamente persistito ma non realmente operativo

## Fonti tecniche gia' presenti nel progetto

Le regole di questa fase sono coerenti con il codice esistente in:

- `backend/src/validation/input.js`
- `backend/src/services/tenant-settings-validation.service.js`
- `backend/src/services/tenant-config.service.js`
- `backend/src/config/multi-sector.js`

## Matrice validazioni input

### 1. `code`

Stato:

- obbligatorio

Regole:

- stringa non vuota
- trim automatico
- lowercase obbligatorio
- formato slug stabile consigliato
- solo lettere minuscole, numeri e trattini
- lunghezza consigliata 3-80 caratteri
- univoco a livello piattaforma

Esempi validi:

- `roma-centro`
- `studio-dental-01`

Esempi da rifiutare:

- `Roma Centro`
- `studio_roma`
- `abc/123`
- stringa gia' presente in `studi.codice`

Errore consigliato:

- `code non valido o gia' esistente.`

### 2. `tenant_name`

Stato:

- obbligatorio

Regole:

- stringa obbligatoria
- testo normalizzato
- lunghezza consigliata 2-120 caratteri

Errore consigliato:

- `tenant_name non valido.`

### 3. `display_name`

Stato:

- obbligatorio

Regole:

- stringa obbligatoria
- testo normalizzato
- lunghezza consigliata 2-120 caratteri
- deve restare adatto a rendering UI

Errore consigliato:

- `display_name non valido.`

### 4. `business_name`

Stato:

- obbligatorio nella prima versione

Regole:

- stringa obbligatoria
- testo normalizzato
- lunghezza consigliata 2-160 caratteri

Errore consigliato:

- `business_name non valido.`

### 5. `vertical_key`

Stato:

- obbligatorio

Regole:

- stringa obbligatoria
- deve appartenere ai vertical supportati da `multi-sector`
- deve essere risolvibile da configurazione verticale e template collegato

Errore consigliato:

- `vertical_key non supportato.`

### 6. `locale`

Stato:

- obbligatorio nella prima versione

Regole:

- stringa obbligatoria
- formato applicativo breve e consistente, ad esempio `it-IT`
- lunghezza massima consigliata 16

Errore consigliato:

- `locale non valida.`

### 7. `timezone`

Stato:

- obbligatorio nella prima versione

Regole:

- stringa obbligatoria
- deve essere una timezone IANA valida, ad esempio `Europe/Rome`
- lunghezza massima consigliata 64

Errore consigliato:

- `timezone non valida.`

### 8. `admin.name`

Stato:

- obbligatorio

Regole:

- stringa obbligatoria
- testo normalizzato
- lunghezza consigliata 2-120 caratteri

Errore consigliato:

- `admin.name non valido.`

### 9. `admin.email`

Stato:

- obbligatorio

Regole:

- stringa obbligatoria
- email formalmente valida
- lowercase consigliato a salvataggio
- non deve essere gia' presente nello stesso tenant

Nota:

Dato che il tenant e' nuovo, la collisione intra-tenant sara' rara, ma la regola deve comunque esistere nel contratto.

Errore consigliato:

- `admin.email non valida.`

### 10. `admin.password`

Stato:

- obbligatorio nella prima versione

Regole:

- password forte obbligatoria
- almeno una minuscola
- almeno una maiuscola
- almeno un numero
- almeno un carattere speciale
- niente spazi
- lunghezza minima coerente con `isStrongPassword(...)`

Errore consigliato:

- `admin.password non valida o non sufficientemente forte.`

## Regole di dominio

### Regola 1. Il tenant deve nascere con un vertical valido

Il vertical non e' un metadato secondario.

Nel modello HALO attuale serve per derivare:

- labels
- feature default
- navigazione
- ruoli disponibili

Un tenant senza vertical valido va rifiutato.

### Regola 2. Il tenant non deve nascere senza admin iniziale

La creazione tenant senza utente amministratore deve essere vietata nella prima versione.

Motivo:

- produce un ambiente tecnicamente creato ma non realmente operativo

### Regola 3. Il tenant non deve nascere senza ruoli di sistema

Se il bootstrap ruoli non e' completabile, la creazione va considerata fallita.

### Regola 4. Il `code` tenant deve essere trattato come identificatore stabile

Il codice tenant va considerato immutabile o modificabile solo con workflow eccezionale futuro.

Nel contratto iniziale non deve essere previsto rename libero del `code`.

### Regola 5. Nessun tenant parziale

Se fallisce uno dei blocchi critici:

- tenant base
- ruoli
- admin iniziale
- associazione ruoli admin

allora l'intera creazione va annullata.

### Regola 6. Nessun campo arbitrario in input

Il payload iniziale deve essere chiuso e con chiavi note.

Non devono essere accettati campi extra non previsti dal contratto.

### Regola 7. Nessun settings libero nella prima versione

Nella prima iterazione e' sconsigliato permettere `settings_json` arbitrario nel payload di creazione.

Motivo:

- aumenta troppo la superficie di invalidazione
- aggira il bootstrap guidato
- rende piu fragile il primo rilascio del workflow

### Regola 8. Nessuna feature override arbitraria nella prima versione

Le feature iniziali devono derivare dal vertical template.

Eventuali override custom possono essere fase successiva.

## Casi di rifiuto espliciti

La creazione tenant deve essere rifiutata almeno in questi casi:

- `code` assente
- `code` duplicato
- `code` fuori formato
- `tenant_name` assente
- `display_name` assente
- `business_name` assente
- `vertical_key` sconosciuto
- `locale` assente o fuori formato
- `timezone` assente o invalida
- `admin.name` assente
- `admin.email` invalida
- `admin.password` debole
- payload con chiavi extra non supportate

## Errori applicativi consigliati

Per chiarezza operativa, gli errori dovrebbero essere restituiti con:

- messaggio sintetico
- campo coinvolto
- motivo del rifiuto

Esempio forma consigliata:

```json
{
  "message": "Payload creazione tenant non valido.",
  "validation_errors": [
    {
      "path": "code",
      "message": "Deve essere uno slug univoco di 3-80 caratteri."
    },
    {
      "path": "admin.password",
      "message": "Deve rispettare i requisiti di password forte."
    }
  ]
}
```

## Decisioni prese in questa fase

- il payload iniziale resta stretto e guidato
- niente configurazioni arbitrarie nella prima versione
- il `code` tenant e' trattato come identificatore stabile
- il vertical e l'admin iniziale sono obbligatori
- la password dell'admin iniziale e' obbligatoria nella prima versione

## Output prodotto

- matrice validazioni input
- regole di dominio esplicite
- casi di rifiuto espliciti
- forma consigliata degli errori

## Prossimo passo

La fase successiva e':

- `Fase 3. Progettazione servizio backend orchestrato`
