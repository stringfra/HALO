# DAEMON FASE 7 HARDENING HALO

Data: `04 Aprile 2026`
Stato: `completata`

## Obiettivo della fase

Ridurre il rischio operativo introdotto da un profilo `daemon` con privilegi massimi.

## Misure applicate

### Policy accesso ambiente

E stata introdotta una policy backend dedicata:

- [backend/src/middleware/daemon-hardening.js](/Users/francescostrano/Desktop/HALO/backend/src/middleware/daemon-hardening.js)

Regole:

- in produzione la console daemon e bloccata di default se `DAEMON_CONSOLE_ENABLED` non e esplicitamente abilitata
- e possibile applicare allowlist IP tramite `DAEMON_ALLOWED_IPS`

### Conferma obbligatoria per scritture critiche

Le operazioni di scrittura daemon ora richiedono:

- conferma esplicita UI
- header di conferma server-side
- motivazione tecnica minima

Questo e stato applicato a:

- update tenant config
- update tenant features

### Warning operativi in UI

La console frontend mostra ora:

- banner di area ad alta criticita
- stato della policy di hardening nella sezione diagnostica
- dialog di conferma per azioni sensibili

## Output tecnico

Sono stati aggiornati:

- [backend/src/middleware/daemon-hardening.js](/Users/francescostrano/Desktop/HALO/backend/src/middleware/daemon-hardening.js)
- [backend/src/routes/daemon-auth.routes.js](/Users/francescostrano/Desktop/HALO/backend/src/routes/daemon-auth.routes.js)
- [backend/src/routes/daemon.routes.js](/Users/francescostrano/Desktop/HALO/backend/src/routes/daemon.routes.js)
- [backend/src/services/daemon-console.service.js](/Users/francescostrano/Desktop/HALO/backend/src/services/daemon-console.service.js)
- [frontend/src/features/daemon-console/api.ts](/Users/francescostrano/Desktop/HALO/frontend/src/features/daemon-console/api.ts)
- [frontend/src/app/daemon/console/page.tsx](/Users/francescostrano/Desktop/HALO/frontend/src/app/daemon/console/page.tsx)

## Variabili ambiente utili

- `DAEMON_CONSOLE_ENABLED=true|false`
- `DAEMON_ALLOWED_IPS=127.0.0.1,::1`

## Stato finale della fase

La console daemon resta operativa in locale, ma non e piu un pannello senza attriti:

- accesso controllabile da policy ambiente
- scritture con conferma doppia
- maggiore visibilita dei rischi in UI
