-- Backfill di pazienti.medico_id a partire dagli appuntamenti storici.
-- Aggiorna solo i pazienti con una corrispondenza univoca e sicura:
-- 1. stesso studio;
-- 2. utente con ruolo DENTISTA;
-- 3. un solo dentista riconosciuto per paziente.

WITH matched_doctors AS (
  SELECT
    p.id AS paziente_id,
    p.studio_id,
    u.id AS medico_id
  FROM pazienti p
  JOIN appuntamenti a
    ON a.paziente_id = p.id
   AND a.studio_id = p.studio_id
  JOIN users u
    ON u.studio_id = p.studio_id
   AND u.ruolo = 'DENTISTA'
   AND LOWER(BTRIM(a.medico)) = LOWER(BTRIM(u.nome))
  WHERE p.medico_id IS NULL
),
unique_matches AS (
  SELECT
    paziente_id,
    MIN(medico_id) AS medico_id
  FROM matched_doctors
  GROUP BY paziente_id
  HAVING COUNT(DISTINCT medico_id) = 1
)
UPDATE pazienti p
SET medico_id = um.medico_id
FROM unique_matches um
WHERE p.id = um.paziente_id
  AND p.medico_id IS NULL;

-- Report 1: pazienti ancora senza medico assegnato dopo il backfill.
SELECT
  p.id,
  p.studio_id,
  p.nome,
  p.cognome
FROM pazienti p
WHERE p.medico_id IS NULL
ORDER BY p.studio_id, p.id;

-- Report 2: pazienti con match ambiguo su piu dentisti.
WITH matched_doctors AS (
  SELECT
    p.id AS paziente_id,
    p.studio_id,
    p.nome,
    p.cognome,
    u.id AS medico_id,
    u.nome AS medico_nome
  FROM pazienti p
  JOIN appuntamenti a
    ON a.paziente_id = p.id
   AND a.studio_id = p.studio_id
  JOIN users u
    ON u.studio_id = p.studio_id
   AND u.ruolo = 'DENTISTA'
   AND LOWER(BTRIM(a.medico)) = LOWER(BTRIM(u.nome))
  WHERE p.medico_id IS NULL
)
SELECT
  paziente_id,
  studio_id,
  nome,
  cognome,
  COUNT(DISTINCT medico_id) AS matched_dentists,
  STRING_AGG(DISTINCT CONCAT(medico_nome, ' (#', medico_id, ')'), ', ' ORDER BY CONCAT(medico_nome, ' (#', medico_id, ')')) AS candidate_dentists
FROM matched_doctors
GROUP BY paziente_id, studio_id, nome, cognome
HAVING COUNT(DISTINCT medico_id) > 1
ORDER BY studio_id, paziente_id;
