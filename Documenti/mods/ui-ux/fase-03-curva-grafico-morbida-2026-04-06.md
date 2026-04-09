# Fase 3 - Curva Grafico Morbida (No Spikes)

Stato: completata  
Data: 2026-04-06

## Obiettivo della fase
Ridurre l'effetto "a punta" del grafico revenue sostituendo la polilinea con una curva morbida, mantenendo fedelta ai dati e stabilita visiva.

## File modificato
1. `/Users/francescostrano/Desktop/HALO/frontend/src/app/dashboard/page.tsx`

## Implementazione eseguita
1. Introdotta funzione `buildMonotoneCurvePaths(...)`.
2. Sostituita la costruzione path `M/L` lineare con path cubic Bezier `C`.
3. Applicato slope limiter monotono (metodo Fritsch-Carlson) per:
   - prevenire overshoot
   - evitare oscillazioni artificiali
   - mantenere andamento regolare tra punti.
4. Area fill aggiornata per seguire la nuova curva (non piu la vecchia spezzata).
5. Gestiti edge case:
   - 0 punti -> path vuoto
   - 1 punto -> path minimale consistente.

## Risultato tecnico
1. La linea revenue e significativamente piu arrotondata.
2. Il tracciato resta stabile anche con variazioni forti tra punti.
3. L'area sotto la curva resta coerente col profilo del grafico.

## Verifiche
1. `npx eslint src/app/dashboard/page.tsx` -> OK
2. `npx tsc --noEmit` -> OK

## Esito fase
`SUPERATO`  
Grafico aggiornato a curva morbida e monotona, con rischio spike ridotto.
