# Checklist QA Pre-Release Flussi Standard HALO

## Scope

Checklist minima obbligatoria per ridurre regressioni su:

- creazione utente standard;
- creazione paziente con assegnazione medico;
- creazione appuntamento.

## Gate bloccanti

1. `npm run platform:health-check` -> `status.ok = true`
2. `npm run rbac:check:all` -> `unhealthy = 0`
3. `npm run qa:smoke:standard-flows` -> `status = ok`

Se uno dei tre gate fallisce, la release e bloccata.

## Verifiche funzionali minime

1. Login admin tenant.
2. Creazione utente `DIPENDENTE` da piattaforma standard.
3. Login utente appena creato.
4. Creazione paziente con `owner_user_id` valorizzato.
5. Creazione appuntamento sul paziente appena creato.
6. Lettura lista pazienti.
7. Lettura lista appuntamenti.

## Evidenze da archiviare

- output JSON `platform:health-check`;
- output `rbac:check:all`;
- output JSON `qa:smoke:standard-flows`;
- timestamp esecuzione e ambiente target.

## KPI minimi accettazione

- errori 500 su `POST /api/v2/clients` = 0
- errori 500 su `POST /api/v2/appointments` = 0
- errori 403 inattesi su ruoli autorizzati = 0
- tenant con inconsistenze RBAC = 0 (perimetro target)
