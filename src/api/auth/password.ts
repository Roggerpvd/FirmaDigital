// api/auth/password.ts
//
// Permite a un usuario autenticado (admin o empleado) cambiar su propia contraseña.
// Requiere la contraseña actual para confirmar identidad, y por seguridad cierra
// todas las demás sesiones activas de esa cuenta (la sesión actual queda viva).

import type { VercelRequest, VercelResponse } from "@vercel/node";
import bcrypt from "bcryptjs";
import { db } from "../_lib/db.js";

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 12;

function getCookie(req: VercelRequest, name: string): string | null {
  const cookies = req.headers.cookie;
  if (!cookies) return null;
  const match = cookies.split("; ").find((c) => c.startsWith(`${name}=`));
  return match ? match.split("=")[1] : null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  try {
    const sessionToken = getCookie(req, "session_token");
    if (!sessionToken) {
      return res.status(401).json({ error: "No autenticado" });
    }

    const sessionResult = await db.sql`
      SELECT user_type, employee_id, admin_id, expires_at FROM sessions WHERE token = ${sessionToken}
    `;

    if (sessionResult.rows.length === 0) {
      return res.status(401).json({ error: "Sesión inválida" });
    }

    const session = sessionResult.rows[0];

    if (new Date(session.expires_at) < new Date()) {
      return res.status(401).json({ error: "Sesión expirada" });
    }

    const { currentPassword, newPassword } = (req.body ?? {}) as {
      currentPassword?: string;
      newPassword?: string;
    };

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Faltan campos obligatorios" });
    }

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({ error: `La nueva contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres` });
    }

    if (newPassword.length > MAX_PASSWORD_LENGTH) {
      return res.status(400).json({ error: `La nueva contraseña no debe exceder los ${MAX_PASSWORD_LENGTH} caracteres` });
    }

    if (newPassword === currentPassword) {
      return res.status(400).json({ error: "La nueva contraseña debe ser distinta a la actual" });
    }

    const userId = session.user_type === "admin" ? session.admin_id : session.employee_id;

    if (!userId) {
      return res.status(401).json({ error: "Tipo de sesión desconocido" });
    }

    const userResult =
      session.user_type === "admin"
        ? await db.sql`SELECT password_hash FROM admins WHERE id = ${userId}`
        : await db.sql`SELECT password_hash FROM employees WHERE id = ${userId}`;

    const currentHash: string | null = userResult.rows[0]?.password_hash || null;

    if (!currentHash) {
      return res.status(400).json({ error: "Tu cuenta aún no tiene contraseña asignada. Contacta al administrador." });
    }

    const currentMatches = await bcrypt.compare(currentPassword, currentHash);
    if (!currentMatches) {
      return res.status(401).json({ error: "Tu contraseña actual es incorrecta" });
    }

    const newHash = await bcrypt.hash(newPassword, 10);

    if (session.user_type === "admin") {
      await db.sql`UPDATE admins SET password_hash = ${newHash} WHERE id = ${userId}`;
    } else {
      await db.sql`UPDATE employees SET password_hash = ${newHash} WHERE id = ${userId}`;
    }

    // Cierra todas las demás sesiones activas de esta cuenta (deja viva solo la actual).
    // Así, si alguien más tenía acceso con la contraseña vieja, queda desconectado.
    if (session.user_type === "admin") {
      await db.sql`DELETE FROM sessions WHERE admin_id = ${userId} AND token != ${sessionToken}`;
    } else {
      await db.sql`DELETE FROM sessions WHERE employee_id = ${userId} AND token != ${sessionToken}`;
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error al cambiar contraseña:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
}
