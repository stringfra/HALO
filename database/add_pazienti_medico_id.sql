ALTER TABLE pazienti
ADD COLUMN IF NOT EXISTS medico_id BIGINT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_pazienti_medico_id'
      AND conrelid = 'pazienti'::regclass
  ) THEN
    ALTER TABLE pazienti
    ADD CONSTRAINT fk_pazienti_medico_id
    FOREIGN KEY (medico_id) REFERENCES users(id) ON DELETE RESTRICT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_pazienti_medico_id
  ON pazienti (medico_id);
