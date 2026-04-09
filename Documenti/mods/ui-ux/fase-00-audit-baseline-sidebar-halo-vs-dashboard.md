# Fase 0 - Audit Baseline Sidebar (HALO vs `dashboard`)

Stato: completata  
Data: 2026-04-05

## Obiettivo fase
Definire baseline tecnica misurabile per arrivare alla parita del menu sinistro (`font`, `stile`, `disposizione`) tra:
- sorgente: `/Users/francescostrano/Desktop/dashboard`
- target: `/Users/francescostrano/Desktop/HALO/frontend` (Next.js)

## Sorgenti analizzate
- `dashboard`:
  - `/Users/francescostrano/Desktop/dashboard/src/theme.scss`
  - `/Users/francescostrano/Desktop/dashboard/src/components/sidebar.vue`
  - `/Users/francescostrano/Desktop/dashboard/src/style.scss`
- HALO:
  - `/Users/francescostrano/Desktop/HALO/frontend/src/components/layout/app-shell.tsx`
  - `/Users/francescostrano/Desktop/HALO/frontend/src/app/layout.tsx`
  - `/Users/francescostrano/Desktop/HALO/frontend/src/app/globals.css`

## Baseline comparativa (numerica)

| Area | `dashboard` (reference) | HALO attuale | Delta |
|---|---|---|---|
| Font body/sidebar | `system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif` | `Geist` globale via `next/font` | diverso |
| Sidebar width desktop | `10rem` | `lg:w-72` (18rem) | +8rem |
| Sidebar collapsed | `2.25rem` | non presente | mancante |
| Sidebar item height | `2.25rem` (`line-height`) | `py-2.5` (altezza variabile) | diverso |
| Menu item font-size | `0.875rem` | `text-sm` (0.875rem) | allineato |
| Submenu font-size | `0.8125rem` | submenu assente | mancante |
| Menu title font-size | `0.75rem` | titolo gruppo assente | mancante |
| Hover bg item | dark (`$menu-item-hover-background`) | chiaro (`--ui-accent-soft`) | diverso |
| Active bg item | blu (`$menu-item-active-background`) | verde (`--ui-accent`) | diverso |
| Footer sidebar + toggle | presente, con rotazione toggle | assente | mancante |
| Persistenza collapse | `sidebar_collapse` in storage | assente | mancante |
| Submenu flyout in collapsed | presente | assente | mancante |

## Valori riferimento estratti (vincoli da rispettare nelle fasi successive)

### Token e geometrie `dashboard`
- `sidebar-width`: `10rem`  
  fonte: `theme.scss:115`
- `sidebar-min-width`: `2.25rem`  
  fonte: `theme.scss:116`
- `sidebar-sub-width`: `8rem`  
  fonte: `theme.scss:117`
- `sidebar-item-height`: `2.25rem`  
  fonte: `theme.scss:118`
- menu item `font-size`: `0.875rem`  
  fonte: `sidebar.vue:67`
- submenu item `font-size`: `0.8125rem`  
  fonte: `sidebar.vue:96`
- menu title `font-size`: `0.75rem`  
  fonte: `sidebar.vue:49`

### Colori menu `dashboard` (base)
- `menu-item-color`: `$gray` (`#D3DCE6`)  
  fonte: `theme.scss:89` + definizione gray
- `menu-item-hover-color`: `$blue-lighter` (`#89CCFF`)  
  fonte: `theme.scss:91`
- `menu-item-hover-background`: `$main-darker` (`#24313c`)  
  fonte: `theme.scss:92`
- `menu-item-active-color`: `$white` (`#FFFFFF`)  
  fonte: `theme.scss:93`
- `menu-item-active-background`: `$blue-darker` (`#337ab7`)  
  fonte: `theme.scss:94`
- `menu-border-background`: `$main-dark` (`#283643`)  
  fonte: `theme.scss:97`

## Baseline HALO (stato corrente)
- sidebar in `AppShell`:
  - `lg:w-72` + pannello card-style chiaro
  - item nav flat (no children)
  - active verde, hover chiaro
  - nessun collapse/toggle/footer dedicato
  - fonte: `app-shell.tsx:195-233`
- font globale:
  - `Geist`/`Geist_Mono` via `next/font`
  - fonte: `layout.tsx:2-14`, `layout.tsx:29-33`
- palette globale:
  - tema chiaro verde
  - fonte: `globals.css:4-28`

## Output fase 0 (requisiti misurabili congelati)
Questi saranno i target minimi di parita:
1. Width sidebar desktop: `10rem`.
2. Width collapsed: `2.25rem`.
3. Item row height: `2.25rem` percepita/equivalente.
4. Font-size item: `0.875rem`; submenu `0.8125rem`; title `0.75rem`.
5. Stati hover/active coerenti con schema dark+blue del reference.
6. Toggle collapse con persistenza in `localStorage`.
7. Supporto submenu (expanded in-flow + collapsed flyout).

## Protocollo screenshot (da eseguire in Fase 5 QA)
Per confronto prima/dopo, produrre i seguenti scatti in `1366x768` e `390x844`:
1. `dashboard_sidebar_expanded.png`
2. `dashboard_sidebar_collapsed.png`
3. `dashboard_sidebar_hover.png`
4. `dashboard_sidebar_active.png`
5. `halo_sidebar_expanded_after.png`
6. `halo_sidebar_collapsed_after.png`
7. `halo_sidebar_hover_after.png`
8. `halo_sidebar_active_after.png`

## Esito fase
- Requisiti numerici e comportamentali definiti: SI
- Delta tecnico identificato: SI
- Gate per avvio Fase 1: SUPERATO
