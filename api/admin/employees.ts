import type { VercelRequest, VercelResponse } from "@vercel/node";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { db } from "../_lib/db.js";
import { isValidEmail, sendCredentialsEmail } from "../_lib/email.js";

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

      // Rechaza correos con formato inválido (typos como "juan@", "juan@empresa",
      // "juan empresa.com") antes de crear la cuenta y de intentar enviarle nada.
      if (!isValidEmail(normalizedEmail)) {
        return res.status(400).json({ error: "El correo ingresado no tiene un formato válido" });
      }

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
            INSERT INTO employees (employee_code, full_name, email, position, password_hash, requires_password_change)
            VALUES (${nextCode}, ${fullName}, ${normalizedEmail}, ${position || null}, ${passwordHash}, true)
            RETURNING employee_code, full_name, email, position
          `;

          // Envía el correo y la contraseña temporal al correo real del empleado.
          // Si el envío falla (ej. Gmail SMTP caído), la cuenta igual queda creada:
          // avisamos al admin con emailSent=false para que se lo comunique a mano.
          let emailSent = true;
          let emailError: string | undefined;
          try {
            await sendCredentialsEmail({
              toEmail: normalizedEmail,
              employeeName: fullName,
              temporaryPassword: randomPassword,
            });
          } catch (err: any) {
            emailSent = false;
            emailError = err?.message || "No se pudo enviar el correo";
            console.error("Error al enviar credenciales por correo:", err);
          }

          return res.status(201).json({
            employee: result.rows[0],
            temporaryPassword: randomPassword,
            emailSent,
            emailError,
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

      // Elimina, en orden, todo lo asociado al empleado:
      // 1) códigos OTP de firma (dependen de payslips Y de employees, deben ir primero),
      // 2) sus boletas (payslips), 3) sus credenciales/accesos (sesiones y magic links),
      // 4) al final, al empleado mismo. Así queda sin acceso y sin registros.
      // (signature_otp_codes tiene FOREIGN KEY hacia payslips y employees sin CASCADE,
      // así que si no se borra primero, Postgres rechaza el DELETE de payslips/employees.)
      await db.sql`DELETE FROM signature_otp_codes WHERE employee_id = ${employeeId}`;
      await db.sql`DELETE FROM payslips WHERE employee_id = ${employeeId}`;
      await db.sql`DELETE FROM sessions WHERE employee_id = ${employeeId}`;
      await db.sql`DELETE FROM magic_links WHERE employee_id = ${employeeId}`;

      await db.sql`DELETE FROM employees WHERE id = ${employeeId}`;

      return res.status(200).json({ success: true });
    } catch (error: any) {
      console.error("Error al eliminar empleado:", error);
      if (error?.code === "23503") {
        return res.status(409).json({
          error: "No se pudo eliminar: el empleado todavía tiene registros relacionados que impiden borrarlo.",
        });
      }
      return res.status(500).json({ error: "Error interno del servidor" });
    }
  }

  if (req.method === "PATCH") {
    try {
      const { employeeCode } = (req.body ?? {}) as { employeeCode?: string };

      if (!employeeCode) {
        return res.status(400).json({ error: "Falta el código de empleado" });
      }

      const employeeResult = await db.sql`
        SELECT id, full_name, email FROM employees WHERE employee_code = ${employeeCode}
      `;

      if (employeeResult.rows.length === 0) {
        return res.status(404).json({ error: "Empleado no encontrado" });
      }

      const employee = employeeResult.rows[0];
      const randomPassword = generateRandomPassword();
      const passwordHash = await bcrypt.hash(randomPassword, 10);

      await db.sql`
        UPDATE employees SET password_hash = ${passwordHash}, requires_password_change = true WHERE id = ${employee.id}
      `;

      // Cierra todas las sesiones activas del empleado: con la contraseña vieja invalidada,
      // cualquier sesión abierta (suya o de alguien más que la tuviera) queda desconectada.
      await db.sql`DELETE FROM sessions WHERE employee_id = ${employee.id}`;

      // Igual que al crear la cuenta: le llega por correo su nueva contraseña temporal,
      // y al ingresar con ella se le pedirá obligatoriamente elegir una propia
      // (requires_password_change quedó en true arriba).
      let emailSent = true;
      let emailError: string | undefined;
      try {
        await sendCredentialsEmail({
          toEmail: employee.email,
          employeeName: employee.full_name,
          temporaryPassword: randomPassword,
          isReset: true,
        });
      } catch (err: any) {
        emailSent = false;
        emailError = err?.message || "No se pudo enviar el correo";
        console.error("Error al enviar credenciales por correo:", err);
      }

      return res.status(200).json({
        success: true,
        email: employee.email,
        fullName: employee.full_name,
        temporaryPassword: randomPassword,
        emailSent,
        emailError,
      });
    } catch (error) {
      console.error("Error al restablecer contraseña de empleado:", error);
      return res.status(500).json({ error: "Error interno del servidor" });
    }
  }

  return res.status(405).json({ error: "Método no permitido" });
}