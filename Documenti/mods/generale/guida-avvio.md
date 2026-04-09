# HALO - Guida Completa Avvio Locale (Obbligatoria)

Questa guida descrive tutti i passaggi necessari per avviare HALO in locale in modo ripetibile su un nuovo PC.

## 1) Prerequisiti obbligatori

Installa e verifica:

- `Git`
- `Node.js >= 20.9.0` (consigliato LTS 22)
- `npm` (incluso con Node)
- `PostgreSQL` (server attivo in locale)
- `psql` (client CLI PostgreSQL)

Controlli rapidi:

```powershell
node -v
npm -v
psql --version
```

Porte di default usate dal progetto:

- `3000` frontend (Next.js)
- `4000` backend (Express)
- `5432` PostgreSQL

## 2) Clonazione e installazione dipendenze

Da PowerShell:

```powershell
git clone <URL_REPO_HALO>
cd HALO
```

Installa dipendenze backend:

```powershell
cd backend
npm ci
cd ..
```

Installa dipendenze frontend:

```powershell
cd frontend
npm ci
cd ..
```

## 3) Setup database PostgreSQL (obbligatorio)

### 3.1 Crea utente e database applicativo

Se non esistono gia:

```powershell
psql -U postgres -d postgres -c "CREATE ROLE halo_user WITH LOGIN PASSWORD 'halo_pwd';"
psql -U postgres -d postgres -c "CREATE DATABASE halo_db OWNER halo_user;"
```

Se ricevi errore "already exists", puoi proseguire.

### 3.2 Applica schema HALO

Dalla root del repository:

```powershell
psql "postgresql://halo_user:halo_pwd@localhost:5432/halo_db" -f database/schema.sql
```

Verifica tabelle create:

```powershell
psql "postgresql://halo_user:halo_pwd@localhost:5432/halo_db" -c "\dt"
```

## 4) Configurazione variabili ambiente backend (obbligatoria)

File richiesto: `backend/.env`

Puoi partire da `backend/.env.example`:

```powershell
Copy-Item backend\.env.example backend\.env -Force
```

Poi apri `backend/.env` e verifica almeno questi valori:

```env
NODE_ENV=development
PORT=4000
CLIENT_URL=http://localhost:3000
DATABASE_URL=postgresql://halo_user:halo_pwd@localhost:5432/halo_db
JWT_SECRET=metti_un_segreto_lungo_e_random
JWT_ACCESS_EXPIRATION=15m
JWT_REFRESH_EXPIRATION_DAYS=30
SALT_ROUNDS=10
```

Note importanti:

- `JWT_SECRET` e obbligatorio: se manca, login e API protette non funzionano.
- `SALT_ROUNDS` deve stare tra `4` e `15`.
- Le variabili Stripe sono necessarie solo se usi pagamenti Stripe (vedi sezione 9).

## 5) Configurazione variabili ambiente frontend (obbligatoria)

File richiesto: `frontend/.env.local`

Crea il file con:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000/api
```

Senza questa variabile, il frontend puo puntare a endpoint errati su altre macchine.

## 6) Avvio servizi (obbligatorio)

Apri 2 terminali separati.

Terminale 1 - backend:

```powershell
cd HALO\backend
npm run dev
```

Output atteso (simile):

- `Connessione PostgreSQL attiva.`
- `HALO backend in ascolto su http://localhost:4000`

Terminale 2 - frontend:

```powershell
cd HALO\frontend
npm run dev
```

Apri:

- `http://localhost:3000` (frontend)

## 7) Primo accesso e seed utente admin

Lo schema crea un utente admin seed con email:

- `admin@studio.com`

La password puo variare in base allo stato del DB locale.

Se non riesci a fare login, reimposta in modo esplicito la password.

### 7.1 Genera hash bcrypt per nuova password

Esempio con password `Admin123!`:

```powershell
cd HALO\backend
node -e "const bcrypt=require('bcrypt'); bcrypt.hash('Admin123!', 10).then(h=>console.log(h))"
```

### 7.2 Aggiorna password admin nel DB

Sostituisci `<HASH_GENERATO>` con l'hash ottenuto al punto precedente:

```powershell
psql "postgresql://halo_user:halo_pwd@localhost:5432/halo_db" -c "UPDATE users SET password_hash='<HASH_GENERATO>' WHERE email='admin@studio.com';"
```

Poi accedi da `http://localhost:3000/login`.

## 8) Smoke test minimo obbligatorio

Con backend avviato:

```powershell
Invoke-RestMethod http://localhost:4000/
Invoke-RestMethod http://localhost:4000/api/test
```

Risultato atteso:

- endpoint `/` risponde con stato app online
- endpoint `/api/test` risponde `ok: true`

## 9) Stripe locale (solo se vuoi testare pagamenti)

Variabili aggiuntive backend necessarie:

```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_CURRENCY=eur
STRIPE_CHECKOUT_SUCCESS_URL=http://localhost:3000/fatture?stripe=success&session_id={CHECKOUT_SESSION_ID}
STRIPE_CHECKOUT_CANCEL_URL=http://localhost:3000/fatture?stripe=cancel
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_WEBHOOK_TOLERANCE_SEC=300
```

Webhook in locale con Stripe CLI:

```powershell
stripe login
stripe listen --events checkout.session.completed,checkout.session.async_payment_succeeded,checkout.session.expired,checkout.session.async_payment_failed,payment_intent.succeeded,payment_intent.payment_failed --forward-to localhost:4000/stripe/webhook
```

Dopo aver aggiornato `STRIPE_WEBHOOK_SECRET`, riavvia il backend.

## 10) Errori tipici e cause reali

`Connessione PostgreSQL non riuscita`
- `DATABASE_URL` errata, DB non creato, Postgres non attivo.

`Configurazione autenticazione non valida`
- manca `JWT_SECRET` in `backend/.env`.

`Schema DB non aggiornato`
- non hai eseguito `database/schema.sql` sul DB giusto.

`CORS` o richieste bloccate dal browser
- `CLIENT_URL` backend non allineato con URL frontend.

Frontend non legge API corretta
- manca o e sbagliato `frontend/.env.local` con `NEXT_PUBLIC_API_BASE_URL`.

Comportamenti diversi tra PC
- versioni Node diverse, `.env` diversi, DB non allineato, porte occupate.

## 11) Checklist finale (deve essere tutta verde)

- Node `>=20.9.0`
- dipendenze installate in `backend` e `frontend`
- DB creato e schema applicato
- `backend/.env` presente e valido
- `frontend/.env.local` presente e valido
- backend avviato su `:4000`
- frontend avviato su `:3000`
- login funzionante su `/login`

Se uno solo dei punti sopra manca, HALO puo avviarsi solo parzialmente o fallire.
