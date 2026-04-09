-- Step 6 - Bonifica legacy stati pagamento Stripe su fatture pagate
-- Regola:
-- 1) Se fattura pagata ha sessione Stripe o evento paid -> stripe_status = 'paid'
-- 2) Se fattura pagata non ha evidenze Stripe -> stripe_status = 'manual'

WITH paid_candidates AS (
  SELECT f.id
  FROM fatture f
  WHERE f.stato = 'pagata'
    AND (
      f.stripe_session_id IS NOT NULL
      OR EXISTS (
        SELECT 1
        FROM fatture_pagamenti fp
        WHERE fp.fattura_id = f.id
          AND fp.event_type = 'paid'
      )
    )
)
UPDATE fatture f
SET stripe_status = 'paid'
WHERE f.id IN (SELECT id FROM paid_candidates)
  AND COALESCE(f.stripe_status, '') <> 'paid';

WITH manual_candidates AS (
  SELECT f.id
  FROM fatture f
  WHERE f.stato = 'pagata'
    AND f.stripe_session_id IS NULL
    AND NOT EXISTS (
      SELECT 1
      FROM fatture_pagamenti fp
      WHERE fp.fattura_id = f.id
        AND fp.event_type = 'paid'
    )
)
UPDATE fatture f
SET stripe_status = 'manual'
WHERE f.id IN (SELECT id FROM manual_candidates)
  AND COALESCE(f.stripe_status, '') NOT IN ('paid', 'manual');
