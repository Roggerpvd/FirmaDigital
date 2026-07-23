-- Empleados (se autentican por magic link, no tienen contraseña)
CREATE TABLE employees (
  id SERIAL PRIMARY KEY,
  employee_code TEXT UNIQUE NOT NULL,      -- ej. "EMP-0142"
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  position TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Admins (login propio con usuario/contraseña)
CREATE TABLE admins (
  id SERIAL PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,             -- nunca guardamos la contraseña en texto plano
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Boletas de pago
CREATE TABLE payslips (
  id SERIAL PRIMARY KEY,
  payslip_code TEXT UNIQUE NOT NULL,       -- ej. "BP-2026-014"
  employee_id INTEGER NOT NULL REFERENCES employees(id),
  period TEXT NOT NULL,                    -- ej. "Julio 2026"
  net_amount NUMERIC(10, 2) NOT NULL,
  issue_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'signed')),
  signature_data_url TEXT,                 -- la firma dibujada/subida, en base64
  pdf_url TEXT,                            -- PDF original subido por el admin (Vercel Blob)
  signed_pdf_url TEXT,                     -- PDF ya firmado, con la firma incrustada (Vercel Blob)
  signed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Magic links (tokens de un solo uso para el login de empleados)
CREATE TABLE magic_links (
  id SERIAL PRIMARY KEY,
  token TEXT UNIQUE NOT NULL,
  employee_id INTEGER NOT NULL REFERENCES employees(id),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,                     -- null hasta que se use; luego no se puede reusar
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Sesiones activas (tanto de empleados como de admins)
CREATE TABLE sessions (
  id SERIAL PRIMARY KEY,
  token TEXT UNIQUE NOT NULL,
  user_type TEXT NOT NULL CHECK (user_type IN ('employee', 'admin')),
  employee_id INTEGER REFERENCES employees(id),
  admin_id INTEGER REFERENCES admins(id),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Control de intentos de login fallidos, para bloquear ataques de fuerza bruta.
-- Se lleva por correo normalizado; se resetea cuando el login es exitoso.
CREATE TABLE login_attempts (
  identifier TEXT PRIMARY KEY,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  first_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_until TIMESTAMPTZ
);

-- Índices útiles para las búsquedas más comunes
CREATE INDEX idx_payslips_employee ON payslips(employee_id);
CREATE INDEX idx_magic_links_token ON magic_links(token);
CREATE INDEX idx_sessions_token ON sessions(token);