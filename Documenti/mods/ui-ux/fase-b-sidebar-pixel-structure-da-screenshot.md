# Fase B - Sidebar Structure Da Screenshot

Stato: completata  
Data: 2026-04-05

## Obiettivo fase
Ristrutturare il menu sinistro di HALO secondo lo screenshot target:
- brand minimale in alto
- barra search
- elenco voci con icone lineari
- blocco settings con sottovoci espanse
- footer con feedback/help/user

## File modificati
- `/Users/francescostrano/Desktop/HALO/frontend/src/components/layout/app-sidebar.tsx`
- `/Users/francescostrano/Desktop/HALO/frontend/src/components/layout/sidebar-menu-list.tsx`
- `/Users/francescostrano/Desktop/HALO/frontend/src/components/layout/sidebar-footer.tsx`
- `/Users/francescostrano/Desktop/HALO/frontend/src/components/layout/sidebar-types.ts`
- `/Users/francescostrano/Desktop/HALO/frontend/src/components/layout/app-shell.tsx`

## Interventi principali
1. Sidebar ridisegnata con composizione fedele al target:
   - header brand compatto
   - search box con hint `⌘ K`
   - menu verticale con active/hover leggeri
   - footer con azioni supporto e profilo utente.
2. Menu strutturato con sezione `settings` espansa di default e sottovoci.
3. Iconografia menu convertita a icone lineari SVG (coerente al look screenshot).
4. Supporto badge voce (es. inbox/count) aggiunto al model menu (`badge`).
5. Supporto espansione forzata voce (`expanded`) aggiunto al model menu.
6. Collegato `userLabel` dalla shell al footer sidebar.

## Verifiche
- `npx eslint` su file modificati -> OK
- `npx tsc --noEmit` -> OK

## Esito fase
- Struttura menu allineata al target screenshot: SI
- Base pronta per Fase C (dashboard guadagni): SI
