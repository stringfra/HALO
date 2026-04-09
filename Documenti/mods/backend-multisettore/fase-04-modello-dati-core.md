# Fase 4 - Modello Dati Verso Entita Core HALO

Data: `03 Aprile 2026`
Ambito: `database compatibility layer`
Stato: `completato`

## Obiettivo chiuso in questa fase

Introdurre un modello dati core estendibile senza rinominare fisicamente subito le tabelle legacy.

## Modifiche eseguite

In [schema.sql](/Users/francescostrano/Desktop/HALO/database/schema.sql) sono state aggiunte viste compatibili:

- `core_clients`
- `core_appointments`
- `core_invoices`
- `core_inventory_items`

Le viste espongono campi neutrali come:

- `owner_user_id`
- `client_id`
- `owner_display_name`
- `stock_quantity`
- `reorder_threshold`

In [core-entities.service.js](/Users/francescostrano/Desktop/HALO/backend/src/services/core-entities.service.js) ho fissato il mapping applicativo:

- `clients` -> `core_clients`
- `appointments` -> `core_appointments`
- `billing` -> `core_invoices`
- `inventory` -> `core_inventory_items`

## Scelta tecnica

Invece di rinominare subito:

- `pazienti`
- `appuntamenti`
- `fatture`
- `prodotti`

la codebase puo iniziare a convergere su sorgenti dati core compatibili, mantenendo intatta la persistenza esistente.

## Cosa abilita questa fase

- query future su naming neutro
- migrazione progressiva di service e route
- minor rischio rispetto a un rename fisico immediato

## Cosa non e ancora stato fatto

- spostamento effettivo delle route sulle viste core
- scrittura diretta su nuove tabelle core
- deprecazione delle tabelle legacy

Questi passaggi restano alle fasi successive.
