import type { VercelRequest, VercelResponse } from "@vercel/node";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { db } from "../lib/db.js";

function getCookie(req: VercelRequest, name: string): string | null {
  const cookies = req.headers.cookie;
  if (!cookies) return null;
  const match = cookies.split("; ").find((c) => c.startsWith(`${name}=`));
  return match ? match.split("=")[1] : null;
}

function generateRandomPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let password = "";
  const bytes = crypto.randomBytes(10);
  for (let i = 0; i < 10; i++) {
    password += chars[bytes[i] % chars.length];
  }
  return password;
}

async function requireAdmin(req: VercelRequest): Promise<boolean> {
  const sessionToken = getCookie(req, "session_token");
  if (!sessionToken) return false;

  const sessionResult = await db.sql`
    SELECT user_type, expires_at FROM sessions WHERE token = ${sessionToken}
  `;

  if (sessionResult.rows.length === 0) return false;
  const session = sessionResult.rows[0];
  if (session.user_type !== "admin") return false;
  if (new Date(session.expires_at) < new Date()) return false;

  return true;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const isAdmin = await requireAdmin(req);
  if (!isAdmin) {
    return res.status(403).json({ error: "Acceso solo para administradores" });
  }

  if (req.method === "GET") {
    try {
      const result = await db.sql`
        SELECT employee_code, full_name, email, position, created_at 
        FROM employees 
        ORDER BY created_at DESC
      `;
      return res.status(200).json({ employees: result.rows });
    } catch (error) {
      console.error("Error al listar empleados:", error);
      return res.status(500).json({ error: "Error interno del servidor" });
    }
  }

  if (req.method === "POST") {
    try {
      const { employeeCode, fullName, email, position } = (req.body ?? {}) as {
        employeeCode?: string;
        fullName?: string;
        email?: string;
        position?: string;
      };

      if (!employeeCode || !fullName || !email) {
        return res.status(400).json({ error: "Código, nombre y correo son obligatorios" });
      }

      const normalizedEmail = email.trim().toLowerCase();
      const randomPassword = generateRandomPassword();
      const passwordHash = await bcrypt.hash(randomPassword, 10);

      const result = await db.sql`
        INSERT INTO employees (employee_code, full_name, email, position, password_hash)
        VALUES (${employeeCode}, ${fullName}, ${normalizedEmail}, ${position || null}, ${passwordHash})
        RETURNING employee_code, full_name, email, position
      `;

      return res.status(201).json({
        employee: result.rows[0],
        temporaryPassword: randomPassword,
      });
    } catch (error: any) {
      console.error("Error al crear empleado:", error);
      if (error.code === "23505") {
        return res.status(409).json({ error: "Ya existe un empleado con ese código o correo" });
      }
      return res.status(500).json({ error: "Error interno del servidor" });
    }
  }

  return res.status(405).json({ error: "Método no permitido" });
}