// api/auth/login.ts

import type { VercelRequest, VercelResponse } from "@vercel/node";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { db } from "../_lib/db.js";

const ADMIN_SESSION_HOURS = 24 * 7;
const EMPLOYEE_SESSION_HOURS = 24 * 7;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;
const ATTEMPT_WINDOW_MINUTES = 15;

function generateToken() {
  return crypto.randomBytes(32).toString("hex");
}

/** Revisa si este correo está bloqueado por demasiados intentos fallidos. Devuelve minutos restantes, o null si no está bloqueado. */
async function checkLockout(identifier: string): Promise<number | null> {
  const result = await db.sql`
    SELECT locked_until FROM login_attempts WHERE identifier = ${identifier}
  `;
  if (result.rows.length === 0) return null;

  const lockedUntil = result.rows[0].locked_until;
  if (!lockedUntil) return null;

  const remainingMs = new Date(lockedUntil).getTime() - Date.now();
  if (remainingMs <= 0) return null;

  return Math.ceil(remainingMs / 60000);
}

/** Registra un intento fallido; si supera el máximo dentro de la ventana, bloquea el correo. */
async function registerFailedAttempt(identifier: string): Promise<void> {
  const windowStart = new Date(Date.now() - ATTEMPT_WINDOW_MINUTES * 60 * 1000);

  const existing = await db.sql`
    SELECT attempt_count, first_attempt_at FROM login_attempts WHERE identifier = ${identifier}
  `;

  if (existing.rows.length === 0 || new Date(existing.rows[0].first_attempt_at) < windowStart) {
    // No hay registro, o el registro anterior ya expiró: empezamos de cero.
    await db.sql`
      INSERT INTO login_attempts (identifier, attempt_count, first_attempt_at, locked_until)
      VALUES (${identifier}, 1, now(), NULL)
      ON CONFLICT (identifier) DO UPDATE SET attempt_count = 1, first_attempt_at = now(), locked_until = NULL
    `;
    return;
  }

  const newCount = existing.rows[0].attempt_count + 1;
  const lockedUntil = newCount >= MAX_LOGIN_ATTEMPTS
    ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000).toISOString()
    : null;

  await db.sql`
    UPDATE login_attempts SET attempt_count = ${newCount}, locked_until = ${lockedUntil}
    WHERE identifier = ${identifier}
  `;
}

/** Limpia los intentos fallidos tras un login exitoso. */
async function clearFailedAttempts(identifier: string): Promise<void> {
  await db.sql`DELETE FROM login_attempts WHERE identifier = ${identifier}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  try {
    const { email, password } = (req.body ?? {}) as { email?: string; password?: string };

    if (!email || typeof email !== "string") {
      return res.status(400).json({ error: "Correo requerido" });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Si este correo tiene demasiados intentos fallidos recientes, lo bloqueamos temporalmente.
    const lockedMinutes = await checkLockout(normalizedEmail);
    if (lockedMinutes !== null) {
      return res.status(429).json({
        error: `Demasiados intentos fallidos. Intenta de nuevo en ${lockedMinutes} minuto${lockedMinutes === 1 ? "" : "s"}.`,
      });
    }

    // 1. ¿Es un admin?
    const adminResult = await db.sql`
      SELECT id, full_name, email, password_hash FROM admins WHERE email = ${normalizedEmail}
    `;

    if (adminResult.rows.length > 0) {
      const admin = adminResult.rows[0];

      if (!password) {
        return res.status(200).json({ requiresPassword: true });
      }

      const passwordMatches = await bcrypt.compare(password, admin.password_hash);
      if (!passwordMatches) {
        await registerFailedAttempt(normalizedEmail);
        return res.status(401).json({ error: "Correo o contraseña incorrectos" });
      }

      await clearFailedAttempts(normalizedEmail);

      const sessionToken = generateToken();
      const expiresAt = new Date(Date.now() + ADMIN_SESSION_HOURS * 60 * 60 * 1000);

      await db.sql`
        INSERT INTO sessions (token, user_type, admin_id, expires_at)
        VALUES (${sessionToken}, 'admin', ${admin.id}, ${expiresAt.toISOString()})
      `;

      res.setHeader(
        "Set-Cookie",
        `session_token=${sessionToken}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${ADMIN_SESSION_HOURS * 60 * 60}`
      );

      return res.status(200).json({ success: true, role: "admin", fullName: admin.full_name });
    }

    // 2. ¿Es un empleado?
    const employeeResult = await db.sql`
      SELECT id, full_name, email, password_hash FROM employees WHERE email = ${normalizedEmail}
    `;

    if (employeeResult.rows.length > 0) {
      const employee = employeeResult.rows[0];

      if (!employee.password_hash) {
        return res.status(403).json({ error: "Tu cuenta aún no tiene contraseña asignada. Contacta al administrador." });
      }

      if (!password) {
        return res.status(200).json({ requiresPassword: true });
      }

      const passwordMatches = await bcrypt.compare(password, employee.password_hash);
      if (!passwordMatches) {
        await registerFailedAttempt(normalizedEmail);
        return res.status(401).json({ error: "Correo o contraseña incorrectos" });
      }

      await clearFailedAttempts(normalizedEmail);

      const sessionToken = generateToken();
      const expiresAt = new Date(Date.now() + EMPLOYEE_SESSION_HOURS * 60 * 60 * 1000);

      await db.sql`
        INSERT INTO sessions (token, user_type, employee_id, expires_at)
        VALUES (${sessionToken}, 'employee', ${employee.id}, ${expiresAt.toISOString()})
      `;

      res.setHeader(
        "Set-Cookie",
        `session_token=${sessionToken}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${EMPLOYEE_SESSION_HOURS * 60 * 60}`
      );

      return res.status(200).json({ success: true, role: "employee", fullName: employee.full_name });
    }

    // 3. No existe en ninguna tabla
    if (password) {
      await registerFailedAttempt(normalizedEmail);
    }
    return res.status(401).json({ error: "No encontramos una cuenta con ese correo" });
  } catch (error) {
    console.error("Error en login:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
}