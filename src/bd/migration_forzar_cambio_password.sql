-- Ejecutar una sola vez contra tu base de datos (Neon/Vercel Postgres).
--
-- Objetivo: que ningún empleado pueda decir en un juicio "el administrador
-- creó mi clave y firmó por mí". Mientras este flag esté en TRUE, el empleado
-- puede iniciar sesión con la contraseña temporal, pero no puede pedir un
-- código OTP ni firmar ninguna boleta hasta que establezca su propia
-- contraseña secreta.

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS requires_password_change BOOLEAN NOT NULL DEFAULT false;

-- Los empleados que ya tenían contraseña asignada antes de esta migración
-- no se ven afectados (quedan en false, sin bloqueo retroactivo).
