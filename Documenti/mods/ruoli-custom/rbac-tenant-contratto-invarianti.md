# RBAC TENANT - CONTRATTO E INVARIANTI HALO

Data: `05 Aprile 2026`
Ambito: `tenant RBAC + daemon governance`
Stato: `fase 0 completata`

## Scopo

Questo documento formalizza il contratto RBAC tenant che deve valere da questo punto in avanti per HALO.

Serve a eliminare le ambiguita' tra:

- `users.ruolo`
- `roles.is_system = TRUE`
- `roles.is_system = FALSE`
- `user_roles`

Tutte le fasi successive del piano ruoli custom daemon devono rispettare questo contratto.

## Modello concettuale

Nel tenant esistono due famiglie di ruoli:

### 1. Ruoli di sistema

Sono i ruoli legacy/core:

- `ADMIN`
- `DENTISTA`
- `SEGRETARIO`

Caratteristiche:

- sono tenant-scoped;
- esistono per ogni tenant;
- hanno `is_system = TRUE`;
- rappresentano il ruolo operativo base dell'utente;
- restano il ponte di compatibilita' con il gestionale esistente.

### 2. Ruoli custom

Sono ruoli creati da daemon per il singolo tenant.

Caratteristiche:

- sono tenant-scoped;
- hanno `is_system = FALSE`;
- non sostituiscono il ruolo di sistema;
- estendono i permessi dell'utente;
- possono avere qualunque `role_key` consentito, purché univoco nel tenant.

## Significato delle strutture dati

### `users.ruolo`

`users.ruolo` rappresenta il ruolo di sistema primario dell'utente.

Non rappresenta:

- l'insieme completo dei ruoli assegnati;
- i ruoli custom;
- una permission set completa.

Va trattato come:

- campo legacy ancora attivo;
- sorgente compatibile per le aree del prodotto che non leggono ancora `user_roles`;
- rappresentazione semplificata del ruolo di sistema principale.

### `roles`

La tabella `roles` contiene sia ruoli di sistema sia ruoli custom.

Interpretazione:

- `is_system = TRUE`: ruolo di sistema;
- `is_system = FALSE`: ruolo custom tenant.

Vincoli logici:

- un ruolo appartiene sempre a un solo tenant;
- `role_key` deve essere univoco all'interno dello stesso tenant;
- un ruolo non puo' essere usato da tenant diversi.

### `role_permissions`

`role_permissions` contiene i permessi associati al ruolo.

Interpretazione:

- per i ruoli di sistema contiene il set permessi standard;
- per i ruoli custom contiene il set permessi esteso o specializzato del tenant.

### `user_roles`

`user_roles` contiene l'insieme completo dei ruoli realmente assegnati all'utente.

Questo e' il modello autorevole delle assegnazioni.

## Invarianti obbligatorie

### Invariante 1. Ogni utente tenant deve avere esattamente un ruolo di sistema assegnato

Forma valida:

- 1 ruolo di sistema;
- 0 o piu' ruoli custom.

Forme non valide:

- 0 ruoli di sistema;
- 2 o piu' ruoli di sistema.

### Invariante 2. `users.ruolo` deve sempre coincidere con il ruolo di sistema assegnato in `user_roles`

Se l'utente ha come ruolo di sistema `DENTISTA`, allora:

- `users.ruolo = 'DENTISTA'`
- in `user_roles` deve esistere il ruolo `DENTISTA` di quel tenant.

### Invariante 3. I ruoli custom sono additivi

Un ruolo custom:

- non puo' rimpiazzare il ruolo base;
- non puo' essere l'unico ruolo assegnato all'utente;
- puo' solo aggiungersi al ruolo di sistema.

### Invariante 4. I ruoli sono sempre tenant-scoped

Ogni operazione su ruoli e assegnazioni deve essere filtrata per `studio_id`.

Non deve mai essere possibile:

- elencare un ruolo custom di un altro tenant;
- assegnare a un utente un ruolo di un altro tenant;
- modificare un ruolo usando un tenant errato.

### Invariante 5. I ruoli di sistema restano protetti

I ruoli di sistema:

- non vengono creati come ruoli custom;
- non vengono editati come un normale ruolo custom dalla console daemon;
- restano garantiti dal backend per ogni tenant.

### Invariante 6. L'ultimo `ADMIN` non puo' essere rimosso o declassato

Se un tenant ha un solo `ADMIN`, non e' consentito:

- eliminare quell'utente;
- cambiare il suo ruolo di sistema in qualcosa di diverso da `ADMIN`;
- lasciarlo senza assegnazione `ADMIN` coerente.

## Regole di interpretazione backend

Il backend deve applicare le seguenti regole:

- `create user`:
  - crea l'utente con un ruolo di sistema valido;
  - assicura l'assegnazione coerente in `user_roles`;
- `update user ruolo`:
  - cambia `users.ruolo`;
  - sostituisce il ruolo di sistema in `user_roles`;
  - preserva i ruoli custom;
- `update user role assignments`:
  - accetta un set completo di ruoli;
  - valida che esista esattamente un ruolo di sistema;
  - sincronizza `users.ruolo` con il ruolo di sistema selezionato;
- `create custom role`:
  - crea un ruolo non di sistema scoped al tenant;
  - non puo' riutilizzare le chiavi di sistema;
- `list roles`:
  - mostra solo ruoli del tenant richiesto.

## Regole di interpretazione frontend

Il frontend daemon deve riflettere lo stesso modello.

### Creazione utente

La UI deve rendere chiaro che:

- l'utente ha un ruolo base di sistema;
- eventuali ruoli custom sono aggiuntivi.

### Modifica utente

La UI deve mantenere coerenti:

- il selettore del ruolo di sistema;
- l'elenco delle assegnazioni ruolo.

Se cambia il ruolo di sistema, la UI deve aggiornare le assegnazioni.  
Se si seleziona un ruolo di sistema nelle assegnazioni, la UI deve aggiornare il ruolo base.

### Gestione ruoli

La UI deve distinguere chiaramente:

- ruoli di sistema;
- ruoli custom.

I ruoli custom devono essere visibilmente:

- tenant-scoped;
- assegnabili agli utenti del tenant;
- non confondibili con il ruolo base.

## Casi validi

### Caso A

Utente:

- `users.ruolo = DENTISTA`
- `user_roles = [DENTISTA]`

Valido.

### Caso B

Utente:

- `users.ruolo = DENTISTA`
- `user_roles = [DENTISTA, RESPONSABILE_AGENDA]`

Valido.

### Caso C

Utente:

- `users.ruolo = SEGRETARIO`
- `user_roles = [SEGRETARIO, CASSA, CUSTOMER_CARE]`

Valido.

## Casi non validi

### Caso D

Utente:

- `users.ruolo = DENTISTA`
- `user_roles = [RESPONSABILE_AGENDA]`

Non valido: manca il ruolo di sistema assegnato.

### Caso E

Utente:

- `users.ruolo = DENTISTA`
- `user_roles = [DENTISTA, SEGRETARIO]`

Non valido: due ruoli di sistema.

### Caso F

Utente del tenant A con assegnato un ruolo custom del tenant B.

Non valido: contaminazione cross-tenant.

## Conseguenze per le prossime fasi

Le prossime fasi dovranno usare questo contratto come riferimento per:

- hardening backend;
- create/list/update ruoli;
- create/update utenti;
- redesign UI daemon;
- audit e test.

## Definizione di completamento Fase 0

La Fase 0 si considera completata quando:

- il modello RBAC tenant e' esplicitato in modo univoco;
- i termini `ruolo di sistema`, `ruolo custom`, `ruolo primario`, `assegnazione ruolo` non sono piu' ambigui;
- le fasi successive possono essere implementate senza reinterpretare il dominio.
