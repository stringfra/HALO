# Fase 2 - Refactor Strutturale Sidebar (Next.js)

Stato: completata  
Data: 2026-04-05

## Obiettivo fase
Separare la sidebar da `AppShell` in componenti dedicati, mantenendo invariata la logica applicativa (sessione, bootstrap, ruoli, redirect).

## Modifiche eseguite

### Nuovi file
- `/Users/francescostrano/Desktop/HALO/frontend/src/components/layout/sidebar-types.ts`
  - tipo condiviso `AppSidebarItem`
  - helper `isSidebarItemActive`
  - helper `filterSidebarItemsByRole`
- `/Users/francescostrano/Desktop/HALO/frontend/src/components/layout/sidebar-menu-list.tsx`
  - rendering menu ricorsivo (supporto `children`)
- `/Users/francescostrano/Desktop/HALO/frontend/src/components/layout/sidebar-footer.tsx`
  - placeholder footer per step successivi (toggle collapse in Fase 3)
- `/Users/francescostrano/Desktop/HALO/frontend/src/components/layout/app-sidebar.tsx`
  - componente sidebar principale (brand + nav + footer)

### File aggiornato
- `/Users/francescostrano/Desktop/HALO/frontend/src/components/layout/app-shell.tsx`
  - rimossa sidebar inline
  - introdotto uso di `AppSidebar`
  - allineata logica active-route con helper condiviso
  - filtro ruolo centralizzato con helper (compatibile con future voci annidate)
  - mantenuta logica di bootstrap navigation e redirect invariata

## Verifica tecnica
- TypeScript check: `npx tsc --noEmit` in `frontend` -> OK
- Lint globale progetto: fallisce per issue preesistente in test JS (`require()` in `frontend/tests/daemon-ui-smoke.test.js`), non legata ai file modificati in Fase 2.

## Exit criteria fase
1. Sidebar modularizzata in componenti dedicati: SI
2. Data model menu pronto per `children`/espansione: SI
3. Nessuna regressione di typing sui file modificati: SI
4. Pronto per Fase 3 (interazioni collapse/active/submenu): SI

Esito: SUPERATO.
