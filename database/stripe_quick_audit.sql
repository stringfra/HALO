-- HALO - Stripe Quick Audit
-- Esecuzione: psql "$DATABASE_URL" -f database/stripe_quick_audit.sql

-- 1) Snapshot ultime fatture con campi Stripe
SELECT
  f.id,
  f.studio_id,
  f.paziente_id,
  f.importo,
  f.stato,
  f.stripe_status,
  f.stripe_session_id,
  f.stripe_generated_at
FROM fatture f
ORDER BY f.id DESC
LIMIT 50;

-- 2) Conteggio fatture per stato pagamento gestionale
SELECT
  f.stato,
  COUNT(*) AS totale
FROM fatture f
GROUP BY f.stato
ORDER BY f.stato;

-- 3) Conteggio fatture per stato Stripe
SELECT
  COALESCE(NULLIF(TRIM(f.stripe_status), ''), 'NULL_OR_EMPTY') AS stripe_status,
  COUNT(*) AS totale
FROM fatture f
GROUP BY COALESCE(NULLIF(TRIM(f.stripe_status), ''), 'NULL_OR_EMPTY')
ORDER BY stripe_status;

-- 4) Storico eventi: volumi per tipo/stato
SELECT
  fp.event_type,
  COALESCE(NULLIF(TRIM(fp.stripe_status), ''), 'NULL_OR_EMPTY') AS stripe_status,
  COUNT(*) AS totale
FROM fatture_pagamenti fp
GROUP BY
  fp.event_type,
  COALESCE(NULLIF(TRIM(fp.stripe_status), ''), 'NULL_OR_EMPTY')
ORDER BY fp.event_type, stripe_status;

-- 5) Ultimo evento per fattura
WITH ranked AS (
  SELECT
    fp.*,
    ROW_NUMBER() OVER (PARTITION BY fp.fattura_id ORDER BY fp.created_at DESC, fp.id DESC) AS rn
  FROM fatture_pagamenti fp
)
SELECT
  r.fattura_id,
  r.event_type AS last_event_type,
  r.stripe_status AS last_stripe_status,
  r.created_at AS last_event_at
FROM ranked r
WHERE r.rn = 1
ORDER BY r.fattura_id DESC
LIMIT 100;

-- 6) Coerenza: fatture pagate ma senza stato Stripe paid
SELECT
  f.id,
  f.stato,
  f.stripe_status,
  f.stripe_session_id
FROM fatture f
WHERE f.stato = 'pagata'
  AND COALESCE(f.stripe_status, '') NOT IN ('paid', 'manual')
ORDER BY f.id DESC;

-- 7) Coerenza: fatture da_pagare ma con stato Stripe paid
SELECT
  f.id,
  f.stato,
  f.stripe_status,
  f.stripe_session_id
FROM fatture f
WHERE f.stato = 'da_pagare'
  AND f.stripe_status = 'paid'
ORDER BY f.id DESC;

-- 8) Coerenza: eventi paid senza fattura pagata
SELECT
  fp.fattura_id,
  f.stato,
  MAX(fp.created_at) AS last_paid_event_at
FROM fatture_pagamenti fp
JOIN fatture f ON f.id = fp.fattura_id
WHERE fp.event_type = 'paid'
GROUP BY fp.fattura_id, f.stato
HAVING f.stato <> 'pagata'
ORDER BY last_paid_event_at DESC;

-- 9) Coerenza: session id duplicata nello storico eventi
SELECT
  fp.stripe_session_id,
  COUNT(*) AS totale
FROM fatture_pagamenti fp
WHERE fp.stripe_session_id IS NOT NULL
GROUP BY fp.stripe_session_id
HAVING COUNT(*) > 1
ORDER BY totale DESC, fp.stripe_session_id;

-- 10) Eventi recenti (debug webhook)
SELECT
  fp.id,
  fp.fattura_id,
  fp.stripe_session_id,
  fp.event_type,
  fp.stripe_status,
  fp.created_at
FROM fatture_pagamenti fp
ORDER BY fp.created_at DESC, fp.id DESC
LIMIT 100;
