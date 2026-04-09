# Piano Tecnico a Fasi: Parita Menu Sinistro `dashboard` -> HALO (Next.js)

## 1) Obiettivo
Rendere in HALO (frontend Next.js) il menu sinistro equivalente a quello della repo `dashboard` per:
- font
- stile visuale
- disposizione/layout

Vincolo: nessuna migrazione a Vite. Il target resta Next.js.

## 2) Scope Funzionale
Parita richiesta sul componente sidebar, non sull'intera app:
- larghezze, spaziature, gerarchia menu, comportamento active/hover
- stato collapsed/expanded con persistenza locale
- menu con eventuale secondo livello
- coerenza font e iconografia del menu

Fuori scope iniziale:
- migrazione completa di tutto il tema `dashboard`
- riscrittura routing o struttura pagine HALO
- refactor backend/API

## 3) Baseline Tecnica (stato attuale)

### HALO (target)
- Framework: Next `16.2.1` (App Router), React `19.2.4`
- File chiave:
  - `/Users/francescostrano/Desktop/HALO/frontend/src/components/layout/app-shell.tsx`
  - `/Users/francescostrano/Desktop/HALO/frontend/src/app/layout.tsx`
  - `/Users/francescostrano/Desktop/HALO/frontend/src/app/globals.css`
- Sidebar attuale:
  - statica, senza collapse
  - nav flat (singolo livello)
  - font gestito con `next/font` (Geist)

### `dashboard` (sorgente da replicare)
- Sidebar:
  - `/Users/francescostrano/Desktop/dashboard/src/components/sidebar.vue`
  - `/Users/francescostrano/Desktop/dashboard/src/components/menu.vue`
- Token visuali:
  - `/Users/francescostrano/Desktop/dashboard/src/theme.scss`
- Font/icon-font:
  - `/Users/francescostrano/Desktop/dashboard/src/style.scss`
  - `/Users/francescostrano/Desktop/dashboard/src/assets/fonts/freedom.*`
- Pattern principali da replicare:
  - width sidebar: `10rem`
  - width collapsed: `2.25rem`
  - hover/active state con colori dark+blue
  - eventuale submenu a comparsa laterale
  - toggle collapse con persistenza (`sidebar_collapse`)

## 4) Requisiti di Parita (Definition of Done funzionale)
1. Font menu e tipografia sidebar allineati al progetto `dashboard`.
2. Sidebar in HALO con doppio stato:
   - expanded: 10rem
   - collapsed: 2.25rem
3. Active state, hover state e colori uguali o entro tolleranza visiva minima.
4. Se un item ha children, submenu visualizzato con comportamento equivalente.
5. Stato collapse persistito in `localStorage` e inizializzazione responsive.
6. Nessuna regressione su:
   - guardie ruolo/permessi HALO
   - bootstrap navigation HALO
   - responsive mobile

## 5) Piano a Fasi

## Fase 0 - Audit e Freeze UI
### Obiettivo
Bloccare un baseline misurabile prima delle modifiche.

### Attivita
- Catturare screenshot reference da `dashboard`:
  - sidebar expanded
  - sidebar collapsed
  - item active
  - item hover
  - submenu aperto
- Catturare screenshot equivalenti in HALO attuale.
- Definire tabella token da allineare: font-size, line-height, padding, colori, width.

### Deliverable
- Documento di confronto "prima/dopo" con checklist di parita.

### Exit Criteria
- Requisiti visivi numerici definiti (es. width, spacing, font-size).

---

## Fase 1 - Fondazioni di Design Token
### Obiettivo
Portare in HALO i token necessari alla sidebar `dashboard-like`.

### Attivita
- In `globals.css` introdurre namespace token sidebar, ad esempio:
  - `--sidebar-width: 10rem`
  - `--sidebar-width-collapsed: 2.25rem`
  - `--sidebar-item-height: 2.25rem`
  - `--sidebar-menu-item-color`, `--sidebar-menu-hover-bg`, `--sidebar-menu-active-bg`, ecc.
- Allineare font stack del menu al riferimento (`system-ui, -apple-system, "Segoe UI", ...`) oppure introdurre una variabile specifica `--font-sidebar`.
- Definire mapping colori source -> HALO con fallback accessibile.

### File target
- `/Users/francescostrano/Desktop/HALO/frontend/src/app/globals.css`
- (eventuale) `/Users/francescostrano/Desktop/HALO/frontend/src/app/layout.tsx` per gestione font globale/menu.

### Deliverable
- Set token sidebar stabile e documentato.

### Exit Criteria
- Nessun hardcoded colore/misura in JSX del menu.

---

## Fase 2 - Refactor Strutturale Sidebar in Next
### Obiettivo
Rendere la struttura React equivalente al modello `sidebar.vue`/`menu.vue`.

### Attivita
- Estrarre la sidebar da `app-shell.tsx` in componenti dedicati:
  - `Sidebar`
  - `SidebarMenuList`
  - `SidebarFooter`
- Introdurre modello dati menu compatibile con 1 livello + children opzionale:
  - `key`, `label`, `href`, `icon?`, `children?`, `roles?`
- Conservare logica HALO esistente:
  - filtri per ruolo
  - `bootstrap.navigation` dinamica

### File target
- `/Users/francescostrano/Desktop/HALO/frontend/src/components/layout/app-shell.tsx`
- nuovi file in `/Users/francescostrano/Desktop/HALO/frontend/src/components/layout/`

### Deliverable
- Sidebar modularizzata, pronta a styling parity.

### Exit Criteria
- Nessuna regressione routing/permessi rispetto a stato attuale.

---

## Fase 3 - Parita Interazioni (collapse, active, hover, submenu)
### Obiettivo
Allineare comportamento utente al progetto `dashboard`.

### Attivita
- Implementare stato `collapsed` con:
  - default `window.innerWidth < 768` (come reference)
  - persistenza `localStorage` (chiave suggerita: `halo_sidebar_collapse`)
- Aggiungere toggle in footer sidebar.
- Gestire active state su match route:
  - exact + prefisso sottorotte
- Gestire submenu:
  - expanded: visibile nel flusso per item active
  - collapsed: apertura su hover/focus laterale
- Curare stati keyboard:
  - `:focus-visible`
  - navigazione tab/enter/esc (minimo accessibile)

### Deliverable
- Comportamento sidebar allineato al reference.

### Exit Criteria
- Scenari chiave passati: expand/collapse, active route, children route, persistenza reload.

---

## Fase 4 - Parita Tipografica e Iconografica
### Obiettivo
Rendere font e icone menu coerenti col progetto `dashboard`.

### Attivita
- Scelta font:
  - Opzione A (consigliata per parita): font stack sistema uguale a `dashboard`.
  - Opzione B: mantenere Geist globale e applicare font sidebar dedicato (piu sicuro per regressioni restanti pagine).
- Icone:
  - import asset `freedom` (woff/ttf/svg) in `public/fonts` o asset pipeline frontend
  - mappare le classi icona necessarie ai menu HALO
  - usare solo set minimo di icone usate realmente
- Verifica licenza asset `freedom` prima di copia definitiva.

### Deliverable
- Sidebar con stesso "linguaggio visuale" (font + icone) del reference.

### Exit Criteria
- Font e icone del menu risultano visivamente equivalenti nei 4 stati (default/hover/active/collapsed).

---

## Fase 5 - QA, Accessibilita e Rollout
### Obiettivo
Chiudere il lavoro senza regressioni.

### Attivita
- QA manuale su breakpoint:
  - mobile (<768), tablet, desktop
- QA ruolo:
  - ADMIN, SEGRETARIO, DENTISTA, DIPENDENTE
- QA routing:
  - rotte top-level e nested
- Accessibilita minima:
  - contrasto
  - focus ring visibile
  - area cliccabile >= 40px
- Performance:
  - nessun layout shift evidente in toggle
- Documentare fallback:
  - se `bootstrap.navigation` non fornisce icone/children, rendering sicuro flat.

### Deliverable
- Report QA + checklist completata + screenshot finali.

### Exit Criteria
- Approvazione visiva su expanded/collapsed e comportamento invariato lato business.

## 6) Strategia di Implementazione Consigliata
Per minimizzare rischio:
1. Prima implementare struttura e stato (Fase 2-3) mantenendo stile attuale HALO.
2. Solo dopo applicare token/font/icone finali (Fase 1+4).
3. Chiudere con QA completo (Fase 5).

Questo evita regressioni difficili da isolare tra logica e stile.

## 7) Rischi e Mitigazioni
- Rischio: regressione su ruolo/permessi menu.
  - Mitigazione: test matrice ruolo x rotta a ogni fase.
- Rischio: differenze tra menu dinamico HALO e menu statico `dashboard`.
  - Mitigazione: data model unico con campi opzionali, fallback flat.
- Rischio: introduzione icon-font impatta rendering globale.
  - Mitigazione: scope CSS icone limitato a sidebar.
- Rischio: incoerenza font globale.
  - Mitigazione: applicare font target solo alla sidebar in prima release.

## 8) Stima di Massima
- Fase 0: 0.5 gg
- Fase 1: 0.5 gg
- Fase 2: 1 gg
- Fase 3: 1 gg
- Fase 4: 0.5-1 gg
- Fase 5: 0.5 gg

Totale: ~4-4.5 giorni uomo (con QA incluso).

## 9) Criterio Finale di Successo
Un utente che confronta HALO e `dashboard` deve percepire il menu sinistro come lo stesso componente per:
- tipografia
- proporzioni/layout
- comportamento interattivo

senza compromettere le logiche applicative specifiche di HALO.
