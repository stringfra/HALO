# Creazione Tenant Daemon Fase 7

Data: `04 Aprile 2026`
Stato: `completata`

## Obiettivo

Definire la strategia di audit e tracciabilita' della creazione tenant eseguita da `daemon`.

## Principio guida

La creazione di un nuovo tenant e' una delle operazioni amministrative piu sensibili dell'intera piattaforma.

Per questo deve lasciare traccia su due livelli:

- audit di piattaforma
- audit locale del tenant creato

## Pattern audit da mantenere

Il progetto usa gia' un pattern coerente:

- `platform_audit_logs`
  per la prospettiva piattaforma

- `tenant_audit_logs`
  per la prospettiva tenant

La creazione tenant deve seguire lo stesso approccio, senza introdurre un canale audit separato.

## Eventi audit consigliati

### 1. `daemon.tenant.created`

Scopo:

- registrare la nascita del tenant a livello piattaforma

Classificazione consigliata:

- `type`: `write_reversible`
- `severity`: `critical`
- `reversible`: `true`

Descrizione consigliata:

- `Creazione nuovo tenant da console daemon.`

### 2. `daemon.tenant.bootstrap.completed`

Scopo:

- registrare che il bootstrap tecnico minimo del tenant e' stato completato

Classificazione consigliata:

- `type`: `write_reversible`
- `severity`: `high`
- `reversible`: `true`

Descrizione consigliata:

- `Bootstrap iniziale tenant completato da daemon.`

### 3. `daemon.tenant_admin.created`

Scopo:

- registrare la creazione dell'admin iniziale del tenant

Classificazione consigliata:

- `type`: `write_reversible`
- `severity`: `critical`
- `reversible`: `true`

Descrizione consigliata:

- `Creazione admin iniziale tenant da daemon.`

## Strategia consigliata

Decisione consigliata:

- audit platform sempre obbligatorio
- audit tenant obbligatorio almeno per gli eventi che riguardano l'identita' del tenant appena nato

## Dove scrivere gli eventi

### Audit platform

Da scrivere tramite:

- `logPlatformAuditEvent(...)`

Per:

- `daemon.tenant.created`
- `daemon.tenant.bootstrap.completed`
- `daemon.tenant_admin.created`

### Audit tenant

Da scrivere tramite:

- `logTenantAuditEvent(...)`

Per:

- `daemon.tenant.bootstrap.completed`
- `daemon.tenant_admin.created`

Scelta consigliata:

- non scrivere `daemon.tenant.created` nel tenant audit prima che il tenant sia davvero coerente
- scrivere gli eventi tenant solo dopo che il tenant esiste ed e' stabile

## Entity key consigliate

Per mantenere leggibilita' nel catalogo audit:

- `tenant_registry`
  per la nascita del tenant

- `tenant_bootstrap`
  per il completamento del bootstrap iniziale

- `tenant_user`
  per la creazione dell'admin iniziale

## Metadati minimi da registrare

### Per `daemon.tenant.created`

Metadati consigliati:

- `tenant_id`
- `tenant_code`
- `tenant_name`
- `display_name`
- `vertical_key`
- `locale`
- `timezone`
- `daemon_account_id`
- `daemon_email`
- `confirmation_reason`

### Per `daemon.tenant.bootstrap.completed`

Metadati consigliati:

- `tenant_id`
- `tenant_code`
- `vertical_key`
- `settings_version`
- `system_roles_created`
- `feature_overrides_created`
- `daemon_account_id`
- `daemon_email`

### Per `daemon.tenant_admin.created`

Metadati consigliati:

- `tenant_id`
- `tenant_code`
- `admin_user_id`
- `admin_email`
- `admin_role_key`
- `daemon_account_id`
- `daemon_email`

## Ordine audit consigliato

Ordine pragmatico:

1. completare la transazione di creazione tenant
2. scrivere audit platform `daemon.tenant.created`
3. scrivere audit platform `daemon.tenant.bootstrap.completed`
4. scrivere audit tenant `daemon.tenant.bootstrap.completed`
5. scrivere audit platform `daemon.tenant_admin.created`
6. scrivere audit tenant `daemon.tenant_admin.created`

Motivo:

- si evita di lasciare audit che raccontano un tenant mai realmente nato

## Requisito importante

L'audit non deve dichiarare completata la creazione tenant prima che:

- il tenant sia persistito correttamente
- i ruoli di sistema siano presenti
- l'admin iniziale sia stato creato e collegato

## Gestione errori audit

Scelta consigliata:

- le scritture core del tenant devono stare nella transazione principale
- l'audit puo' essere scritto subito dopo il `COMMIT`

Motivo:

- le tabelle audit non devono causare rollback di un tenant gia' nato se il requisito di business decide che l'audit e' "best effort"

Scelta alternativa piu rigorosa:

- audit platform minimo dentro il perimetro transazionale

Per la prima versione documentale, la scelta consigliata resta:

- core creation transazionale
- audit immediatamente successivo e trattato come requisito forte, ma separato dalla transazione di nascita

## Aggiornamento del catalogo eventi

Il catalogo `daemon-event-catalog` dovra' essere esteso con:

- `daemon.tenant.created`
- `daemon.tenant.bootstrap.completed`
- `daemon.tenant_admin.created`

in modo che la UI logs e la classificazione audit restino coerenti.

## Decisioni prese in questa fase

- doppio audit platform + tenant
- introduzione di tre eventi dedicati alla creazione tenant
- metadata espliciti e orientati alla ricostruibilita'
- entity key leggibili e coerenti con il resto del sistema
- audit scritto solo dopo creazione tenant realmente completata

## Output prodotto

- strategia audit della creazione tenant
- matrice eventi
- metadati minimi da registrare
- ordine consigliato delle scritture audit

## Prossimo passo

La fase successiva e':

- `Fase 8. Progettazione UI daemon di creazione tenant`
