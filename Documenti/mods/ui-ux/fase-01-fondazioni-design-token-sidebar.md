# Fase 1 - Fondazioni Design Token Sidebar

Stato: completata  
Data: 2026-04-05

## Obiettivo fase
Introdurre in HALO un set stabile di token per replicare la sidebar del progetto `dashboard`, senza modificare ancora struttura e comportamento.

## Modifiche eseguite
- Aggiornato:
  - `/Users/francescostrano/Desktop/HALO/frontend/src/app/globals.css`

### Token aggiunti in `:root`
- Tipografia:
  - `--sidebar-font-family`
  - `--sidebar-title-font-size`
  - `--sidebar-item-font-size`
  - `--sidebar-subitem-font-size`
  - `--sidebar-icon-font-size`
- Geometrie:
  - `--sidebar-width-expanded`
  - `--sidebar-width-collapsed`
  - `--sidebar-submenu-width`
  - `--sidebar-item-height`
  - `--sidebar-footer-height`
- Colori stati menu:
  - `--sidebar-item-color`
  - `--sidebar-item-hover-color`
  - `--sidebar-item-hover-bg`
  - `--sidebar-item-active-color`
  - `--sidebar-item-active-bg`
  - `--sidebar-title-color`
  - `--sidebar-border-color`
- Timing:
  - `--sidebar-width-transition`
  - `--sidebar-item-transition`

## Note implementative
- I token sono derivati dalla baseline di `dashboard` (Fase 0).
- Nessuna regressione funzionale attesa: in questa fase non e stato cambiato markup/JSX della sidebar.
- Il tema attuale HALO resta invariato finche i token non vengono applicati ai componenti nelle fasi successive.

## Exit criteria fase
1. Nessun hardcoded necessario per le misure principali in fase di implementazione sidebar.
2. Set token completo disponibile globalmente.
3. Pronto il terreno per Fase 2 (refactor strutturale componenti sidebar).

Esito: SUPERATO.
