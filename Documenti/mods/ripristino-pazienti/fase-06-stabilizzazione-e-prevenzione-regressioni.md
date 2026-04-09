# Fase 6 - Stabilizzazione e prevenzione regressioni

## Obiettivo tecnico

Ridurre il rischio di ricaduta post-ripristino introducendo un processo operativo standard (check + repair + smoke gate) eseguibile prima del rilascio.

## Interventi implementati

### 1) Strumenti operativi permanenti

Nuovi script backend:

- `backend/scripts/platform-health-check.js`
  - verifica in un unico report:
    - salute RBAC multi-tenant
    - tenant attivi senza practitioner
    - integrita assegnazioni `pazienti.medico_id`
  - exit code `1` in presenza di issue
- `backend/scripts/qa-smoke-standard-flows.js`
  - suite minima obbligatoria pre-release:
    - create user standard
    - create paziente con assegnazione medico
    - create appuntamento
    - lettura liste post-creazione
  - cleanup automatico dei record di test

### 2) Comandi npm standardizzati

Aggiornato `backend/package.json` con:

- `npm run rbac:check:all`
- `npm run rbac:repair:all`
- `npm run platform:health-check`
- `npm run qa:smoke:standard-flows`

### 3) Runbook e checklist versionati

Creati documenti tecnici:

- [RUNBOOK-OPERATIVO-RBAC-E-FLUSSI-STANDARD-HALO.md](/Users/francescostrano/Desktop/HALO/backend/docs/RUNBOOK-OPERATIVO-RBAC-E-FLUSSI-STANDARD-HALO.md)
- [CHECKLIST-QA-PRE-RELEASE-FLUSSI-STANDARD-HALO.md](/Users/francescostrano/Desktop/HALO/backend/docs/CHECKLIST-QA-PRE-RELEASE-FLUSSI-STANDARD-HALO.md)

Contenuti inclusi:

- sequenza operativa check/repair/smoke
- criteri bloccanti release
- esempi di schedulazione periodica (cron)
- KPI minimi di accettazione

## Evidenze oggettive esecuzione

### A) Verifica RBAC periodica

Comando:

```bash
npm run rbac:check:all
```

Esito:

- `tenants=3`
- `unhealthy=0`

### B) Health check piattaforma

Comando:

```bash
npm run platform:health-check
```

Esito:

- `rbac_unhealthy_tenants_total = 0`
- `active_tenants_without_practitioner_total = 2` (`studio_id=3`, `studio_id=4`)
- `patient_assignment_issue_tenants_total = 0`
- exit code `1` (atteso: issue intercettata preventivamente)

### C) QA smoke gate pre-release

Comando:

```bash
npm run qa:smoke:standard-flows
```

Esito:

- `status = ok`
- suite minima completata con successo su tenant target operativo (`studio_id=1`)
- cleanup completo:
  - utenti test eliminati
  - pazienti test eliminati
  - appuntamenti test eliminati

## Deliverable fase

- runbook operativo versionato: presente
- checklist QA pre-release aggiornata: presente

## Criterio di uscita fase

Raggiunto.

Esiste un processo standard, automatizzato e versionato che intercetta il problema prima della produzione:

1. health-check periodico
2. check/repair RBAC
3. smoke gate obbligatorio su flussi critici

## Nota operativa residua

I tenant attivi `studio_id=3` e `studio_id=4` restano non operativi sui flussi clinici finche non viene creato almeno un practitioner (`DIPENDENTE` o `DENTISTA`).
