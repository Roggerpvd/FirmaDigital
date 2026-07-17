import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db } from "../lib/db";

function getCookie(req: VercelRequest, name: string): string | null {
  const cookies = req.headers.cookie;
  if (!cookies) return null;
  const match = cookies.split("; ").find((c) => c.startsWith(`${name}=`));
  return match ? match.split("=")[1] : null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  try {
    const sessionToken = getCookie(req, "session_token");

    if (!sessionToken) {
      return res.status(401).json({ error: "No autenticado" });
    }

    const sessionResult = await db.sql`
      SELECT user_type, employee_id, admin_id, expires_at 
      FROM sessions 
      WHERE token = ${sessionToken}
    `;

    if (sessionResult.rows.length === 0) {
      return res.status(401).json({ error: "Sesión inválida" });
    }

    const session = sessionResult.rows[0];

    if (new Date(session.expires_at) < new Date()) {
      return res.status(401).json({ error: "Sesión expirada" });
    }

    if (session.user_type === "admin") {
      const adminResult = await db.sql`
        SELECT id, full_name, email FROM admins WHERE id = ${session.admin_id}
      `;
      const admin = adminResult.rows[0];
      return res.status(200).json({
        role: "admin",
        fullName: admin.full_name,
        email: admin.email,
      });
    }

    if (session.user_type === "employee") {
      const employeeResult = await db.sql`
        SELECT id, employee_code, full_name, email, position FROM employees WHERE id = ${session.employee_id}
      `;
      const employee = employeeResult.rows[0];
      return res.status(200).json({
        role: "employee",
        employeeCode: employee.employee_code,
        fullName: employee.full_name,
        email: employee.email,
        position: employee.position,
      });
    }

    return res.status(401).json({ error: "Tipo de sesión desconocido" });
  } catch (error) {
    console.error("Error en /me:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
}