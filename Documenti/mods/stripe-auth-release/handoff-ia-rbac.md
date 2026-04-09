# HANDOFF IA - RBAC / AUTH / MULTI-STUDIO (HALO)

## Stato finale
- Data snapshot: 2026-04-01
- Stato roadmap `PASSAGGI EXTRA`: **EX-01 -> EX-16 completati**
- Stato operativo: **sprint chiuso (freeze interno eseguito)**

## Riepilogo sintetico consegne
1. RBAC backend/frontend completato su ruoli `ADMIN`, `SEGRETARIO`, `DENTISTA`.
2. Hardening validazioni input backend/frontend su moduli core.
3. Auth avanzata:
- `POST /api/login`
- `POST /api/refresh`
- `POST /api/logout`
- rotazione/revoca refresh token.
4. Multi-studio:
- schema `studi` + `studio_id` su tabelle dominio
- `studio_id` propagato in JWT
- middleware con validazione contesto studio
- query CRUD scoped per studio.
5. UI contesto studio:
- header con studio attivo
- impostazioni admin con selettore studio predisposto (disabilitato single-studio).
6. Documentazione e report test aggiornati.

## Report test disponibili
- `TEST-REPORT-EX09-AUTH.md` (regressione auth end-to-end)
- `TEST-REPORT-EX12-STUDIO-SCOPING.md` (isolamento dati per studio)
- `TEST-REPORT-EX15-SMOKE.md` (smoke finale completo: 36/36 PASS)

## Documenti operativi
- `PASSAGGI EXTRA.md` (roadmap eseguita)
- `TEST-CHECKLIST-RBAC-FASE5-6.md` (checklist aggiornata)
- `SPEC-REFRESH-TOKEN.md` (design refresh token)
- `AUTH-API-NOTES.md` (contratti API auth)
- `FREEZE-RELEASE-EX16.md` (snapshot finale/changelog/punti noti)

## Punti noti non bloccanti
1. Selettore studio UI e presente ma bloccato (single-studio), nessun cambio contesto runtime ancora esposto.
2. Test UI browser full-manual non inclusi nei report automatici; copertura principale fatta via API + lint.

## Ripartenza consigliata (post-freeze)
1. Abilitare selezione studio lato UI con cambio contesto controllato.
2. Aggiungere suite test automatica backend/frontend (integrazione + e2e browser).
3. Preparare policy di rotazione/cleanup periodico refresh token a livello ops.
