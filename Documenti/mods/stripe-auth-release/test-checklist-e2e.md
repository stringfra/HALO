# TEST CHECKLIST - STRIPE PAGAMENTI FATTURE (HALO)

Versione checklist: `v1`  
Data: `01 Aprile 2026`

## Prerequisiti
- Backend avviato (`backend`): `npm run dev`
- Frontend avviato (`frontend`): `npm run dev`
- DB aggiornato con `database/schema.sql`
- Variabili backend valorizzate:
  - `STRIPE_SECRET_KEY`
  - `STRIPE_WEBHOOK_SECRET`
  - `STRIPE_CURRENCY` (consigliato `eur`)
  - `STRIPE_CHECKOUT_SUCCESS_URL`
  - `STRIPE_CHECKOUT_CANCEL_URL`
- Utente con ruolo `ADMIN` o `SEGRETARIO`

## 1) Avvio webhook locale con Stripe CLI
1. Login CLI:
```bash
stripe login
```
2. Avvio listener e forward al backend locale:
```bash
stripe listen \
  --events checkout.session.completed,checkout.session.async_payment_succeeded,checkout.session.expired,checkout.session.async_payment_failed,payment_intent.succeeded,payment_intent.payment_failed \
  --forward-to localhost:4000/stripe/webhook
```
3. Copiare il secret mostrato da Stripe CLI (`whsec_...`) in `STRIPE_WEBHOOK_SECRET`.
4. Riavviare backend dopo update env.

## 2) Caso base: creazione fattura + popup
1. Aprire pagina `Fatture`.
2. Creare nuova fattura con stato `Da pagare`.
3. Atteso:
- messaggio di salvataggio OK.
- popup: `Generare link di pagamento Stripe?`.
- bottoni: `Genera link` / `Non ora`.

## 3) Caso `Non ora` (FR-03)
1. Nel popup cliccare `Non ora`.
2. Atteso:
- nessuna sessione Stripe creata.
- in tabella fatture: colonna `Pagamento Stripe` con stato `Non generato`.

## 4) Caso `Genera link` (FR-02, FR-04)
1. Creare una nuova fattura `Da pagare`.
2. Nel popup cliccare `Genera link`.
3. Atteso:
- messaggio `Sessione Stripe creata...` o `Link Stripe gia presente...`.
- in tabella fatture stato Stripe `Link attivo`.
- pulsanti `Apri` e `Copia link` disponibili.

## 5) Pagamento completato (FR-05)
1. Cliccare `Apri` sul link Stripe.
2. Completare pagamento con carta test Stripe (esempio `4242 4242 4242 4242`).
3. Atteso:
- webhook ricevuto con `200`.
- fattura aggiornata a `Pagata`.
- stato Stripe aggiornato a `Pagata`/`Pagato`.

## 6) Blocco generazione su fattura pagata (FR-06)
1. Tentare `POST /fatture/:id/stripe-link` su fattura gia `pagata` (via UI o API).
2. Atteso:
- risposta `409`.
- messaggio: link generabile solo per fatture `da_pagare`.

## 7) Storico eventi minimo (FR-07)
1. Eseguire query SQL:
```sql
SELECT id, fattura_id, stripe_session_id, event_type, stripe_status, created_at
FROM fatture_pagamenti
ORDER BY created_at DESC
LIMIT 50;
```
2. Atteso:
- presenza eventi `generated`, `paid` per il flusso positivo.
- presenza `failed` in caso errore Stripe.
- presenza `expired` quando una sessione viene fatta scadere.

## 8) Test scadenza link (`expired`)
1. Recuperare `stripe_session_id` da DB:
```sql
SELECT id, stripe_session_id
FROM fatture
WHERE stripe_session_id IS NOT NULL
ORDER BY id DESC
LIMIT 1;
```
2. Da CLI Stripe, forzare scadenza sessione:
```bash
stripe checkout sessions expire <STRIPE_SESSION_ID>
```
3. Atteso:
- webhook `checkout.session.expired` ricevuto.
- `fatture.stripe_status = 'expired'`.
- evento `expired` in `fatture_pagamenti`.

## 9) Test errore pagamento (`failed`)
1. Creare nuova fattura `da_pagare` e generare link.
2. Aprire checkout e usare carta test di fallimento (esempio `4000 0000 0000 9995`).
3. Atteso:
- webhook di fallimento ricevuto.
- `fatture.stripe_status = 'failed'`.
- evento `failed` in `fatture_pagamenti`.

## 10) Retry webhook senza duplicati (Acceptance #6)
1. In Stripe Dashboard, aprire un evento gia inviato e usare `Resend`.
2. Atteso:
- endpoint risponde `200`.
- stato fattura resta coerente (`pagata` una sola volta).
- viene aggiunto solo il record storico evento webhook, senza regressioni su `fatture`.

## 11) Query rapide di verifica finale
```sql
SELECT id, stato, stripe_status, stripe_session_id, stripe_generated_at
FROM fatture
ORDER BY id DESC
LIMIT 20;
```

```sql
SELECT event_type, stripe_status, COUNT(*) AS totale
FROM fatture_pagamenti
GROUP BY event_type, stripe_status
ORDER BY event_type, stripe_status;
```

## 12) Audit rapido unico (script)
1. Eseguire:
```bash
psql "$DATABASE_URL" -f database/stripe_quick_audit.sql
```
2. Script disponibile in:
- `database/stripe_quick_audit.sql`

## Esito finale atteso
- Flusso popup post-salvataggio funzionante.
- Link Stripe generato solo per fatture `da_pagare`.
- Webhook con firma valida obbligatoria.
- Stato fattura aggiornato automaticamente a `pagata` a pagamento confermato.
- Storico eventi disponibile e consultabile in DB.
