# Fase C - Dashboard Guadagni Da Screenshot

Stato: completata  
Data: 2026-04-05

## Obiettivo fase
Rendere la pagina dashboard guadagni coerente allo screenshot target:
- topbar Home + controlli range/frequenza
- KPI strip a 4 blocchi
- chart revenue con area verde e asse temporale
- tabella transazioni con colonne stile riferimento

## File modificato
- `/Users/francescostrano/Desktop/HALO/frontend/src/app/dashboard/page.tsx`

## Interventi principali
1. **Layout dashboard riscritto** con struttura simile al reference:
   - header riga titolo/icone
   - toolbar filtri (`range`, `Daily`)
   - sezione KPI orizzontale con divisori
   - card revenue con area chart
   - tabella transazioni.
2. **Data binding reale mantenuto**:
   - `getGuadagniStats` (admin)
   - `listFatture`
   - `listPazienti`
3. **Metriche KPI mappate**:
   - Customers -> pazienti
   - Conversions -> fatture pagate
   - Revenue -> totale stats (o fallback da fatture)
   - Orders -> totale fatture
4. **Chart revenue SVG custom**:
   - serie ultimi 12 punti
   - line + area fill
   - griglia verticale e label data.
5. **Tabella transazioni**:
   - colonne: `ID`, `Date`, `Status`, `Email`, `Amount`
   - email sintetica costruita da nome/cognome come fallback UI.

## Verifiche
- `npx eslint` sui file interessati -> OK
- `npx tsc --noEmit` -> OK

## Esito fase
- Dashboard guadagni riallineata al target screenshot: SI
- Nessuna modifica backend/API: SI
- Pronto per fase successiva di rifinitura (font/asset/fine-tuning visuale): SI
