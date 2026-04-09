# FREEZE / RELEASE INTERNO - EX-16

## Snapshot
- Data: 2026-04-01
- Ambito: chiusura sprint post-RBAC (`EX-01` -> `EX-16`)
- Esito: **READY interno**

## Changelog breve

### Sicurezza e auth
1. Token handling migliorato:
- distinzione token scaduto/non valido
- redirect login con reason coerente.
2. Refresh token completo:
- login con access+refresh
- refresh con rotazione
- logout con revoca.
3. Middleware auth rinforzato:
- validazione payload JWT con `id`, `ruolo`, `studio_id`.

### RBAC e dominio
1. RBAC consolidato su backend e frontend per `ADMIN`, `SEGRETARIO`, `DENTISTA`.
2. Gestione utenti admin completa (CRUD + blocchi sicurezza).
3. Validazioni input core allineate backend/frontend.

### Multi-studio
1. Schema esteso con tabella `studi`.
2. `studio_id` su `users`, `pazienti`, `appuntamenti`, `fatture`, `prodotti`.
3. Scoping query backend per isolamento dati studio.
4. Context studio esposto in UI (header/impostazioni) con selettore predisposto.

### Documentazione e quality gates
1. Checklist e note API aggiornate.
2. Report di test prodotti:
- EX-09 auth E2E
- EX-12 studio scoping
- EX-15 smoke finale completo.

## Evidenze test
1. `TEST-REPORT-EX09-AUTH.md` -> PASS (flusso login/refresh/logout coerente).
2. `TEST-REPORT-EX12-STUDIO-SCOPING.md` -> PASS (isolamento cross-studio verificato).
3. `TEST-REPORT-EX15-SMOKE.md` -> PASS `36/36`.
4. Frontend lint -> PASS.

## Punti noti
1. Selettore studio UI non ancora attivo per switch runtime (attualmente informativo/disabilitato).
2. Mancano ancora test browser automatizzati end-to-end (Playwright/Cypress).
3. Mancano job schedulati di retention/cleanup storico `refresh_tokens`.

## Decisione release interna
- Stato: **APPROVATA PER USO INTERNO**
- Bloccanti aperti: **nessuno**
- Follow-up post-release: abilitazione switch studio UI + test automation estesa.
