# Estensioni Daemon Fase 7

## Obiettivo

Separare davvero la consultazione log dalla dashboard operativa `daemon`.

## Intervento applicato

Frontend aggiornato con route dedicata:

- `frontend/src/app/daemon/logs/page.tsx`

Dashboard `daemon` aggiornata in:

- `frontend/src/app/daemon/console/page.tsx`

## Risultato architetturale

I log non sono piu presenti nella dashboard principale insieme a:

- overview
- config editor
- feature manager
- supporto tecnico

La dashboard mostra ora un blocco sintetico `Logs e audit` con accesso diretto alla nuova route:

- `/daemon/logs`

## Pagina logs dedicata

La nuova schermata:

- usa la stessa API `GET /api/daemon/audit`
- mantiene filtri base per scope, severita e tipo evento
- resta separata dalla console operativa
- ha URL stabile e raggiungibile direttamente

## Effetto operativo

Un operatore `daemon` puo' ora:

- lavorare sulla dashboard tecnica senza rumore audit
- aprire i log in una sezione dedicata
- consultare audit platform e tenant in una schermata focalizzata

## Verifica

- `eslint` OK su `frontend/src/app/daemon/console/page.tsx`
- `eslint` OK su `frontend/src/app/daemon/logs/page.tsx`

