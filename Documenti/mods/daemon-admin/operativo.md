# Guida Rapida Sezione Daemon

## Cos'e'

`daemon` e' l'identita tecnica di piattaforma separata dagli utenti tenant.

Non usa la login standard del gestionale e non legge le credenziali direttamente dal `.env` in fase di accesso.

## Dove si accede

- frontend: `/daemon/login`
- console: `/daemon/console`
- API: `/api/daemon/*`

## Credenziali: regola importante

Il login `daemon` legge l'account dal database tabella `platform_accounts`.

Le variabili `.env`:

- `DAEMON_BOOTSTRAP_USERNAME`
- `DAEMON_BOOTSTRAP_PASSWORD`

servono solo per:

- bootstrap iniziale
- rotazione password

Non bastano da sole per fare login se l'account non e' stato creato o aggiornato nel DB.

## Credenziali attuali configurate nel backend

Nel file `backend/.env` sono previsti:

- username: `daemon`
- password bootstrap: `ChangeThisDaemonPassword123!`

## Primo bootstrap account daemon

Da eseguire una sola volta se non esiste ancora alcun account di piattaforma:

```bash
cd /Users/francescostrano/Desktop/HALO/backend
npm run bootstrap-daemon
```

Questo crea l'account usando:

- `DAEMON_BOOTSTRAP_USERNAME`
- `DAEMON_BOOTSTRAP_PASSWORD`

L'email tecnica viene generata automaticamente come:

- `<username>@daemon.local`

## Rotazione password daemon

Se l'account esiste gia' e vuoi riallinearlo ai valori del `.env`:

```bash
cd /Users/francescostrano/Desktop/HALO/backend
npm run bootstrap-daemon -- --rotate --username daemon
```

## Login corretto

Usare:

- username: `daemon`
- password: `ChangeThisDaemonPassword123!`

Non usare l'email.

## Se il login fallisce

Controllare in questo ordine:

1. l'account e' stato bootstrapato oppure no
2. la password e' stata ruotata dopo aver cambiato il `.env`
3. stai usando `username` e non email
4. MFA attivo: dopo username/password serve TOTP o recovery code
5. policy ambiente: in produzione la console puo' essere bloccata se `DAEMON_CONSOLE_ENABLED` non e' attivo
6. allowlist IP: se configurata, l'IP deve essere consentito

## MFA daemon

La MFA si gestisce dalla console `daemon`.

Flusso:

1. login con username/password
2. apri sezione sicurezza
3. genera setup MFA
4. salva secret e recovery codes
5. abilita MFA con il primo codice TOTP

Se MFA e' attiva, il login richiede sempre:

- codice TOTP
  oppure
- recovery code

## Operazioni principali in console

La console `daemon` permette di:

- leggere overview piattaforma
- gestire tenant config e feature flags
- creare, aggiornare ed eliminare utenti tenant
- gestire ruoli, permessi e assegnazioni tenant
- vedere audit classificato
- usare strumenti di supporto tecnico RBAC

## Regole operative

- tutte le scritture critiche richiedono conferma forte
- le operazioni daemon sono auditabili
- `daemon` non sostituisce gli utenti tenant
- non usare endpoint tenant standard per operazioni di piattaforma

## Comandi utili

Bootstrap iniziale:

```bash
cd /Users/francescostrano/Desktop/HALO/backend
npm run bootstrap-daemon
```

Rotazione credenziali:

```bash
cd /Users/francescostrano/Desktop/HALO/backend
npm run bootstrap-daemon -- --rotate --username daemon
```

Avvio backend:

```bash
cd /Users/francescostrano/Desktop/HALO/backend
npm run dev
```

Avvio frontend:

```bash
cd /Users/francescostrano/Desktop/HALO/frontend
npm run dev
```
