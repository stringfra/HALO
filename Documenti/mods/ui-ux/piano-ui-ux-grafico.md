# Piano UI/UX Grafico HALO

## Obiettivo

Definire tutte le modifiche necessarie per portare la UI e la UX di HALO a un livello produttivo alto, coerente e scalabile, mantenendo l'attuale stack `Next.js + Tailwind` e partendo dallo stato reale del frontend presente in:

- [frontend/src/app/globals.css](/Users/francescostrano/Desktop/HALO/frontend/src/app/globals.css)
- [frontend/src/components/layout/app-shell.tsx](/Users/francescostrano/Desktop/HALO/frontend/src/components/layout/app-shell.tsx)
- [frontend/src/app/login/page.tsx](/Users/francescostrano/Desktop/HALO/frontend/src/app/login/page.tsx)
- [frontend/src/app/dashboard/page.tsx](/Users/francescostrano/Desktop/HALO/frontend/src/app/dashboard/page.tsx)
- [frontend/src/features/agenda/agenda-calendar.tsx](/Users/francescostrano/Desktop/HALO/frontend/src/features/agenda/agenda-calendar.tsx)
- [frontend/src/features/pazienti/pazienti-manager.tsx](/Users/francescostrano/Desktop/HALO/frontend/src/features/pazienti/pazienti-manager.tsx)
- [frontend/src/features/fatture/fatture-creator.tsx](/Users/francescostrano/Desktop/HALO/frontend/src/features/fatture/fatture-creator.tsx)
- [frontend/src/features/fatture/fatture-da-incassare.tsx](/Users/francescostrano/Desktop/HALO/frontend/src/features/fatture/fatture-da-incassare.tsx)
- [frontend/src/components/feedback/confirm-dialog.tsx](/Users/francescostrano/Desktop/HALO/frontend/src/components/feedback/confirm-dialog.tsx)
- [frontend/src/app/layout.tsx](/Users/francescostrano/Desktop/HALO/frontend/src/app/layout.tsx)

## Stato Attuale Sintetico

La base è ordinata ma ancora parziale:

- esiste un primo set di design token CSS, ma è limitato a pochi colori, radius e shadow
- il layout applicativo è principalmente desktop-first e non ancora ottimizzato per nav mobile/tablet
- le schermate operative sono molto orientate a form e tabelle, con gerarchia visiva non ancora matura
- i pattern di feedback, loading, empty state, error state e success state non sono ancora sistematizzati
- l'accessibilità è solo parziale: manca una specifica robusta per focus, tastiera, dialog, contrasti e semantica
- la UI è coerente a livello cromatico, ma non ancora abbastanza distintiva, prioritaria e “task-driven”

## Problemi Principali Da Correggere

### 1. Design system troppo sottile

- i token non coprono spacing, font scale, z-index, motion, altezze controlli, badge, tabelle, overlay, stato disabled
- le classi utility custom `halo-*` sono utili, ma non costituiscono ancora un sistema completo di componenti

### 2. Gerarchia visiva non abbastanza forte

- molte aree hanno lo stesso peso visivo
- CTA primaria e secondaria non sono sempre chiaramente distinguibili
- la densità informativa è alta soprattutto nelle viste gestionali con tabella

### 3. Navigazione non ottimale per uso quotidiano intenso

- sidebar fissa adatta a desktop, ma senza pattern dedicato per mobile
- header troppo denso nelle larghezze intermedie
- mancano breadcrumb, azioni contestuali persistenti e indicatori di stato pagina più forti

### 4. Flussi core ancora troppo “CRUD”

- pazienti, agenda e fatture hanno un’impostazione funzionale ma non ancora orientata alla velocità operativa
- mancano filtri persistenti, ricerca evidente, stati rapidi, viste sintetiche e shortcut chiari

### 5. Accessibilità e qualità percettiva incomplete

- `lang` HTML impostato su `en` invece che `it`
- il dialog di conferma non mostra gestione esplicita di focus trap, `Escape`, focus return e inert background
- mancano specifiche minime per contrast ratio, target touch, tastiera e screen reader flow

## Visione Grafica

La UI deve comunicare:

- affidabilità clinica
- velocità operativa di segreteria
- chiarezza amministrativa
- leggibilità elevata anche dopo molte ore di utilizzo

Direzione visiva consigliata:

- palette chiara medicale, meno “generic SaaS” e più professionale-editoriale
- contrasto leggermente più deciso tra sfondo, pannelli, dati e CTA
- tipografia più caratterizzata per titoli e numeri chiave, mantenendo alta leggibilità nei form
- uso intenzionale di superfici, bordi e stati per rendere immediata la scansione delle informazioni

## Specifiche Tecniche Globali

### Design Token

Estendere `:root` in [frontend/src/app/globals.css](/Users/francescostrano/Desktop/HALO/frontend/src/app/globals.css) con questi gruppi:

- colori base:
  - `--ui-bg-canvas`
  - `--ui-bg-surface-1`
  - `--ui-bg-surface-2`
  - `--ui-bg-elevated`
  - `--ui-text-strong`
  - `--ui-text`
  - `--ui-text-muted`
  - `--ui-border-subtle`
  - `--ui-border-strong`
  - `--ui-accent`
  - `--ui-accent-hover`
  - `--ui-accent-soft`
- colori semantici:
  - `--ui-success-*`
  - `--ui-warning-*`
  - `--ui-danger-*`
  - `--ui-info-*`
- tipografia:
  - `--font-heading`
  - `--font-body`
  - `--font-mono`
  - scale `12 / 14 / 16 / 18 / 20 / 24 / 30 / 36`
- spacing:
  - step `4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48`
- radius:
  - `8 / 12 / 16 / 20 / 28`
- shadow:
  - `sm / md / lg / xl`
- motion:
  - `--motion-fast: 120ms`
  - `--motion-base: 180ms`
  - `--motion-slow: 280ms`
  - curve `cubic-bezier(0.2, 0.8, 0.2, 1)`
- z-index:
  - `header / sidebar / overlay / modal / toast`

### Breakpoint E Responsive

Standardizzare i layout su:

- `sm: 640px`
- `md: 768px`
- `lg: 1024px`
- `xl: 1280px`
- `2xl: 1440px`

Regole:

- mobile first reale
- nessuna tabella critica senza fallback card/list su `< md`
- sidebar desktop trasformata in drawer su mobile
- header con wrapping governato e priorità delle CTA

### Accessibilità

Specifiche minime obbligatorie:

- `lang="it"` in [frontend/src/app/layout.tsx](/Users/francescostrano/Desktop/HALO/frontend/src/app/layout.tsx)
- contrasto testo/body minimo `4.5:1`
- contrasto componenti UI essenziali minimo `3:1`
- target interattivi minimi `44x44px`
- focus ring unificato e sempre visibile via tastiera
- supporto `Escape` per drawer e modal
- focus trap e focus restore nei dialog
- `aria-live="polite"` per feedback success/error non bloccanti
- etichette e descrizioni associate a ogni input

### Motion

Limitare l’animazione a:

- page reveal
- overlay/modal entrance
- hover/focus
- skeleton shimmer
- transizione di drawer/sidebar

Vincoli:

- niente animazioni decorative continue
- tutte le motion disattivabili con `prefers-reduced-motion`

## Fasi Di Intervento

## Fase 0 - Audit E Fondazioni

### Obiettivo

Stabilire regole uniche prima di rifinire singole schermate.

### Modifiche

- censire tutti i componenti UI esistenti e i relativi stati
- definire token globali completi
- creare naming convention unica per componenti visuali e utility
- definire griglia layout standard pagina
- impostare checklist accessibilità e responsive

### Specifiche Tecniche

- creare sezioni CSS o moduli dedicati per:
  - base
  - tokens
  - surfaces
  - form controls
  - buttons
  - tables
  - overlays
  - feedback states
- uniformare dimensioni controlli:
  - input/select/button default height: `44px`
  - small controls: `36px`
  - large controls: `52px`
- standardizzare i container:
  - pagina: max `1440px`
  - contenuto principale leggibile: max `1200px`
  - form column: `360px-480px`

### Deliverable

- documento token
- mappa componenti
- checklist QA UI/UX

## Fase 1 - Design System E Shell Applicativa

### Obiettivo

Rendere coerente e premium tutta la struttura portante dell'app.

### Modifiche

- rifacimento della shell in [frontend/src/components/layout/app-shell.tsx](/Users/francescostrano/Desktop/HALO/frontend/src/components/layout/app-shell.tsx)
- sidebar desktop con grouping, icone, badge stato e separazione più netta tra nav e utility
- drawer mobile con backdrop, close action, swipe-safe spacing
- header meno affollato e con priorità visiva chiara
- definizione dei componenti base riusabili:
  - `Button`
  - `Input`
  - `Select`
  - `Textarea`
  - `Card`
  - `StatCard`
  - `SectionHeader`
  - `Badge`
  - `EmptyState`
  - `InlineAlert`
  - `DataTable`
  - `Drawer`
  - `Modal`

### Specifiche Tecniche

- sidebar desktop:
  - width `272px-296px`
  - nav item height `44px`
  - active item con background pieno + bordo o rail laterale
- drawer mobile:
  - width `88vw`, max `360px`
  - overlay `rgba(15,23,42,0.42)`
  - trap focus + close su `Escape`
- header:
  - area sinistra: titolo, descrizione, breadcrumb
  - area destra: chip ruolo, contesto studio, quick action primaria
  - elementi secondari in menu overflow su tablet
- introdurre stato sticky per header e toolbar nelle pagine dense

### File Target

- [frontend/src/components/layout/app-shell.tsx](/Users/francescostrano/Desktop/HALO/frontend/src/components/layout/app-shell.tsx)
- [frontend/src/app/globals.css](/Users/francescostrano/Desktop/HALO/frontend/src/app/globals.css)

## Fase 2 - Login, Feedback E Stati Di Sistema

### Obiettivo

Rendere impeccabile il primo impatto e la percezione di solidità del prodotto.

### Modifiche

- redesign della schermata login in [frontend/src/app/login/page.tsx](/Users/francescostrano/Desktop/HALO/frontend/src/app/login/page.tsx)
- separazione più forte tra contenuto informativo e form
- miglioramento dei messaggi di errore/success/sessione
- introduzione di stati loading, empty, error e success uniformi in tutte le viste
- definizione visuale di toast e banner contestuali

### Specifiche Tecniche

- login layout:
  - split layout da `lg` in su: area brand + area form
  - single column su mobile
  - form width `420px`
- form:
  - label sempre visibile
  - helper text opzionale
  - errore inline sotto campo
  - password visibility toggle
- feedback:
  - alert inline per errori di pagina
  - toast auto-dismiss per successi non critici
  - skeleton standard per contenuti in caricamento

### Note UX

- evitare campi precompilati in produzione
- usare copy più orientata al task e meno generica

## Fase 3 - Dashboard Operativa

### Obiettivo

Trasformare la dashboard da pagina informativa a centro di comando.

### Modifiche

- gerarchia KPI più forte in [frontend/src/app/dashboard/page.tsx](/Users/francescostrano/Desktop/HALO/frontend/src/app/dashboard/page.tsx)
- blocchi distinti per:
  - andamento economico
  - agenda di oggi
  - pazienti recenti
  - fatture urgenti
  - azioni rapide
- migliore differenziazione delle dashboard per ruolo
- uso di evidenze visive per urgenze, scadenze, eccezioni

### Specifiche Tecniche

- layout dashboard:
  - hero intro compatto
  - griglia KPI `4-up` desktop, `2-up` tablet, `1-up` mobile
  - sezione “oggi” sticky above the fold
- KPI card:
  - valore `24-36px`
  - label `12-14px`
  - trend con colore semantico + icona direzione
- liste operative:
  - massimo 5-7 item visibili iniziali
  - CTA “vedi tutto”
  - badge stato allineati e consistenti

### KPI UX Da Raggiungere

- capire lo stato dello studio in meno di `5 secondi`
- raggiungere una funzione primaria in massimo `1 click`

## Fase 4 - Flussi Core: Agenda, Pazienti, Fatture

### Obiettivo

Ridurre il carico cognitivo delle sezioni ad alta frequenza d'uso.

### 4.1 Agenda

#### Modifiche

- ridisegnare [frontend/src/features/agenda/agenda-calendar.tsx](/Users/francescostrano/Desktop/HALO/frontend/src/features/agenda/agenda-calendar.tsx) come workspace operativo
- introdurre toolbar con:
  - ricerca paziente
  - filtri stato
  - filtro medico
  - switch vista giorno/settimana/lista
- rendere gli appuntamenti più leggibili e prioritizzati
- affiancare calendario e lista “prossimi appuntamenti” in modo più chiaro

#### Specifiche Tecniche

- vista desktop:
  - colonna controlli/form `360px`
  - area calendario/lista `minmax(0,1fr)`
- su mobile:
  - form in drawer o sheet
  - calendario semplificato con fallback lista del giorno
- event card:
  - colore stato + orario prominente + nome paziente + medico
  - tooltip o panel dettaglio al click

### 4.2 Pazienti

#### Modifiche

- trasformare [frontend/src/features/pazienti/pazienti-manager.tsx](/Users/francescostrano/Desktop/HALO/frontend/src/features/pazienti/pazienti-manager.tsx) da form+tabella a vista master-detail
- introdurre ricerca, filtri, ordinamento, segmentazione
- scheda paziente con summary, contatti, note, storico sintetico
- maggiore chiarezza tra modalità creazione e modifica

#### Specifiche Tecniche

- desktop:
  - colonna lista pazienti `360-420px`
  - colonna dettaglio `1fr`
- mobile:
  - lista full width
  - dettaglio in route dedicata o drawer fullscreen
- tabella:
  - sostituibile con lista cards responsive sotto `md`
- form:
  - sezioni logiche
  - validazione inline
  - sticky action bar con `Salva` e `Annulla`

### 4.3 Fatture

#### Modifiche

- evolvere [frontend/src/features/fatture/fatture-creator.tsx](/Users/francescostrano/Desktop/HALO/frontend/src/features/fatture/fatture-creator.tsx) e [frontend/src/features/fatture/fatture-da-incassare.tsx](/Users/francescostrano/Desktop/HALO/frontend/src/features/fatture/fatture-da-incassare.tsx)
- dividere chiaramente:
  - creazione fattura
  - elenco fatture
  - incassi e stato Stripe
- introdurre filtri persistenti, summary economici e stati prioritari
- migliorare leggibilità di importi, stati, azioni Stripe

#### Specifiche Tecniche

- usare una top toolbar con:
  - search
  - filter chips
  - date range
  - stato pagamento
  - sync status
- nelle tabelle:
  - colonne allineate per importi e stato
  - action cell sticky desktop
  - row hover meno invasivo
- summary cards:
  - totale
  - in attesa
  - pagato oggi
  - link Stripe attivi

## Fase 5 - Tabelle, Filtri E Densità Informativa

### Obiettivo

Far funzionare bene il gestionale con dataset reali e utilizzo intenso.

### Modifiche

- standardizzare tutte le tabelle
- introdurre pattern unico di toolbar dati
- definire paginazione, ordinamento, selezione righe e bulk actions
- creare empty state utili e non generici

### Specifiche Tecniche

- `DataTable` con:
  - sticky header
  - hover state leggero
  - row height default `52px`
  - density mode `comfortable / compact`
- toolbar dati:
  - ricerca a sinistra
  - filtri in centro
  - azioni a destra
- sotto `md`:
  - switch automatico a cards/list item
- ogni empty state deve avere:
  - titolo
  - breve spiegazione
  - CTA primaria
  - CTA secondaria opzionale

## Fase 6 - Modal, Dialog, Microinterazioni E Polishing

### Obiettivo

Chiudere i dettagli che separano una UI corretta da una UI eccellente.

### Modifiche

- rifinitura di [frontend/src/components/feedback/confirm-dialog.tsx](/Users/francescostrano/Desktop/HALO/frontend/src/components/feedback/confirm-dialog.tsx)
- libreria di modal, drawer e dialog coerenti
- animazioni di entrata/uscita curate ma brevi
- gestione corretta del focus
- microinterazioni utili su hover, press, loading, disabled

### Specifiche Tecniche

- dialog:
  - max width `480px` standard
  - backdrop blur leggero
  - focus iniziale sul bottone safe
  - `Tab` loop
  - chiusura con `Escape`
- button states:
  - rest
  - hover
  - active
  - focus-visible
  - disabled
  - loading
- introdurre progress bar o inline loader per azioni lunghe

## Fase 7 - QA, Test E Misurazione UX

### Obiettivo

Convalidare che il redesign migliori davvero l'esperienza d'uso.

### Checklist Tecnica

- test responsive:
  - `375px`
  - `768px`
  - `1024px`
  - `1440px`
- test tastiera completi su login, sidebar, dialog, form, tabelle
- verifica contrasto colori
- verifica screen reader sui flussi principali
- verifica `prefers-reduced-motion`
- smoke test su tutti i ruoli:
  - `ADMIN`
  - `SEGRETARIO`
  - `DENTISTA`

### Metriche Di Successo

- nessun overflow critico su mobile
- nessuna CTA primaria fuori viewport iniziale nei flussi core
- tempo medio di accesso a:
  - nuovo appuntamento <= `2 click`
  - nuova fattura <= `2 click`
  - apertura scheda paziente <= `2 click`
- Lighthouse accessibility target >= `95`
- consistenza visuale verificata su tutte le pagine core

## Priorità E Ordine Consigliato

1. Fase 0 e Fase 1
2. Fase 2
3. Fase 3
4. Fase 4
5. Fase 5
6. Fase 6
7. Fase 7

## Risultato Atteso

Alla fine del piano HALO deve avere:

- interfaccia immediatamente leggibile
- navigazione rapida da uso professionale quotidiano
- coerenza forte tra tutte le sezioni
- ottima resa mobile/tablet/desktop
- accessibilità reale, non solo formale
- base scalabile per futuri moduli senza degradare la qualità visiva

## Interventi Minimi Immediati Consigliati

Se si vuole massimizzare il miglioramento percepito nel minor tempo possibile, il primo sprint dovrebbe includere:

1. estensione design token e refactor di [frontend/src/app/globals.css](/Users/francescostrano/Desktop/HALO/frontend/src/app/globals.css)
2. rifacimento shell responsive in [frontend/src/components/layout/app-shell.tsx](/Users/francescostrano/Desktop/HALO/frontend/src/components/layout/app-shell.tsx)
3. correzione accessibilità base in [frontend/src/app/layout.tsx](/Users/francescostrano/Desktop/HALO/frontend/src/app/layout.tsx) e [frontend/src/components/feedback/confirm-dialog.tsx](/Users/francescostrano/Desktop/HALO/frontend/src/components/feedback/confirm-dialog.tsx)
4. redesign dashboard in [frontend/src/app/dashboard/page.tsx](/Users/francescostrano/Desktop/HALO/frontend/src/app/dashboard/page.tsx)
5. standardizzazione di tabelle, toolbar e stati in agenda, pazienti e fatture
