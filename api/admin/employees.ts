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
      const { fullName, email, position } = (req.body ?? {}) as {
        fullName?: string;
        email?: string;
        position?: string;
      };

      if (!fullName || !email) {
        return res.status(400).json({ error: "Nombre y correo son obligatorios" });
      }

      const normalizedEmail = email.trim().toLowerCase();
      const randomPassword = generateRandomPassword();
      const passwordHash = await bcrypt.hash(randomPassword, 10);

      // El código de empleado se genera solo, en orden (EMP-0001, EMP-0002, ...)
      // Reintenta unas pocas veces por si dos admins crean un empleado al mismo tiempo.
      let lastError: any = null;
      for (let attempt = 0; attempt < 5; attempt++) {
        const codesResult = await db.sql`SELECT employee_code FROM employees`;
        const maxNumber = codesResult.rows.reduce((max: number, row: any) => {
          const match = /(\d+)\s*$/.exec(row.employee_code || "");
          const num = match ? parseInt(match[1], 10) : 0;
          return Math.max(max, num);
        }, 0);
        const nextCode = `EMP-${String(maxNumber + 1).padStart(4, "0")}`;

        try {
          const result = await db.sql`
            INSERT INTO employees (employee_code, full_name, email, position, password_hash)
            VALUES (${nextCode}, ${fullName}, ${normalizedEmail}, ${position || null}, ${passwordHash})
            RETURNING employee_code, full_name, email, position
          `;

          return res.status(201).json({
            employee: result.rows[0],
            temporaryPassword: randomPassword,
          });
        } catch (error: any) {
          lastError = error;
          // Si chocó el código autogenerado (carrera entre dos creaciones), reintenta.
          // Si chocó el correo, no tiene sentido reintentar.
          if (error.code === "23505" && error.constraint?.includes("email")) {
            return res.status(409).json({ error: "Ya existe un empleado con ese correo" });
          }
          if (error.code !== "23505") throw error;
        }
      }

      throw lastError;
    } catch (error: any) {
      console.error("Error al crear empleado:", error);
      if (error.code === "23505") {
        return res.status(409).json({ error: "Ya existe un empleado con ese código o correo" });
      }
      return res.status(500).json({ error: "Error interno del servidor" });
    }
  }

  if (req.method === "DELETE") {
    try {
      const employeeCode = (req.query.employeeCode as string) || (req.body ?? {}).employeeCode;

      if (!employeeCode) {
        return res.status(400).json({ error: "Falta el código de empleado" });
      }

      const employeeResult = await db.sql`
        SELECT id FROM employees WHERE employee_code = ${employeeCode}
      `;

      if (employeeResult.rows.length === 0) {
        return res.status(404).json({ error: "Empleado no encontrado" });
      }

      const employeeId = employeeResult.rows[0].id;

      // Elimina primero las credenciales/accesos del empleado: sesiones activas
      // y magic links (enlaces de acceso de un solo uso).
      await db.sql`DELETE FROM sessions WHERE employee_id = ${employeeId}`;
      await db.sql`DELETE FROM magic_links WHERE employee_id = ${employeeId}`;

      try {
        await db.sql`DELETE FROM employees WHERE id = ${employeeId}`;
      } catch (error: any) {
        // El empleado tiene boletas asociadas (employee_id es NOT NULL en payslips)
        if (error.code === "23503") {
          return res.status(409).json({
            error: "No se puede eliminar: el empleado tiene boletas registradas. Elimina primero sus boletas.",
          });
        }
        throw error;
      }

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error("Error al eliminar empleado:", error);
      return res.status(500).json({ error: "Error interno del servidor" });
    }
  }

  return res.status(405).json({ error: "Método no permitido" });
}