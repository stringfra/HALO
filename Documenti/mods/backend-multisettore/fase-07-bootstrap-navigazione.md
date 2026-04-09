# Fase 7 - Configurazione Moduli E Navigazione Dal Backend HALO

Data: `03 Aprile 2026`
Ambito: `backend bootstrap + frontend shell`
Stato: `completato`

## Obiettivo chiuso in questa fase

Fare in modo che la shell frontend inizi a leggere navigazione e identita tenant dal bootstrap backend invece di basarsi solo su valori hardcoded.

## Modifiche eseguite

Backend:

- aggiornato [feature-flags.service.js](/Users/francescostrano/Desktop/HALO/backend/src/services/feature-flags.service.js) per includere `label` nelle voci di `navigation`

Frontend:

- aggiunto client bootstrap in [frontend/src/features/bootstrap/api.ts](/Users/francescostrano/Desktop/HALO/frontend/src/features/bootstrap/api.ts)
- aggiunto hook in [frontend/src/features/bootstrap/use-bootstrap.ts](/Users/francescostrano/Desktop/HALO/frontend/src/features/bootstrap/use-bootstrap.ts)
- aggiornata shell in [frontend/src/components/layout/app-shell.tsx](/Users/francescostrano/Desktop/HALO/frontend/src/components/layout/app-shell.tsx)

## Cosa usa ora la shell dal backend

- `tenant.branding.product_name`
- `tenant.display_name`
- `tenant.vertical_name`
- `labels`
- `navigation`

## Effetto pratico

La sidebar e l'intestazione della shell possono gia adattarsi a:

- tenant diversi
- labels di dominio diversi
- moduli realmente abilitati dal backend

## Limite intenzionale di questa fase

Non tutto il frontend e ancora backend-driven. Questa fase collega il punto piu importante, cioe la shell applicativa, che era il prerequisito per continuare la migrazione senza duplicare la logica di navigazione.
