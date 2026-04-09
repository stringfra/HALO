# TEST CHECKLIST - RBAC / AUTH / MULTI-STUDIO (HALO)

## Prerequisiti
- Backend avviato (`backend`): `npm run dev`
- Frontend avviato (`frontend`): `npm run dev`
- DB aggiornato con `database/schema.sql`
- Utente seed ADMIN:
  - email: `admin@studio.com`
  - password: `Admin123!`

## 1) Login e sessione
1. `POST /api/login` con credenziali corrette.
2. Atteso: `200` con `access_token`, `refresh_token`, `token`.
3. Login con password errata.
4. Atteso: `401`.

## 2) Refresh token flow
1. Eseguire `POST /api/refresh` con `refresh_token` valido.
2. Atteso: `200` con nuovo `access_token` e nuovo `refresh_token`.
3. Riutilizzare il vecchio refresh token dopo rotazione.
4. Atteso: `401` (`Refresh token revocato.`).
5. Eseguire `POST /api/logout` con refresh token corrente.
6. Atteso: `200` (`Logout completato.`).
7. Tentare `POST /api/refresh` dopo logout con token revocato.
8. Atteso: `401`.

## 3) RBAC endpoint principali
1. ADMIN su `GET /api/users` -> `200`.
2. DENTISTA/SEGRETARIO su `GET /api/users` -> `403`.
3. DENTISTA su `GET /stats/guadagni` -> `403`.
4. Nessun token su endpoint protetti -> `401`.

## 4) RBAC frontend pagine
1. ADMIN:
- vede `Dashboard`, `Agenda`, `Pazienti`, `Fatture`, `Magazzino`, `Impostazioni`.
2. SEGRETARIO:
- vede `Dashboard`, `Agenda`, `Pazienti`, `Fatture`.
- non vede `Magazzino` e `Impostazioni`.
3. DENTISTA:
- vede `Dashboard`, `Agenda`, `Pazienti`.
- agenda e pazienti in sola consultazione secondo policy.

## 5) Multi-studio isolamento dati
1. Con due admin su studi diversi:
- `GET /api/users`: ciascuno vede solo utenti del proprio studio.
2. Creare paziente in studio A:
- non deve apparire in studio B.
3. Tentare update/delete cross-studio su paziente/prodotto/utente:
- atteso `404`.
4. Tentare create appuntamento/fattura in studio B usando `paziente_id` di studio A:
- atteso `400` (`Il paziente selezionato non esiste.`).

## 6) Validazione token context
1. Usare token valido con claim `studio_id`:
- endpoint protetti rispondono regolarmente.
2. Usare token senza `studio_id` (o invalido):
- atteso `401` con messaggio token non valido.

## 7) Logging sicurezza
1. Verificare log backend con prefisso `[AUTH_DENY]` per:
- token mancante
- token invalido/scaduto
- ruolo non autorizzato
- contesto token non valido (`studio_id` mancante/non valido)
2. Verificare campi principali: `requestId`, `method`, `path`, `ip`, `userId`, `studioId`, `ruolo`, `reason`.

## 8) Esito finale atteso
- Auth refresh flow stabile.
- RBAC coerente backend/frontend.
- Isolamento dati per `studio_id` effettivo.
- Logging sicurezza attivo e leggibile.
