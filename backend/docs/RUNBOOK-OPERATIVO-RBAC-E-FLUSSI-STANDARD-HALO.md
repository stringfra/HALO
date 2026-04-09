# Runbook Operativo RBAC E Flussi Standard HALO

## Obiettivo

Intercettare regressioni su RBAC tenant e flussi standard (`users`, `clients`, `appointments`) prima del rilascio in produzione.

## Prerequisiti

- file `backend/.env` configurato;
- database raggiungibile;
- dipendenze backend installate (`npm install`);
- backend avviato per smoke API (`npm run start` o ambiente equivalente).

## Comandi standard

### 1) Salute piattaforma completa

```bash
npm run platform:health-check
```

Controlla in un unico report:

- salute RBAC multi-tenant;
- tenant attivi senza practitioner (`DIPENDENTE`/`DENTISTA`);
- integrita assegnazioni `pazienti.medico_id`.

Exit code:

- `0` = stato sano;
- `1` = issue presente (azione richiesta).

### 2) Consistenza RBAC tenant

```bash
npm run rbac:check:all
```

Se necessario:

```bash
npm run rbac:repair:all
```

### 3) Gate QA pre-release flussi standard

```bash
npm run qa:smoke:standard-flows
```

Opzionale su tenant specifico:

```bash
npm run qa:smoke:standard-flows -- --studio-id 1
```

La suite verifica obbligatoriamente:

- create user standard;
- create paziente con assegnazione medico;
- create appuntamento;
- lettura liste post-creazione.

Lo script effettua cleanup automatico dei record di test.

## Procedura operativa

1. Eseguire `npm run platform:health-check`.
2. Se fallisce per RBAC, eseguire `npm run rbac:repair:all` e ripetere check.
3. Se fallisce per tenant senza practitioner:
   - creare almeno un utente `DIPENDENTE` o `DENTISTA` nel tenant;
   - ripetere check.
4. Avviare backend.
5. Eseguire `npm run qa:smoke:standard-flows`.
6. Consentire release solo con:
   - health-check OK;
   - smoke QA OK.

## Scheduling consigliato

Esempio cron ogni 6 ore (ambiente Linux):

```bash
0 */6 * * * cd /opt/halo/backend && npm run platform:health-check >> /var/log/halo/platform-health-check.log 2>&1
```

Esempio giornaliero RBAC check:

```bash
15 3 * * * cd /opt/halo/backend && npm run rbac:check:all >> /var/log/halo/rbac-check.log 2>&1
```

## Criteri di alert

- `platform:health-check` exit code `1`;
- `rbac:check:all` con `unhealthy > 0`;
- `qa:smoke:standard-flows` con `status=failed`.

## Azioni correttive rapide

- RBAC inconsistente:
  - `npm run rbac:repair:all`
  - verificare output `unhealthy=0`
- tenant senza practitioner:
  - creare utente `DIPENDENTE`
  - rieseguire health-check
- errore smoke su `clients/appointments`:
  - verificare payload e permessi ruolo;
  - verificare integrita `pazienti.medico_id`;
  - ripetere smoke dopo fix.
