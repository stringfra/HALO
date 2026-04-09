# Fase 0 - Modello Multi-Settore HALO

Data: `03 Aprile 2026`
Ambito: `backend foundation`
Stato: `completato`

## Obiettivo chiuso in questa fase

Fissare il modello concettuale unico che useranno le fasi successive senza introdurre ancora modifiche distruttive a database, route o frontend.

## Deliverable prodotti

Fonte tecnica principale:

- [backend/src/config/multi-sector.js](/Users/francescostrano/Desktop/HALO/backend/src/config/multi-sector.js)

Contenuti inclusi:

- entita core neutrali
- catalogo feature flag iniziale
- labels core e override per vertical
- mappa di navigazione logica
- mapping ruoli legacy -> permission key
- mappa entita core -> tabelle legacy

## Entita Core

- `clients`
- `appointments`
- `billing`
- `payments`
- `inventory`
- `users`
- `automations`

## Matrice Vertical -> Moduli -> Labels -> Ruoli

### `dental`

- labels:
  - cliente: `Paziente/Pazienti`
  - owner: `Dentista/Dentisti`
- moduli:
  - dashboard, agenda, clients, billing, payments_stripe, inventory, automation, reports, advanced_notes, custom_fields
- ruoli legacy supportati:
  - `ADMIN`, `DENTISTA`, `SEGRETARIO`

### `medical`

- labels:
  - cliente: `Paziente/Pazienti`
  - owner: `Medico/Medici`
- moduli:
  - dashboard, agenda, clients, billing, payments_stripe, automation, reports, advanced_notes, custom_fields
- ruoli legacy supportati:
  - `ADMIN`, `DENTISTA`, `SEGRETARIO`

### `physiotherapy`

- labels:
  - cliente: `Paziente/Pazienti`
  - owner: `Terapista/Terapisti`
- moduli:
  - dashboard, agenda, clients, billing, payments_stripe, automation, reports, custom_fields
- ruoli legacy supportati:
  - `ADMIN`, `DENTISTA`, `SEGRETARIO`

### `aesthetics`

- labels:
  - cliente: `Cliente/Clienti`
  - owner: `Operatore/Operatori`
- moduli:
  - dashboard, agenda, clients, billing, payments_stripe, inventory, automation, reports, custom_fields
- ruoli legacy supportati:
  - `ADMIN`, `DENTISTA`, `SEGRETARIO`

### `consulting`

- labels:
  - cliente: `Cliente/Clienti`
  - owner: `Consulente/Consulenti`
- moduli:
  - dashboard, agenda, clients, billing, payments_stripe, automation, reports, advanced_notes, custom_fields
- ruoli legacy supportati:
  - `ADMIN`, `DENTISTA`, `SEGRETARIO`

### `services`

- labels:
  - cliente: `Cliente/Clienti`
  - owner: `Operatore/Operatori`
- moduli:
  - dashboard, agenda, clients, billing, payments_stripe, inventory, automation, reports, custom_fields
- ruoli legacy supportati:
  - `ADMIN`, `DENTISTA`, `SEGRETARIO`

## Catalogo Feature Flag iniziale

- `dashboard.enabled`
- `agenda.enabled`
- `clients.enabled`
- `billing.enabled`
- `payments.stripe.enabled`
- `inventory.enabled`
- `automation.enabled`
- `reports.enabled`
- `advanced_notes.enabled`
- `custom_fields.enabled`

## Mappa Entita Core -> Dominio Legacy

- `clients` -> tabella `pazienti`, campo legacy chiave `medico_id`
- `appointments` -> tabella `appuntamenti`, campo legacy chiave `medico`
- `billing` -> tabella `fatture`
- `payments` -> tabella `fatture_pagamenti`
- `inventory` -> tabella `prodotti`
- `users` -> tabella `users`, campo legacy chiave `ruolo`

## Nota tecnica importante

In questa fase i ruoli legacy restano invariati per compatibilita. Il loro significato viene pero separato dal settore tramite permission key neutrali, cosi la Fase 6 potra sostituire l'autorizzazione hardcoded senza rompere il flusso attuale.
