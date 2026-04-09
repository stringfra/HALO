# Creazione Tenant Daemon Fase 9

Data: `04 Aprile 2026`
Stato: `completata`

## Obiettivo

Definire in anticipo come trattare errori, conflitti e rollback del workflow di creazione tenant da `daemon`.

## Principio guida

La regola fondamentale e':

- nessun tenant parziale deve restare persistito

Il workflow deve quindi distinguere chiaramente tra:

- errori pre-scrittura
- errori durante la transazione
- errori post-commit

## Classi di errore

### 1. Errori di input

Esempi:

- payload JSON non valido
- chiavi non supportate
- campi obbligatori mancanti
- `vertical_key` non valido
- password admin debole

Comportamento:

- nessuna transazione avviata
- risposta `400`

### 2. Errori di conflitto

Esempi:

- `code` tenant gia' esistente
- collisione email admin

Comportamento:

- se possibile rilevarli prima della scrittura
- se emergono da vincolo DB, tradurli in `409`
- nessun dato persistito

### 3. Errori di orchestrazione transazionale

Esempi:

- insert tenant fallita
- errore nella creazione ruoli di sistema
- errore nella creazione admin iniziale
- errore nell'assegnazione ruoli admin
- errore nella creazione eventuali override iniziali

Comportamento:

- `ROLLBACK` obbligatorio
- risposta `500` o `400` a seconda della natura dell'errore

### 4. Errori post-commit

Esempi:

- fallimento scrittura audit dopo la creazione
- fallimento di una rilettura accessoria non critica dopo `COMMIT`

Comportamento:

- nessun rollback possibile del tenant gia' creato
- errore da trattare in modo esplicito e tracciabile

## Confine della transazione

Devono stare dentro la transazione tutte le scritture core:

- creazione record in `studi`
- costruzione e persistenza settings iniziali
- creazione ruoli di sistema
- permessi ruolo
- creazione admin iniziale
- assegnazione ruolo `ADMIN`
- eventuali override iniziali strettamente necessari

Non devono necessariamente stare dentro la stessa transazione:

- audit successivo
- aggiornamenti puramente informativi post-creazione

## Matrice errori principali

### Caso 1. `code` duplicato

Effetto:

- il tenant non va creato

Gestione consigliata:

- controllare unicita' prima dell'insert
- gestire anche l'eventuale `23505` dal database

Risposta:

- `409`
- `Tenant code gia in uso.`

Rollback:

- non necessario se intercettato prima
- obbligatorio se emerso durante transazione

### Caso 2. `vertical_key` non valido

Effetto:

- il bootstrap non e' risolvibile

Risposta:

- `400`
- `vertical_key non supportato.`

Rollback:

- nessuna scrittura deve partire

### Caso 3. errore nella creazione ruoli

Effetto:

- il tenant non e' realmente operativo

Risposta:

- `500`
- `Errore nella creazione tenant da daemon.`

Rollback:

- obbligatorio

### Caso 4. errore nella creazione admin iniziale

Effetto:

- tenant nato ma senza accesso amministrativo

Risposta:

- `500` oppure `409` se il problema e' conflitto email

Rollback:

- obbligatorio

### Caso 5. errore assegnazione ruolo `ADMIN`

Effetto:

- utente creato ma RBAC incoerente

Risposta:

- `500`

Rollback:

- obbligatorio

### Caso 6. errore su override feature iniziali

Effetto:

- tenant potenzialmente incoerente con bootstrap previsto

Risposta:

- `500`

Rollback:

- obbligatorio se gli override fanno parte della creazione core

### Caso 7. errore audit successivo al `COMMIT`

Effetto:

- tenant creato, audit incompleto

Risposta consigliata:

- il tenant non va cancellato retroattivamente
- il fallimento audit deve essere loggato e reso visibile operativamente

Nota:

- questo punto va reso esplicito anche in QA

## Strategia di mapping errori

Mappatura consigliata:

- `400`
  per errori di validazione o payload

- `404`
  da usare solo dove ha senso nel dominio, non per creazione tenant valida

- `409`
  per conflitti logici o di unicita'

- `500`
  per errori interni di orchestrazione o transazione

## Forma consigliata degli errori

### Errore validazione

```json
{
  "message": "Payload creazione tenant non valido.",
  "validation_errors": [
    {
      "path": "admin.password",
      "message": "Deve rispettare i requisiti di password forte."
    }
  ],
  "requestId": "..."
}
```

### Errore conflitto

```json
{
  "message": "Tenant code gia in uso.",
  "requestId": "..."
}
```

### Errore interno

```json
{
  "message": "Errore nella creazione tenant da daemon.",
  "requestId": "..."
}
```

## Requisito `requestId`

Dato che il backend HALO allega gia' `x-request-id`, gli errori della creazione tenant dovrebbero preservare sempre questo riferimento.

Motivo:

- facilita troubleshooting su operazioni amministrative ad alta criticita'

## Decisione su audit failure post-commit

Decisione consigliata per la prima versione:

- il tenant resta valido se la creazione core e' stata committata
- il fallimento audit post-commit va considerato incidente operativo
- il sistema deve esporre chiaramente il problema nei log di piattaforma o nel monitoraggio tecnico

Questa e' la scelta piu pragmatica rispetto a un rollback impossibile dopo `COMMIT`.

## Anti-pattern da evitare

Da evitare:

- `COMMIT` dopo il solo insert del tenant
- rollback parziale non controllato
- tradurre ogni errore in `500` indistinto
- nascondere conflitti veri dietro messaggi generici
- dichiarare successo prima che admin e ruoli siano completi

## Decisioni prese in questa fase

- nessun tenant parziale persistito
- transazione obbligatoria per tutte le scritture core
- conflitti mappati a `409`
- validazioni mappate a `400`
- audit post-commit trattato come incidente separato, non come rollback impossibile

## Output prodotto

- matrice errori principali
- perimetro del rollback
- regole di mapping HTTP
- strategia per i fallimenti post-commit

## Prossimo passo

La fase successiva e':

- `Fase 10. QA tecnica finale`
