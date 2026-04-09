# Creazione Tenant Daemon Fase 10

Data: `04 Aprile 2026`
Stato: `completata`

## Obiettivo

Chiudere il piano di creazione tenant da `daemon` con una strategia di validazione finale coerente, verificabile e aderente al comportamento reale atteso in HALO.

## Esito della fase

Stato finale della fase: `OK a livello di specifica tecnica`

Questa fase chiude il piano documentale definendo con precisione:

- verifiche backend minime
- verifiche frontend minime
- scenari E2E minimi
- limiti di validazione
- criterio finale di successo del workflow

## Verifiche backend da eseguire quando il workflow verra' implementato

### 1. Creazione tenant valida

Verificare che:

- il tenant venga creato con payload valido
- il record in `studi` sia coerente
- `settings_version` parta correttamente
- il vertical sia risolvibile

Esito atteso:

- `201 Created`

### 2. Rifiuto di `code` duplicato

Verificare che:

- due tenant con stesso `code` non possano essere creati

Esito atteso:

- `409 Conflict`
- nessuna creazione parziale

### 3. Rifiuto di `vertical_key` invalido

Verificare che:

- il workflow rifiuti vertical non supportati

Esito atteso:

- `400 Bad Request`

### 4. Rifiuto di password admin debole

Verificare che:

- il workflow rifiuti password che non rispettano la policy del progetto

Esito atteso:

- `400 Bad Request`

### 5. Rollback su errore intermedio

Verificare che:

- un errore nella creazione ruoli
- un errore nella creazione admin
- un errore nell'assegnazione ruolo `ADMIN`

producano:

- `ROLLBACK`
- nessun tenant persistito

### 6. Bootstrap tenant leggibile subito dopo la creazione

Verificare che il tenant appena creato sia subito leggibile da:

- `getTenantConfigById(...)`
- `/api/bootstrap`

Esito atteso:

- nessuna eccezione
- payload coerente con vertical, labels, navigation e feature flags

### 7. Audit creato correttamente

Verificare che vengano scritti correttamente:

- audit platform
- audit tenant

per gli eventi previsti di creazione tenant.

## Verifiche frontend da eseguire quando la UI verra' implementata

### 1. Wizard completabile

Verificare che:

- tutti gli step siano navigabili
- la bozza dati non si perda senza motivo

### 2. Validazioni client coerenti col backend

Verificare che:

- i campi obbligatori siano segnalati
- il `code` sia guidato come slug
- la password admin sia verificata prima dell'invio

### 3. Riepilogo finale corretto

Verificare che il riepilogo mostri in modo chiaro:

- azienda
- codice tenant
- vertical
- locale
- timezone
- admin iniziale
- bootstrap previsto

### 4. Gestione stato finale

Verificare che dopo il successo la UI mostri:

- tenant creato
- admin creato
- CTA successive utili

### 5. Gestione errori leggibile

Verificare che la UI distingua tra:

- errore di validazione
- conflitto
- errore interno

## Scenari E2E minimi

### Scenario 1

`daemon` crea un tenant valido.

Esito atteso:

- tenant creato correttamente

### Scenario 2

Il tenant appare nel tenant registry daemon.

Esito atteso:

- nuova azienda visibile nella lista tenant

### Scenario 3

L'admin iniziale puo' autenticarsi.

Esito atteso:

- login tenant standard riuscito

### Scenario 4

`/api/bootstrap` risponde correttamente per il nuovo tenant.

Esito atteso:

- payload con tenant, labels, feature flags, roles e navigation

### Scenario 5

La navigazione tenant e' coerente col vertical scelto.

Esito atteso:

- menu coerente
- nessuna route incoerente rispetto a feature e permessi

### Scenario 6

La creazione tenant e' auditata.

Esito atteso:

- eventi presenti nei log platform
- eventi presenti nei log tenant dove previsto

## Limiti della validazione

Questa fase chiude la QA a livello di piano, non a livello di esecuzione runtime reale.

Non sono stati eseguiti in questa fase:

- test automatici reali sul workflow di creazione tenant
- test E2E browser reali
- validazione runtime contro PostgreSQL popolato
- login reale dell'admin iniziale appena creato

Questi punti potranno essere chiusi solo dopo l'implementazione effettiva.

## Rischi residui da monitorare in implementazione

- mismatch tra vertical template e bootstrap effettivo
- duplicazione non voluta di settings o feature override
- tenant creato correttamente ma navigation vuota per errore RBAC
- audit post-commit fallito
- UX troppo densa nella console daemon

## Criterio finale di successo del piano

Il piano puo' dirsi implementato con successo solo quando, a runtime:

- `daemon` crea una nuova azienda con una sola operazione
- il tenant nasce coerente con vertical, labels, feature e ruoli
- l'admin iniziale puo' entrare subito
- `/api/bootstrap` funziona senza errori per il tenant creato
- la creazione e' tracciata in audit

## Valutazione finale

Il piano `PIANO-CREAZIONE-TENANT-DAEMON-HALO.md` puo' considerarsi completato a livello di progettazione tecnica locale.

Risultato ottenuto:

- lessico chiarito
- contratto definito
- validazioni definite
- servizio orchestrato progettato
- bootstrap iniziale progettato
- admin iniziale progettato
- API daemon definita
- audit definito
- UI wizard definita
- rollback definito
- QA finale formalizzata

## Prossimo passo naturale

Il passo successivo non documentale e':

- avviare l'implementazione della Fase 1 applicativa del workflow
