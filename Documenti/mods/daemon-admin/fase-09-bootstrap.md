# DAEMON FASE 9 BOOTSTRAP HALO

Data: `04 Aprile 2026`
Stato: `completata`

## Obiettivo della fase

Permettere la creazione iniziale e la rotazione esplicita dell'account `daemon` senza seed impliciti o SQL manuale.

## Intervento applicato

E stato introdotto uno script dedicato:

- [backend/scripts/bootstrap-daemon.js](/Users/francescostrano/Desktop/HALO/backend/scripts/bootstrap-daemon.js)

ed e stato esposto come comando npm:

- `npm run bootstrap-daemon`

## Comportamento dello script

Modalita create:

- se non esistono account in `platform_accounts`, crea il primo account daemon
- se esiste gia almeno un account di piattaforma, il bootstrap viene bloccato

Modalita rotate:

- usando `--rotate`, lo script ruota in modo esplicito email e password dell'account richiesto

## Validazioni applicate

- `account_key` obbligatoria
- email valida
- password forte
- protezione contro bootstrap multipli accidentali

## Audit applicato

Lo script registra nel `platform_audit_logs`:

- `daemon.bootstrap.created`
- `daemon.bootstrap.rotated`

## Uso operativo

Creazione iniziale:

```bash
cd backend
npm run bootstrap-daemon -- --email daemon@halo.local --password 'DaemonStrong123!'
```

Rotazione esplicita:

```bash
cd backend
npm run bootstrap-daemon -- --rotate --account-key daemon --email daemon@halo.local --password 'AnotherStrong123!'
```

In alternativa:

- `DAEMON_BOOTSTRAP_EMAIL`
- `DAEMON_BOOTSTRAP_PASSWORD`

possono essere forniti tramite ambiente.

## Criteri di chiusura soddisfatti

- un ambiente nuovo puo ottenere il primo account daemon senza SQL manuale
- il bootstrap e protetto contro creazioni multiple accidentali
- esiste una procedura documentata di creazione e rotazione
