# Fase 1 - Tenant E Branding Backend-Driven HALO

Data: `03 Aprile 2026`
Ambito: `database + backend service`
Stato: `completato`

## Obiettivo chiuso in questa fase

Trasformare `studi` nel contenitore applicativo del tenant, mantenendo compatibilita con il nome tabella esistente e senza introdurre ancora bootstrap API o feature guards.

## Modifiche eseguite

Schema aggiornato in [schema.sql](/Users/francescostrano/Desktop/HALO/database/schema.sql):

- `display_name`
- `business_name`
- `vertical_key`
- `brand_logo_url`
- `brand_primary_color`
- `brand_secondary_color`
- `default_locale`
- `default_timezone`
- `settings_json`
- `is_active`

Backfill e vincoli inclusi:

- popolamento automatico di `display_name` dai dati esistenti
- default iniziali per vertical, locale, timezone e `settings_json`
- `is_active` impostato a `TRUE`
- indice su `vertical_key`

Service applicativo aggiunto in [tenant-config.service.js](/Users/francescostrano/Desktop/HALO/backend/src/services/tenant-config.service.js).

## Cosa rende disponibile questa fase

Il backend puo gia risolvere un tenant come configurazione applicativa completa:

- identita tenant
- vertical di appartenenza
- branding base
- locale/timezone
- labels finali con fallback core + vertical + settings tenant

## Cosa non e ancora in questa fase

- endpoint `GET /api/bootstrap`
- tabella `tenant_features`
- navigazione backend-driven
- ruoli e permessi tenant-specific

Questi punti restano alle fasi successive.
