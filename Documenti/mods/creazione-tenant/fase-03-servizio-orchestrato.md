# Creazione Tenant Daemon Fase 3

Data: `04 Aprile 2026`
Stato: `completata`

## Obiettivo

Definire il disegno del servizio backend orchestrato che dovra' creare un tenant end-to-end da console `daemon`.

## Principio guida

La creazione tenant non deve vivere dentro una route con logica sparsa.

La route dovra' solo:

- validare input base
- autorizzare l'operazione
- delegare a un servizio applicativo unico
- restituire il risultato finale

La responsabilita' di orchestrare tutti i passaggi deve essere centralizzata in un solo servizio dedicato.

## Servizio consigliato

Nome consigliato:

- `createTenantFromDaemon(...)`

Collocazione consigliata:

- nuovo servizio dedicato sotto `backend/src/services/`

## Responsabilita' del servizio

Il servizio deve governare l'intero workflow applicativo:

1. creare il tenant base
2. risolvere il vertical template
3. inizializzare settings tenant
4. inizializzare labels tenant
5. creare i ruoli di sistema
6. associare i permessi ai ruoli
7. creare il primo admin tenant
8. assegnare all'admin i ruoli corretti
9. preparare il tenant a bootstrap e navigazione
10. restituire un risultato unico, leggibile e coerente

## Dipendenze reali gia' riusabili

Il servizio dovrebbe riutilizzare il piu possibile la logica gia' presente:

- `vertical-templates.service`
  Per risolvere default di vertical, feature e labels

- `tenant-config.service`
  Per restare coerente con il modo in cui HALO legge il tenant finale

- `feature-flags.service`
  Per mantenere coerenza futura tra tenant creato e bootstrap moduli

- `daemon-admin-tools.service`
  In particolare la logica di `ensureSystemRolesForTenant(...)` per creare ruoli e permessi in modo coerente

- `permissions.service`
  Per restare allineati al modello permessi/ruoli gia' usato in bootstrap e UI

## Confine della route

La futura route daemon non dovrebbe contenere:

- query multiple di bootstrap
- creazione utenti
- creazione ruoli
- logica di rollback
- logica di merge settings/template

La route deve solo chiamare il servizio orchestratore.

## Disegno logico del servizio

Sequenza consigliata:

1. aprire una transazione database
2. verificare unicita' `code`
3. risolvere il vertical template
4. creare record in `studi`
5. costruire `settings_json` iniziale
6. creare o riallineare i ruoli di sistema
7. creare l'utente admin iniziale
8. collegare l'utente admin al ruolo `ADMIN`
9. opzionalmente creare override feature iniziali se previsti
10. leggere il tenant finale con il servizio standard
11. fare `COMMIT`
12. restituire il risultato

## Costruzione del record tenant base

Il primo blocco del servizio dovra' creare il record principale in `studi` con almeno:

- `codice`
- `nome`
- `display_name`
- `business_name`
- `vertical_key`
- `default_locale`
- `default_timezone`
- `settings_json`
- `settings_version`
- `is_active`

Scelta consigliata:

- inizializzare `settings_version` a `1`
- inizializzare `is_active` a `true` nella prima versione

## Gestione settings iniziali

Il servizio deve costruire uno `settings_json` iniziale minimo e coerente con il vertical.

Scelta consigliata:

- partire da `verticalTemplate.default_settings`
- fondere `default_labels` e `default_roles` dove necessario nel payload settings
- non accettare `settings_json` arbitrario dall'esterno nella prima versione

Questo evita che il tenant nasca con impostazioni incompatibili con il bootstrap.

## Gestione ruoli e permessi

Per il blocco RBAC la strategia consigliata e':

- non reinventare la logica ruolo/permessi
- riusare la stessa strategia gia' presente in `ensureSystemRolesForTenant(...)`

Risultato atteso:

- ruoli di sistema presenti
- permessi ruolo coerenti
- tenant immediatamente compatibile con `getUserPermissions(...)`

## Gestione admin iniziale

Il servizio deve creare l'admin iniziale nello stesso contesto transazionale.

Responsabilita' minime:

- hash password
- inserimento in `users`
- ruolo legacy impostato a `ADMIN`
- assegnazione del ruolo di sistema `ADMIN` in `user_roles`

Il servizio non deve delegare questo passaggio a una chiamata esterna successiva.

## Lettura finale del tenant creato

Prima del `COMMIT` o subito dopo, il servizio dovrebbe ricostruire lo stato finale usando gli stessi servizi letti dal resto dell'applicazione.

Scelta consigliata:

- leggere il tenant con `getTenantConfigById(...)`
- opzionalmente calcolare il bootstrap finale come verifica interna

Questo garantisce che il tenant creato sia coerente non solo a livello DB, ma anche a livello servizi applicativi reali.

## Requisito transazionale

La creazione tenant deve essere completamente transazionale.

Strategia obbligatoria:

- `BEGIN`
- esecuzione di tutti i passaggi core
- `COMMIT` solo a flusso completato
- `ROLLBACK` su qualsiasi errore

Passaggi da tenere dentro la transazione:

- creazione tenant
- creazione ruoli
- permessi ruolo
- creazione admin
- assegnazione ruoli admin
- eventuali override iniziali

## Risultato restituito dal servizio

Il servizio dovrebbe restituire una struttura unica, ad esempio:

- tenant finale
- admin iniziale creato
- riepilogo bootstrap
- metadati utili per audit

Questo permette alla route daemon di rispondere senza ricostruire logica.

## Anti-pattern da evitare

Da evitare in questa fase:

- creare tenant in una route e admin in una seconda route
- creare tenant e poi "ripararlo" dopo
- duplicare logica ruoli in piu file
- scrivere meta-logica di bootstrap direttamente nella UI
- restituire successo prima che ruoli e admin siano davvero coerenti

## Decisioni prese in questa fase

- la creazione tenant dovra' passare da un servizio applicativo unico
- il servizio dovra' essere transazionale
- route daemon sottile, servizio ricco
- riuso esplicito di logica RBAC e vertical gia' esistente
- lettura finale del tenant tramite i servizi standard dell'app

## Output prodotto

- disegno del servizio orchestratore
- responsabilita' del servizio
- sequenza logica del flusso
- confine chiaro tra route e service layer
- regole transazionali

## Prossimo passo

La fase successiva e':

- `Fase 4. Progettazione bootstrap iniziale del tenant`
