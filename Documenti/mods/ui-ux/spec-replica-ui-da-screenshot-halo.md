# Specifica Tecnica: Replica UI Da Screenshot (HALO - Next.js)

## 1. Obiettivo
Replicare in HALO (frontend Next.js) la UI mostrata nello screenshot di riferimento sul Desktop, in particolare:
- menu laterale sinistro (struttura, proporzioni, stati)
- palette colori (background, superfici, testi, accenti)
- tipografia (font family, pesi, gerarchie)
- sezione/dashboard guadagni (layout card, metriche, grafica e spacing)

Vincolo: mantenere stack Next.js e logica applicativa HALO (routing, ruoli, bootstrap, API).

## 2. Scope

### In scope
- Refactoring UI layer (`layout`, `sidebar`, `dashboard`).
- Introduzione/aggiornamento design tokens.
- Implementazione componenti presentazionali coerenti al target.
- QA visuale su desktop/mobile.

### Out of scope
- Modifiche backend/API.
- Cambi semantica ruoli/permessi.
- Migrazione framework (no Vite).

## 3. Principi di Implementazione
1. **Pixel-accuracy pragmatica**: tolleranza massima ±4px su spacing/size.
2. **Token-first**: nessun colore/misura hardcoded nei componenti.
3. **Separation of concerns**: logica business invariata, solo presentazione.
4. **Responsive parity**: desktop fedele + adattamento mobile coerente.

## 4. Architettura UI Target

### 4.1 Shell pagina
- Colonna sinistra fissa: sidebar.
- Colonna destra fluida: header + contenuto dashboard.
- Griglia/split con `min-height: 100vh`.

### 4.2 Sidebar
- Blocchi:
  - brand/header sidebar
  - lista voci principali
  - eventuali sottovoci
  - footer con toggle collapse
- Stati:
  - default
  - hover
  - active
  - collapsed
  - focus-visible (accessibilita)

### 4.3 Dashboard guadagni
- Hero metric cards (KPI principali).
- Area chart/andamento (se prevista dal target).
- Tabella o lista transazioni/ultimi incassi.
- CTA secondarie coerenti al design.

## 5. Specifiche Tecniche Dettagliate

## Fase A - Design Tokens Definitivi
Creare un set token unico in `frontend/src/app/globals.css`:
- `--color-bg-app`
- `--color-bg-surface`
- `--color-sidebar-bg`
- `--color-sidebar-text`
- `--color-sidebar-hover-bg`
- `--color-sidebar-active-bg`
- `--color-sidebar-active-text`
- `--color-card-bg`
- `--color-card-border`
- `--color-kpi-positive`
- `--color-kpi-negative`
- `--font-ui`
- `--font-size-xs/sm/md/lg/xl`
- `--radius-sm/md/lg`
- `--shadow-soft/md/lg`
- `--sidebar-width-expanded`
- `--sidebar-width-collapsed`
- `--sidebar-item-height`
- `--layout-gap-main`

Requisito:
- mapping 1:1 ai valori visuali target.

## Fase B - Sidebar Pixel-Accurate
File target:
- `frontend/src/components/layout/app-sidebar.tsx`
- `frontend/src/components/layout/sidebar-menu-list.tsx`
- `frontend/src/components/layout/sidebar-footer.tsx`

Interventi:
1. Allineare geometrie (width, padding, line-height item, gap).
2. Allineare stile tipografico (font, peso, tracking).
3. Allineare stati hover/active/focus.
4. Allineare icone menu (set coerente allo screenshot).
5. Collapse desktop con persistenza `localStorage`.
6. Mobile behavior: sidebar non degradare leggibilita.

## Fase C - Dashboard Guadagni
File target:
- `frontend/src/app/dashboard/page.tsx`
- eventuali componenti in `frontend/src/features/dashboard/*`

Interventi:
1. Strutturare i blocchi KPI come nel target.
2. Definire gerarchia visiva:
   - valore principale
   - label
   - delta percentuale
   - metadati temporali
3. Adeguare card style:
   - border
   - radius
   - shadow
   - spacing interno
4. Uniformare palette e font con sidebar.
5. Garantire responsiveness:
   - desktop multi-colonna
   - mobile stack verticale.

## Fase D - Font & Asset
1. Se il target usa font specifico non presente:
   - import via `next/font` (Google o local).
2. Applicare font per scope:
   - globale (`body`)
   - override puntuali su KPI/heading se richiesto dal target.
3. Asset iconografici:
   - solo set necessario
   - fallback sicuri.

## Fase E - QA Visuale e Regressioni
Checklist QA:
1. Sidebar expanded/collapsed uguale al target.
2. Hover/active coerenti.
3. Dashboard guadagni allineata (tipografia, spaziature, card).
4. Nessuna regressione login/routing/ruoli.
5. Contrasto e focus keyboard accettabili.

Comandi di verifica:
- `npx eslint ...file modificati...`
- `npx tsc --noEmit`
- smoke manuale su rotte principali.

## 6. Definition of Done
La feature e accettata quando:
1. Menu sinistro risulta visivamente equivalente allo screenshot.
2. Dashboard guadagni risulta visivamente equivalente allo screenshot.
3. Font e palette corrispondono al target.
4. Mobile/desktop funzionano senza regressioni funzionali.
5. Typecheck e lint mirato passano.

## 7. Piano di Esecuzione (ordine raccomandato)
1. Freeze screenshot target + checklist misure.
2. Fase A (tokens).
3. Fase B (sidebar).
4. Fase C (dashboard guadagni).
5. Fase D (font/asset fine-tuning).
6. Fase E (QA + fix finali).

## 8. Rischi e Mitigazioni
- **Rischio**: mismatch visivo per mancanza misure precise.
  - **Mitigazione**: confronto side-by-side e revisione iterativa.
- **Rischio**: regressioni layout globale.
  - **Mitigazione**: confinare classi/components al layout app.
- **Rischio**: overfitting desktop.
  - **Mitigazione**: breakpoint QA obbligatorio.

## 9. Deliverable Finali
1. Componenti aggiornati (`sidebar`, `dashboard`).
2. Token CSS definitivi documentati.
3. Report QA con esito per breakpoint/stati.
4. Nota tecnica su eventuali differenze residue intenzionali.
