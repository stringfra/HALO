# Fase A - Token UI Derivati Da Screenshot

Stato: completata  
Data: 2026-04-05  
Screenshot riferimento: `/Users/francescostrano/Desktop/Screenshot 2026-04-05 alle 20.36.11.png`

## Obiettivo fase
Definire e applicare in HALO i token visivi base (colori, font, superfici, sidebar, dashboard guadagni) coerenti con lo screenshot target.

## File aggiornato
- `/Users/francescostrano/Desktop/HALO/frontend/src/app/globals.css`

## Token impostati (valori principali)
- Font UI:
  - `--font-ui: "Inter", system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`
- Colori app:
  - `--ui-bg: #f5f6f7`
  - `--ui-text: #2d3138`
  - `--ui-muted: #8f949c`
  - `--ui-border: #e7eaee`
  - `--ui-accent: #57c27f`
  - `--ui-accent-soft: #ecf8f0`
- Sidebar:
  - `--sidebar-item-color: #737b85`
  - `--sidebar-item-hover-bg: #f1f3f5`
  - `--sidebar-item-active-bg: #ecf8f0`
  - `--sidebar-item-active-color: #57c27f`
  - `--sidebar-border-color: #e7eaee`
- Dashboard guadagni:
  - `--dashboard-card-bg: #ffffff`
  - `--dashboard-card-border: #e7eaee`
  - `--dashboard-chart-line: #57c27f`
  - `--dashboard-chart-fill: #eef7f1`
  - `--dashboard-positive: #57c27f`
  - `--dashboard-negative: #e07d7d`

## Allineamenti globali applicati
1. `body` impostato su font UI target (`--font-ui`).
2. `body` background semplificato a tinta piatta (no gradienti forti).
3. `@theme inline --font-sans` allineato a `--font-ui`.

## Esito fase
- Fondazione visiva coerente con screenshot: SI
- Componenti non ancora ridisegnati: SI (previsto per Fase B/C)

Gate successivo: Fase B (struttura sidebar pixel-accurate).
