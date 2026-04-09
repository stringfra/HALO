# Fase 3 - Riallineamento dati clinici assegnazione medico

## Obiettivo tecnico

Garantire che ogni record in `pazienti` abbia `medico_id` valido e coerente con un practitioner del tenant (`DENTISTA` o `DIPENDENTE`), eliminando i casi che bloccano flussi pazienti/appuntamenti.

## Attivita eseguite

1. Audit integrita su `pazienti.medico_id` per tenant:
   - pazienti senza medico
   - pazienti con medico inesistente
   - pazienti con medico non practitioner
2. Verifica elenco practitioner disponibili per tenant.
3. Correzione controllata:
   - assegnazione automatica solo nei tenant con **unico practitioner**
   - update solo su record con `medico_id IS NULL`
4. Audit post-fix con dettaglio record.

## Evidenze pre-fix

Stato rilevato:

- `studio_id=1`
  - `pazienti_totali=3`
  - `senza_medico=1`
  - `medico_non_esistente=0`
  - `medico_non_practitioner=0`

Practitioner disponibili:

- `studio_id=1`, `medico_id=3`, `ruolo=DIPENDENTE`, `nome=Francesco`

Paziente senza assegnazione:

- `paziente_id=1`, `studio_id=1`, `nome=Francesco`, `cognome=Strano`, `medico_id=NULL`

## Fix applicato

Strategia SQL deterministica:

- costruzione set `single_practitioner_per_studio` (tenant con esattamente 1 practitioner)
- update `pazienti.medico_id` da tale set
- esclusione di tenant con piu practitioner per evitare assegnazioni arbitrarie

Esito update:

- 1 record aggiornato:
  - `paziente_id=1` -> `medico_id=3`

## Evidenze post-fix

Stato finale:

- `studio_id=1`
  - `pazienti_totali=3`
  - `senza_medico=0`
  - `medico_non_esistente=0`
  - `medico_non_practitioner=0`

Dettaglio finale pazienti:

- `paziente_id=1` -> `medico_id=3` (`DIPENDENTE`)
- `paziente_id=2` -> `medico_id=3` (`DIPENDENTE`)
- `paziente_id=3` -> `medico_id=3` (`DIPENDENTE`)

## Criterio di uscita fase

Raggiunto.

Ogni paziente nel tenant verificato punta a un dottore valido (`DENTISTA`/`DIPENDENTE`), con inconsistenze azzerate.

## Input per fase successiva

Procedere con **Fase 4 - Verifica autorizzazioni runtime e bootstrap**:

- controllo permessi effettivi su profili `ADMIN`, `SEGRETARIO`, practitioner
- verifica assenza blocchi `403` inattesi su pazienti/appuntamenti
- controllo dati bootstrap esposti al frontend (lista dottori/ruoli)
