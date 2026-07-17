// api/auth/login.ts

import type { VercelRequest, VercelResponse } from "@vercel/node";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { db } from "../lib/db";

const ADMIN_SESSION_HOURS = 24 * 7;
const EMPLOYEE_SESSION_HOURS = 24 * 7;

function generateToken() {
  return crypto.randomBytes(32).toString("hex");
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
        return res.status(401).json({ error: "Correo o contraseña incorrectos" });
      }

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
        return res.status(401).json({ error: "Correo o contraseña incorrectos" });
      }

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
    return res.status(401).json({ error: "No encontramos una cuenta con ese correo" });
  } catch (error) {
    console.error("Error en login:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
}