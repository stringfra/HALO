# RUNBOOK - DEPLOY & ROLLBACK STRIPE (HALO)

Versione: `v1`  
Data: `01 Aprile 2026`  
Ambito: integrazione Stripe pagamenti fatture (`popup`, `stripe-link`, `webhook`, `storico eventi`)

## 1) Prerequisiti release
- Branch/commit applicativo validato in staging.
- Backup DB disponibile e verificato.
- Credenziali Stripe produzione disponibili:
  - `STRIPE_SECRET_KEY`
  - `STRIPE_WEBHOOK_SECRET`
- URL pubblico backend raggiungibile da Stripe:
  - `https://<backend-domain>/stripe/webhook`

## 2) Oggetti impattati
- Backend:
  - `backend/src/routes/fatture.routes.js`
  - `backend/src/routes/stripe.routes.js`
  - `backend/src/services/fatture-pagamenti.service.js`
  - `backend/src/server.js`
- Frontend:
  - `frontend/src/features/fatture/fatture-creator.tsx`
  - `frontend/src/features/fatture/api.ts`
  - `frontend/src/components/feedback/confirm-dialog.tsx`
- Database:
  - `database/schema.sql`
  - nuove colonne Stripe su `fatture`
  - nuova tabella `fatture_pagamenti`

## 3) Deploy (ordine consigliato)
1. Attivare maintenance window breve (consigliato).
2. Eseguire backup DB.
3. Deploy codice backend/frontend della release.
4. Applicare schema DB:
```bash
psql "$DATABASE_URL" -f database/schema.sql
```
5. Impostare variabili ambiente backend:
```env
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_CURRENCY=eur
STRIPE_CHECKOUT_SUCCESS_URL=https://<frontend-domain>/fatture?stripe=success&session_id={CHECKOUT_SESSION_ID}
STRIPE_CHECKOUT_CANCEL_URL=https://<frontend-domain>/fatture?stripe=cancel
STRIPE_WEBHOOK_SECRET=whsec_live_xxx
STRIPE_WEBHOOK_TOLERANCE_SEC=300
```
6. Riavviare backend.
7. Configurare endpoint webhook in Stripe Dashboard:
- URL: `https://<backend-domain>/stripe/webhook`
- Eventi minimi:
  - `checkout.session.completed`
  - `checkout.session.async_payment_succeeded`
  - `checkout.session.expired`
  - `checkout.session.async_payment_failed`
  - `payment_intent.succeeded`
  - `payment_intent.payment_failed`
8. Eseguire smoke test rapido:
- creare fattura `da_pagare`;
- cliccare `Genera link`;
- verificare link in UI;
- completare pagamento test;
- verificare fattura `pagata`.

## 4) Validazione post-deploy
1. API:
- `POST /fatture/:id/stripe-link` restituisce sessione/url.
- `POST /stripe/webhook` risponde `200` per eventi validi.
2. DB:
- `fatture` aggiorna `stripe_status` e `stato`.
- `fatture_pagamenti` registra eventi.
3. UI:
- colonna `Pagamento Stripe` visibile e coerente.
- azioni `Apri` / `Copia link` funzionanti.

Query verifica rapida:
```bash
psql "$DATABASE_URL" -f database/stripe_quick_audit.sql
```

## 5) Rollback (soft - consigliato)
Obiettivo: fermare nuovo traffico Stripe senza rollback distruttivo DB.

1. In Stripe Dashboard, disabilitare endpoint webhook o rimuovere eventi.
2. Rimuovere/invalidare `STRIPE_SECRET_KEY` e `STRIPE_WEBHOOK_SECRET` su backend.
3. Riavviare backend.
4. (Opzionale) rollback codice applicativo alla release precedente.

Effetto:
- nessuna nuova generazione link Stripe;
- dati storici e colonne DB restano intatti (rollback reversibile).

## 6) Rollback hard DB (solo emergenza)
Usare solo se richiesto esplicitamente e dopo backup completo.

```sql
DROP INDEX IF EXISTS idx_fatture_stripe_session_id_unique;
DROP INDEX IF EXISTS idx_fatture_pagamenti_created_at;
DROP INDEX IF EXISTS idx_fatture_pagamenti_fattura_id;
DROP INDEX IF EXISTS idx_fatture_pagamenti_studio_id;

DROP TABLE IF EXISTS fatture_pagamenti;

ALTER TABLE fatture DROP COLUMN IF EXISTS stripe_generated_at;
ALTER TABLE fatture DROP COLUMN IF EXISTS stripe_status;
ALTER TABLE fatture DROP COLUMN IF EXISTS stripe_payment_link;
ALTER TABLE fatture DROP COLUMN IF EXISTS stripe_session_id;
```

Nota:
- rollback hard elimina storico eventi Stripe e metadati link.

## 7) Criteri di Go/No-Go
Go:
- smoke test completo PASS;
- webhook validato;
- audit SQL senza incoerenze critiche.

No-Go:
- errore firma webhook persistente;
- fatture non aggiornate a `pagata` dopo pagamento confermato;
- errori DB su colonne/tabella Stripe.
