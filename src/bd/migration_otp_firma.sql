-- Ejecutar una sola vez contra tu base de datos (Neon/Vercel Postgres).
-- Crea la tabla que guarda los códigos OTP de 6 dígitos usados como
-- segundo factor de autenticación al firmar una boleta.
--
-- El código NUNCA se guarda en texto plano: se guarda su hash SHA-256.
-- Cada código expira a los 5 minutos y solo puede usarse una vez.

CREATE TABLE IF NOT EXISTS signature_otp_codes (
  id SERIAL PRIMARY KEY,
  payslip_id INTEGER NOT NULL REFERENCES payslips(id),
  employee_id INTEGER NOT NULL REFERENCES employees(id),
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,     -- intentos fallidos de verificación
  used_at TIMESTAMPTZ,                     -- null hasta que se use correctamente
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_signature_otp_payslip ON signature_otp_codes(payslip_id);
CREATE INDEX IF NOT EXISTS idx_signature_otp_created ON signature_otp_codes(payslip_id, created_at);
