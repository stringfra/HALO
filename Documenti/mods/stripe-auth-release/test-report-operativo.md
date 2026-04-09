# TEST REPORT - STRIPE OPERATIVO (HALO)

Data: `01 Aprile 2026`  
Ambito: chiusura Passaggio 4 (`collaudo E2E + audit SQL`)

## Ambiente
- Backend avviato localmente su `http://localhost:4000`
- DB: `halo_db` (via `DATABASE_URL` da `backend/.env`)
- Webhook secret configurato in `backend/.env`

## Smoke test eseguito
Scenario API automatizzato:
1. Login `admin@studio.com`
2. Creazione paziente test
3. Creazione fattura `da_pagare`
4. Generazione link Stripe (`POST /fatture/:id/stripe-link`)
5. Invio webhook firmato simulato `checkout.session.completed`
6. Verifica aggiornamento fattura via API + DB

Esito:
- `SMOKE_STRIPE_OK`
- Fattura test aggiornata a `pagata`
- `stripe_status = paid`
- `stripe_session_id` e `stripe_payment_link` presenti

## Audit DB (query di consistenza)
- Eventi in `fatture_pagamenti`:
  - `paid`: `1`
- Incoerenze `fatture`:
  - `stato='pagata'` ma `stripe_status<>'paid'`: `2`
  - `stato='da_pagare'` con `stripe_status='paid'`: `0`
- Fatture con link Stripe valorizzato: `5`

## Nota rilevata
- Nel test automatico appena eseguito è stato registrato evento storico `paid`, ma non è comparso `generated` per la stessa fattura.
- Da verificare con un controllo mirato del flusso `POST /fatture/:id/stripe-link` in ambiente di test.

## Conclusione Passaggio 4
- Stato: `completato con attenzione`
- Funzionalità core verificate:
  - creazione link Stripe
  - aggiornamento fattura via webhook firmato
  - persistenza dati Stripe su fattura
- Follow-up consigliato:
  - validare il tracciamento evento `generated`
  - analizzare le 2 fatture storiche `pagata` senza `stripe_status='paid'`
