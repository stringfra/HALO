# PIANO RIPRISTINO PAZIENTI E APPUNTAMENTI POST REFACTOR RUOLI HALO

## Obiettivo generale

Ripristinare in modo stabile i flussi:

- assegnazione dottore su paziente
- creazione paziente
- creazione appuntamento

dopo le modifiche recenti su ruoli e RBAC (`DENTISTA`/`DIPENDENTE`), senza introdurre workaround temporanei e mantenendo coerenza tra schema database, dati tenant e permessi runtime.

## Perimetro tecnico

Area impattata:

- backend route `pazienti` e `appuntamenti`
- modello ruoli utente (`ruolo_utente`)
- RBAC tenant (`roles`, `user_roles`, `role_permissions`)
- dati di assegnazione `pazienti.medico_id`

Esclusioni:

- redesign UI/UX
- nuove feature prodotto
- refactor architetturali non necessari al ripristino

## Sintesi rischio principale

Rischio prioritario: mismatch tra codice aggiornato che usa anche `DIPENDENTE` e database/tenant non completamente migrati.

Effetto tipico:

- errori server in creazione paziente/appuntamento
- messaggi applicativi generici
- blocco operativo su flussi base

## Fase 0. Baseline diagnostica controllata

### Obiettivo

Raccogliere prove tecniche ripetibili sul tenant reale prima di ogni intervento.

### Attivita

- identificare tenant, utente, ruolo e payload che falliscono
- raccogliere log applicativi con stack trace completo
- classificare errore per tipo:
  - validazione payload
  - permessi (`403`)
  - errore SQL/schema (`500`)
  - incoerenza dati assegnazione medico

### Deliverable

- report baseline con almeno 3 casi riproducibili
- matrice errore `endpoint -> codice -> causa`

### Criterio di uscita

Ogni errore osservato e tracciato a una causa tecnica concreta.

## Fase 1. Verifica e allineamento schema `ruolo_utente`

### Obiettivo

Garantire che il DB reale supporti formalmente il valore enum `DIPENDENTE`.

### Attivita

- verificare presenza enum `DIPENDENTE` in `ruolo_utente`
- se assente, eseguire migrazione enum in ambiente target
- confermare che tutte le query con filtro `IN ('DENTISTA','DIPENDENTE')` siano eseguibili

### Deliverable

- evidenza SQL di enum aggiornato
- check di compatibilita query pazienti/appuntamenti

### Criterio di uscita

Nessun errore DB causato da enum mancante.

## Fase 2. Migrazione dati legacy ruoli e RBAC tenant

### Obiettivo

Rendere coerente il modello ruoli su tenant esistenti:

- `users.ruolo`
- `roles.role_key`
- `user_roles`
- `settings_json.roles`

### Attivita

- eseguire migrazione legacy `DENTISTA -> DIPENDENTE` sui tenant impattati
- eseguire repair RBAC per riallineare assegnazioni
- validare che ogni utente abbia esattamente un ruolo di sistema coerente

### Deliverable

- report pre/post con:
  - `missing_system_role`
  - `legacy_role_mismatch`
  - `multiple_system_roles`
- conteggio inconsistenze a zero

### Criterio di uscita

RBAC coerente e verificato su tutti i tenant target.

## Fase 3. Riallineamento dati clinici assegnazione medico

### Obiettivo

Garantire che i pazienti puntino a un utente medico valido nel tenant.

### Attivita

- verificare integrita di `pazienti.medico_id`
- individuare record orfani o legati a utenti non practitioner
- correggere assegnazioni non valide con strategia controllata

### Deliverable

- audit `pazienti.medico_id` completo
- azzeramento pazienti senza medico valido nei tenant target

### Criterio di uscita

Ogni paziente usabile in agenda ha un dottore valido (`DENTISTA` o `DIPENDENTE`).

## Fase 4. Verifica autorizzazioni runtime e bootstrap

### Obiettivo

Confermare che il ruolo utente abbia permessi effettivi coerenti in runtime.

### Attivita

- verificare risoluzione permessi utente da RBAC
- confermare bootstrap con permessi e navigazione coerenti
- testare create user standard + login + operativita moduli

### Deliverable

- checklist permessi per profili:
  - `ADMIN`
  - `SEGRETARIO`
  - practitioner (`DENTISTA`/`DIPENDENTE`)

### Criterio di uscita

Nessun blocco `403` inatteso su pazienti/appuntamenti per ruoli autorizzati.

## Fase 5. Collaudo funzionale end-to-end

### Obiettivo

Validare che i flussi business siano nuovamente operativi.

### Attivita

Eseguire smoke test reale per tenant:

1. creazione utente da piattaforma standard
2. assegnazione dottore su nuovo paziente
3. creazione appuntamento su paziente assegnato
4. aggiornamento appuntamento (stato/data/ora)
5. verifica lettura liste pazienti e agenda senza errori

### Deliverable

- test report con esito per tenant e per ruolo
- evidenza assenza errori server nei log durante test

### Criterio di uscita

Flussi pazienti/appuntamenti operativi al 100% sui tenant verificati.

## Fase 6. Stabilizzazione e prevenzione regressioni

### Obiettivo

Ridurre rischio di ricaduta post-ripristino.

### Attivita

- consolidare runbook operativo (check + repair)
- schedulare controllo periodico consistenza RBAC tenant
- integrare in QA una suite minima obbligatoria:
  - create user standard
  - create paziente con assegnazione medico
  - create appuntamento

### Deliverable

- runbook operativo versionato
- checklist QA pre-release aggiornata

### Criterio di uscita

Esiste un processo standard che intercetta il problema prima di arrivare in produzione.

## KPI di successo

- errori 500 su `POST /api/v2/clients` = 0
- errori 500 su `POST /api/v2/appointments` = 0
- errori 403 inattesi su ruoli autorizzati = 0
- tenant con inconsistenze RBAC = 0 (perimetro target)

## Note operative

- documento intenzionalmente focalizzato su ripristino e stabilita
- nessuna modifica codice richiesta per applicare questa roadmap
- ogni fase deve chiudersi con evidenza oggettiva prima di passare alla successiva
