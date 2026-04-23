# Fase 1 - Modello Dati Multi-tenant

Data: `20 Aprile 2026`  
Stato: `completata (design + piano migrazione)`  
Riferimenti: `MRD multi-tenant`, `ADR-001`

## 1. Obiettivo fase

Rendere il dominio esplicitamente tenant-scoped a livello dati, con vincoli che impediscono inconsistenze cross-tenant e preparano enforcement robusto in Fase 2.

## 2. Decisioni applicate dalla Fase 0

1. Email utente unica globale.
2. Identita utente mono-tenant (`users.studio_id` obbligatorio).
3. BusinessType (`studi.vertical_key`) gestito con workflow amministrativo.
4. Feature override per tenant consentito e auditabile (`tenant_features`).

## 3. ERD logico target (alto livello)

Nodi core:
1. `studi` (tenant root)
2. `users` (identita utente tenant-scoped)
3. `vertical_templates` (catalogo business type / bundle)
4. `tenant_features` (override feature per tenant)
5. `roles`, `role_permissions`, `user_roles` (RBAC tenant-scoped)

Domini operativi tenant-scoped:
1. `pazienti`
2. `appuntamenti`
3. `fatture`
4. `fatture_pagamenti`
5. `prodotti`
6. `custom_field_definitions`, `custom_field_values`
7. `google_calendar_connections`, `appointment_google_event_links`, `appointment_sync_outbox`
8. `tenant_audit_logs`

Domini platform-level (fuori perimetro tenant business):
1. `platform_accounts`
2. `platform_refresh_tokens`
3. `platform_audit_logs` (con `tenant_id` opzionale di riferimento)

## 4. Schema target e vincoli chiave

Vincoli tenant fondamentali:
1. Ogni tabella operativa contiene `studio_id` non nullo.
2. Ogni `studio_id` operativo referenzia `studi(id)`.
3. `users.email` resta unica globale.
4. `tenant_features` mantiene unicita `(studio_id, feature_key)`.
5. `roles` mantiene unicita `(studio_id, role_key)`.
6. `custom_field_definitions` mantiene unicita `(studio_id, entity_key, field_key)`.
7. `custom_field_values` mantiene unicita `(studio_id, entity_key, record_id, field_key)`.

Stato attuale verifica schema:
1. Copertura `studio_id` presente nelle tabelle operative core.
2. Backfill e `NOT NULL` gia previsti in `database/schema.sql`.
3. FK tenant principali gia presenti per dominio clinico/fatture/prodotti/sync.

Gap strutturali residui da chiudere in hardening:
1. Aggiungere vincoli composti anti-cross-tenant sulle relazioni deboli dove serve (es. coppie `(id, studio_id)` per join safety in query critiche).
2. Formalizzare indice case-insensitive su email canonicalizzata (`LOWER(email)`), mantenendo unicita globale.

## 5. Piano migrazione DB (forward)

Sequenza raccomandata dev -> stage -> prod:

1. `Precheck`
   - snapshot conteggi per tabella operativa;
   - verifica righe con `studio_id IS NULL`;
   - verifica integrita FK esistenti.

2. `Schema hardening`
   - conferma colonne `studio_id` su tutte le entita operative;
   - applicazione/validazione `NOT NULL` dove mancante;
   - applicazione/validazione FK a `studi(id)`;
   - creazione indici su `studio_id` per tutte le tabelle ad alto traffico.

3. `Identity hardening`
   - canonicalizzazione email in lower case;
   - introduzione indice unico case-insensitive (`LOWER(email)`) senza cambiare semantica globale.

4. `BusinessType and Feature model`
   - conferma catalogo `vertical_templates`;
   - allineamento `studi.vertical_key` con catalogo versionato;
   - verifica consistenza `tenant_features` rispetto a feature catalog.

5. `Post-migration checks`
   - query di consistenza cross-tenant;
   - smoke test login e bootstrap tenant;
   - baseline performance (lookup per `studio_id`).

## 6. Piano rollback operativo

Principio:
- rollback solo a checkpoint di release, mai parziale su sottoinsiemi incoerenti.

Strategia:
1. Backup pre-migrazione (schema + dati).
2. Deploy migrazione in finestra controllata.
3. Se check critico fallisce:
   - stop traffico write,
   - restore snapshot,
   - riapertura con versione precedente applicativa.

Note:
1. Evitare rollback distruttivo di sole constraint in prod senza riallineare codice backend.
2. Ogni rollback deve lasciare invarianti auth/tenant coerenti.

## 7. Checklist entita legacy tenant-aware

Checklist fase 1 (esito):
1. `users`: `studio_id` presente e obbligatorio -> `OK`.
2. `pazienti`: `studio_id` presente e obbligatorio -> `OK`.
3. `appuntamenti`: `studio_id` presente e obbligatorio -> `OK`.
4. `fatture`: `studio_id` presente e obbligatorio -> `OK`.
5. `prodotti`: `studio_id` presente e obbligatorio -> `OK`.
6. `fatture_pagamenti`: `studio_id` presente e obbligatorio -> `OK`.
7. `google_calendar_connections`: `studio_id` presente e obbligatorio -> `OK`.
8. `appointment_google_event_links`: `studio_id` presente e obbligatorio -> `OK`.
9. `appointment_sync_outbox`: `studio_id` presente e obbligatorio -> `OK`.
10. `tenant_features`: tenant-scoped nativo -> `OK`.
11. `roles`: tenant-scoped nativo -> `OK`.
12. `custom_field_definitions`: tenant-scoped nativo -> `OK`.
13. `custom_field_values`: tenant-scoped nativo -> `OK`.
14. `tenant_audit_logs`: tenant-scoped nativo -> `OK`.

## 8. Gate uscita fase

Gate superati:
1. Nessuna tabella operativa core priva di perimetro tenant.
2. Vincoli principali tenant e indici base presenti.
3. Fase 2 sbloccata: enforcement backend isolamento dati.

Gate aperti (da chiudere in fase 2/3):
1. Hardening full query-level anti-cross-tenant su tutti gli endpoint.
2. Audit automatico test cross-tenant in CI.
3. Canonicalizzazione email + indice unico su `LOWER(email)` se non gia presente nel runtime DB.

