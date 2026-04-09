# Fase 1 - Verifica e allineamento schema `ruolo_utente`

## Obiettivo fase

Garantire che il database runtime supporti il valore enum `DIPENDENTE` richiesto dalle query backend su pazienti/appuntamenti.

## Stato iniziale rilevato

Verifica enum pre-intervento:

- `ADMIN`
- `DENTISTA`
- `SEGRETARIO`

`DIPENDENTE` assente.

Effetto osservato:

- le query con filtro `u.ruolo IN ('DENTISTA','DIPENDENTE')` fallivano con:
  - `invalid input value for enum ruolo_utente: "DIPENDENTE"`

## Intervento eseguito (runtime DB)

Esecuzione schema idempotente:

- `psql "$DATABASE_URL" -f database/schema.sql`

Questo ha applicato il blocco `DO` iniziale che aggiunge `DIPENDENTE` al tipo `ruolo_utente` se mancante.

## Evidenze post-intervento

### 1. Enum aggiornato

Valori enum post-fix:

- `ADMIN`
- `DENTISTA`
- `SEGRETARIO`
- `DIPENDENTE`

### 2. Query practitioner ora eseguibili

Check SQL su pazienti:

- `pazienti_totali = 3`
- `senza_medico = 1`
- `medico_non_valido = 0`

Check SQL su creabilita appuntamenti:

- `appointments_creabili = 2`

### 3. Stato ruoli utenti (informativo)

Distribuzione attuale:

- `ADMIN = 3`
- `DENTISTA = 1`
- `SEGRETARIO = 1`

## Esito fase

Fase 1 completata.

Risolto il blocco schema che causava errore SQL sulle query con `DIPENDENTE`.

## Residui emersi (fase successiva)

- Esiste almeno 1 paziente senza medico assegnato (`senza_medico = 1`), tema da trattare nella fase dati/RBAC successiva.
