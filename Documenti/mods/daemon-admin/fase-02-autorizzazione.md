# DAEMON FASE 2 AUTORIZZAZIONE HALO

Data: `03 Aprile 2026`
Stato: `completata`

## Obiettivo della fase

Definire in modo esplicito cosa puo fare `daemon` nel progetto reale HALO e cosa invece resta vietato o ulteriormente protetto.

## Decisione chiave

`daemon` ha privilegi massimi di piattaforma, ma non opera come bypass implicito di ogni endpoint tenant esistente.

Regola scelta:

- `daemon` usa permessi di piattaforma dedicati
- i permessi tenant restano validi solo per `tenant_user`
- le operazioni cross-tenant passano da endpoint e middleware dedicati

Questo evita due errori classici:

- far entrare `daemon` dentro `/api` standard con scorciatoie difficili da difendere
- mescolare governance di piattaforma con permessi operativi tenant

## Catalogo permessi di piattaforma

Permessi introdotti:

- `platform.dashboard.read`
- `platform.tenants.read`
- `platform.tenants.write`
- `platform.tenant_config.read`
- `platform.tenant_config.write`
- `platform.tenant_features.read`
- `platform.tenant_features.write`
- `platform.roles.read`
- `platform.roles.write`
- `platform.users.read`
- `platform.users.write`
- `platform.custom_fields.read`
- `platform.custom_fields.write`
- `platform.audit.read`
- `platform.diagnostics.read`
- `platform.bootstrap.read`

Per questa fase l'account `daemon` avra il set completo di questi permessi.

## Perimetro consentito

`daemon` potra:

- leggere tutti i tenant
- modificare configurazioni tenant
- modificare feature flags tenant
- leggere e modificare ruoli e permessi tenant
- leggere e modificare utenti tenant
- leggere e modificare custom fields tenant
- leggere audit log e diagnostica

## Perimetro vietato o protetto ulteriormente

In questa iterazione restano esclusi o soggetti a hardening successivo:

- cancellazione hard di tenant
- operazioni massive cross-tenant senza conferma esplicita
- alterazione o cancellazione audit log
- promozione di utenti tenant a identita `daemon`
- manutenzione dati distruttiva multi-tenant
- uso di endpoint tenant standard come canale implicito di super-admin

## Endpoint e azioni da proteggere

La base tecnica e stata mappata su gruppi di endpoint reali e futuri:

- tenant config
- tenant features
- utenti tenant
- custom fields tenant
- ruoli e permessi
- audit e diagnostica

Questa mappa e stata codificata in:

- [backend/src/config/platform-governance.js](/Users/francescostrano/Desktop/HALO/backend/src/config/platform-governance.js)

## Output tecnico della fase

Sono stati introdotti:

- catalogo dei permessi di piattaforma
- matrice capacita consentite e vietate per `daemon`
- mappa dei gruppi di endpoint che dovranno essere protetti nella console daemon

Questa fase non espone ancora nuove route pubbliche, ma prepara la protezione coerente della Fase 3 e della Fase 4.
