# Fase 4 - Verifica autorizzazioni runtime e bootstrap

## Obiettivo tecnico

Confermare che i profili utente abbiano permessi effettivi coerenti a runtime e che il bootstrap tenant esponga navigazione/contesto allineati, senza blocchi `403` inattesi su `pazienti` e `appuntamenti` per i ruoli autorizzati.

## Attivita eseguite

1. Audit utenti reali per tenant e ruolo (`users`).
2. Audit catena RBAC runtime (`roles`, `role_permissions`, `user_roles`) per utente.
3. Confronto automatico permessi di sistema reali vs contratto atteso (`ADMIN`, `SEGRETARIO`, `DIPENDENTE`) per ogni tenant.
4. Verifica bootstrap runtime (`getTenantBootstrap`) per utenti reali:
   - permessi risolti
   - moduli abilitati
   - navigazione risultante
5. Test controllato “creazione utente standard + login” con utente temporaneo e cleanup completo.
6. Verifica precondizioni operative per assegnazione medico (conteggio practitioner per tenant).

## Evidenze tecniche

### 1) Utenti e ruoli presenti

- `studio_id=1`: `ADMIN`, `DIPENDENTE`
- `studio_id=3`: `ADMIN`, `SEGRETARIO`
- `studio_id=4`: `ADMIN`

### 2) Permessi runtime per utente (estratto)

- `ADMIN` -> 15 permessi, include `clients.read/write`, `appointments.read/write`, `users.read/write`, `settings.manage`
- `SEGRETARIO` -> 8 permessi, include `clients.read/write`, `appointments.read/write`
- `DIPENDENTE` -> 5 permessi, include `clients.read`, `appointments.read/write`

Nessun utente con role assignment incoerente o permessi mancanti rispetto al proprio ruolo base.

### 3) Confronto contratto permessi ruoli di sistema

Confronto `actual` vs `expected` per ciascun tenant e ruolo:

- `ADMIN`: `missing=[]`, `extra=[]`
- `SEGRETARIO`: `missing=[]`, `extra=[]`
- `DIPENDENTE`: `missing=[]`, `extra=[]`

Risultato: allineamento completo su tutti i tenant presenti (`1`, `3`, `4`).

### 4) Bootstrap runtime

Verifica `getTenantBootstrap` su utenti reali:

- `ADMIN` (studio 1/3/4): navigazione include `dashboard, agenda, clients, billing, inventory, settings`
- `SEGRETARIO` (studio 3): navigazione include `dashboard, agenda, clients, billing`
- `DIPENDENTE` (studio 1): navigazione include `dashboard, agenda, clients, billing`

Conclusione: bootstrap e navigazione coerenti con permessi effettivi.

### 5) Test controllato creazione utente standard + login

Esecuzione su `studio_id=1`:

- creato utente temporaneo `DIPENDENTE` (via servizio di creazione tenant user)
- login applicativo riuscito (`status=200`)
- token tenant valido con `identityType=tenant_user`, `role=DIPENDENTE`, `permissions_count=5`
- cleanup riuscito (`DELETE user`)

Nessun errore nel flusso tecnico “create user + login”.

### 6) Precondizioni operative assegnazione dottore

Audit tenant attivi:

- `studio_id=1`: `practitioner_count=1` (ok)
- `studio_id=3`: `practitioner_count=0`
- `studio_id=4`: `practitioner_count=0`

Nota: nei tenant senza almeno un practitioner (`DENTISTA`/`DIPENDENTE`) la creazione paziente con assegnazione dottore non e operabile per assenza di candidati, anche con RBAC corretto.

## Checklist permessi per profilo (deliverable fase)

- `ADMIN`: OK
- `SEGRETARIO`: OK
- practitioner (`DIPENDENTE`/`DENTISTA`): OK

## Criterio di uscita fase

Raggiunto.

Non emergono blocchi `403` inattesi su `pazienti/appuntamenti` per ruoli autorizzati nel modello RBAC runtime verificato.

## Gap residui non-RBAC (da considerare nel collaudo fase successiva)

- Tenant attivi senza practitioner (`studio_id=3`, `studio_id=4`) non possono completare flussi paziente/appuntamento finche non viene creato almeno un utente operativo (`DIPENDENTE` o `DENTISTA`).

## Input per fase successiva

Procedere con **Fase 5 - Collaudo funzionale end-to-end**:

1. test smoke completo su tenant con practitioner disponibile (`studio_id=1`);
2. verifica esplicita esito atteso su tenant senza practitioner;
3. evidenza log/errori durante create paziente e create/update appuntamento.
