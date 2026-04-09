# Fase 9 - Servizi Applicativi E Guardie Di Feature HALO

Data: `03 Aprile 2026`
Ambito: `backend service layer + request context`
Stato: `completato`

## Obiettivo chiuso in questa fase

Centralizzare tenant, labels, permessi e feature in servizi e middleware riusabili, riducendo la logica sparsa nelle route.

## Modifiche eseguite

Nuovi componenti:

- [labels.service.js](/Users/francescostrano/Desktop/HALO/backend/src/services/labels.service.js)
- [request-context.js](/Users/francescostrano/Desktop/HALO/backend/src/middleware/request-context.js)

Aggiornamenti principali:

- [authController.js](/Users/francescostrano/Desktop/HALO/backend/controllers/authController.js)
  ora emette JWT con `permissions` risolti
- [authMiddleware.js](/Users/francescostrano/Desktop/HALO/backend/middlewares/authMiddleware.js)
  ora riusa `req.user.permissions` se gia presenti
- [automazioni.routes.js](/Users/francescostrano/Desktop/HALO/backend/src/routes/automazioni.routes.js)
  ora usa `attachRequestContext` e `requirePermission("automations.read")`
- [reminder.service.js](/Users/francescostrano/Desktop/HALO/backend/src/services/reminder.service.js)
  ora filtra per `studioId`
- [recall.service.js](/Users/francescostrano/Desktop/HALO/backend/src/services/recall.service.js)
  ora filtra per `studioId`

## Correzione importante

Prima di questa fase i servizi automazioni non erano realmente tenant-safe: leggevano appuntamenti e pazienti senza vincolo esplicito sul tenant.

Ora:

- reminder appuntamenti e richiami pazienti lavorano sul tenant corrente
- i testi possono usare labels tenant-specific
- il contesto richiesta puo essere riusato dalle route successive

## Risultato pratico

Il backend multi-settore non dipende piu solo da guardie puntuali sulle route. Esiste ora un contesto applicativo per richiesta che porta con se:

- tenant
- labels
- permessi utente

ed evita di duplicare la stessa logica in piu punti.
