# DAEMON FASE 10 MFA HALO

Data: `04 Aprile 2026`
Stato: `completata`

## Obiettivo della fase

Rendere l'accesso `daemon` piu forte del semplice login password-based introducendo un secondo fattore reale.

## Intervento applicato

E stato introdotto un supporto MFA TOTP dedicato per gli account daemon.

Componenti principali:

- [backend/src/services/daemon-mfa.service.js](/Users/francescostrano/Desktop/HALO/backend/src/services/daemon-mfa.service.js)
- [backend/controllers/daemonAuthController.js](/Users/francescostrano/Desktop/HALO/backend/controllers/daemonAuthController.js)
- [backend/src/routes/daemon-auth.routes.js](/Users/francescostrano/Desktop/HALO/backend/src/routes/daemon-auth.routes.js)
- [frontend/src/app/daemon/login/page.tsx](/Users/francescostrano/Desktop/HALO/frontend/src/app/daemon/login/page.tsx)
- [frontend/src/app/daemon/console/page.tsx](/Users/francescostrano/Desktop/HALO/frontend/src/app/daemon/console/page.tsx)

## Flusso login aggiornato

Il login daemon ora funziona cosi:

1. email e password
2. se l'account ha `mfa_enabled=true`, il backend richiede secondo fattore
3. il frontend passa al secondo step e accetta:
   - codice TOTP
   - recovery code

## Setup e abilitazione MFA

Sono stati introdotti endpoint dedicati:

- `GET /api/daemon/mfa`
- `POST /api/daemon/mfa/setup`
- `POST /api/daemon/mfa/enable`
- `POST /api/daemon/mfa/disable`

La console daemon ora espone una sezione sicurezza per:

- generare setup MFA
- ottenere secret e `otpauth://`
- visualizzare recovery codes iniziali
- abilitare MFA dopo verifica del primo codice
- disabilitare MFA

## Schema dati esteso

La tabella `platform_accounts` ora supporta:

- `mfa_enabled`
- `mfa_secret_encrypted`
- `mfa_recovery_codes_json`
- `mfa_pending_secret_encrypted`
- `mfa_pending_recovery_codes_json`

## Sicurezza applicata

- secret MFA cifrato lato backend
- recovery codes hashati e consumabili una sola volta
- secondo fattore richiesto solo se MFA attivo
- setup non attivo finche non viene verificato il primo codice

## Audit applicato

Eventi introdotti o gestiti:

- `daemon.login.challenge.required`
- `daemon.login.challenge.failed`
- `daemon.login.challenge.passed`
- `daemon.mfa.setup.created`
- `daemon.mfa.enabled`
- `daemon.mfa.enable.failed`
- `daemon.mfa.disabled`

## Limiti attuali della fase

- non esiste ancora workflow avanzato di recovery amministrativo
- non esiste enforcement globale “MFA obbligatorio” via policy ambiente
- la disabilitazione MFA e protetta da sessione daemon valida, ma non richiede ancora secondo fattore dedicato

## Criteri di chiusura soddisfatti

- il sistema puo richiedere secondo fattore per `daemon`
- gli eventi MFA sono tracciati
- il flusso e usabile dalla UI daemon
