# Fase 8 - Campi Custom E Metadati Di Dominio HALO

Data: `03 Aprile 2026`
Ambito: `database + backend api`
Stato: `completato`

## Obiettivo chiuso in questa fase

Supportare estensioni tenant-specific e vertical-specific senza alterare ogni volta il modello core.

## Modifiche eseguite

In [schema.sql](/Users/francescostrano/Desktop/HALO/database/schema.sql) ho aggiunto:

- `custom_field_definitions`
- `custom_field_values`

Con supporto a:

- `entity_key`
- `field_key`
- `type`
- `required`
- `options_json`
- `sort_order`
- `active`

Service nuovo in [custom-fields.service.js](/Users/francescostrano/Desktop/HALO/backend/src/services/custom-fields.service.js):

- CRUD definizioni custom fields
- lettura/scrittura valori per record
- validazione base di `entity_key`

Route nuove in [custom-fields.routes.js](/Users/francescostrano/Desktop/HALO/backend/src/routes/custom-fields.routes.js):

- `GET /api/custom-fields/definitions/:entityKey`
- `POST /api/custom-fields/definitions`
- `DELETE /api/custom-fields/definitions/:entityKey/:fieldKey`
- `GET /api/custom-fields/:entityKey/:recordId`
- `PUT /api/custom-fields/:entityKey/:recordId`

## Integrazione iniziale

La route clienti in [pazienti.routes.js](/Users/francescostrano/Desktop/HALO/backend/src/routes/pazienti.routes.js) restituisce gia `custom_fields` per ogni record.

## Nota pragmatica

In questa fase ho preparato il layer dati e API. Non ho ancora esteso tutte le schermate frontend all'editing dei custom fields, per evitare di aprire un refactor UI largo prima di completare le fasi architetturali successive.
