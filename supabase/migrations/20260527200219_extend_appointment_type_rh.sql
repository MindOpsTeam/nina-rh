-- Estende enum appointment_type com tipos de entrevista RH
-- Mantém valores legados existentes (não remove nada)

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'appointment_type' AND e.enumlabel = 'entrevista_inicial') THEN
    ALTER TYPE appointment_type ADD VALUE 'entrevista_inicial';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'appointment_type' AND e.enumlabel = 'entrevista_tecnica') THEN
    ALTER TYPE appointment_type ADD VALUE 'entrevista_tecnica';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'appointment_type' AND e.enumlabel = 'entrevista_final') THEN
    ALTER TYPE appointment_type ADD VALUE 'entrevista_final';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'appointment_type' AND e.enumlabel = 'entrevista_cultural') THEN
    ALTER TYPE appointment_type ADD VALUE 'entrevista_cultural';
  END IF;
END $$;
