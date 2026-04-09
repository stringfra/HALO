# Fase 5 - Collaudo funzionale end-to-end

## Obiettivo tecnico

Validare operativita reale dei flussi business `utenti -> pazienti -> appuntamenti` dopo il ripristino RBAC/dati.

## Attivita eseguite

Smoke test API reale su backend (`http://localhost:4000`) con token applicativi e cleanup automatico:

1. creazione utente standard da piattaforma (`POST /api/v2/users`);
2. creazione paziente con assegnazione dottore (`POST /api/v2/clients`);
3. creazione appuntamento su paziente assegnato (`POST /api/v2/appointments`);
4. aggiornamento appuntamento (`PUT /api/v2/appointments/:id`);
5. verifica lettura liste pazienti/agenda (`GET /api/v2/clients`, `GET /api/v2/appointments`) come `ADMIN` e practitioner.

Verifica aggiuntiva per tenant secondari:

- login admin e lettura liste utenti/pazienti/appuntamenti su `studio_id=3` e `studio_id=4`.

## Risultati

### Tenant operativo completo (`studio_id=1`)

Esiti:

- `temp_admin_login`: `200`
- `create_user_standard`: `201` (utente practitioner creato)
- `practitioner_login`: `200`
- `assign_doctor_new_patient`: `201`
- `create_appointment`: `201`
- `update_appointment`: `200` (`result_status=confermato`)
- `read_lists_admin`: `200/200`, record creati visibili
- `read_lists_practitioner`: `200/200`, record assegnati visibili

Conclusione: flusso E2E pienamente funzionante sul tenant target.

### Tenant secondari (`studio_id=3`, `studio_id=4`)

Esiti runtime:

- login admin temporaneo: `200`
- lettura `users/clients/appointments`: `200`
- nessun practitioner presente in elenco utenti (`practitioner_users_count=0`)

Conclusione: API raggiungibili e autorizzazioni corrette, ma mancano utenti practitioner per flussi clinici operativi.

## Evidenze precondizioni

Conteggio practitioner rilevato:

- `studio_id=1`: `1`
- `studio_id=3`: `0`
- `studio_id=4`: `0`

## Cleanup e integrita post-test

Cleanup completato:

- utenti test eliminati: `4`
- pazienti test eliminati: `1`
- appuntamenti test eliminati: `1`

Verifica residui DB:

- `users` test residui: `0`
- `pazienti` test residui: `0`
- `appuntamenti` test residui: `0`

## Criterio di uscita fase

Raggiunto per il tenant verificato end-to-end (`studio_id=1`).

Flussi pazienti/appuntamenti operativi al 100% sul tenant con practitioner disponibile.

## Rischio residuo

`studio_id=3` e `studio_id=4` restano non operativi sui flussi paziente/appuntamento finche non viene creato almeno un utente `DIPENDENTE` o `DENTISTA`.

## Input per fase successiva

Procedere con **Fase 6 - Stabilizzazione e prevenzione regressioni**:

- consolidare runbook check+repair;
- introdurre guard rail operativi su tenant senza practitioner;
- formalizzare checklist di verifica periodica.
