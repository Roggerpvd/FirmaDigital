-- Ejecutar una sola vez contra tu base de datos actual (Neon/Vercel Postgres).
-- Agrega las columnas de auditoría sin tocar los datos existentes.

ALTER TABLE payslips
  ADD COLUMN IF NOT EXISTS document_hash TEXT,
  ADD COLUMN IF NOT EXISTS signed_ip TEXT,
  ADD COLUMN IF NOT EXISTS signed_user_agent TEXT;
