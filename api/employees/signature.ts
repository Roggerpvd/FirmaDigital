import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db } from "../lib/db.js";

function getCookie(req: VercelRequest, name: string): string | null {
  const cookies = req.headers.cookie;
  if (!cookies) return null;
  const match = cookies.split("; ").find((c) => c.startsWith(`${name}=`));
  return match ? match.split("=")[1] : null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const sessionToken = getCookie(req, "session_token");
    if (!sessionToken) {
      return res.status(401).json({ error: "No autenticado" });
    }

    const sessionResult = await db.sql`
      SELECT user_type, employee_id, expires_at FROM sessions WHERE token = ${sessionToken}
    `;

    if (sessionResult.rows.length === 0) {
      return res.status(401).json({ error: "Sesión inválida" });
    }

    const session = sessionResult.rows[0];

    if (session.user_type !== "employee") {
      return res.status(403).json({ error: "Solo empleados pueden gestionar su firma" });
    }

    if (new Date(session.expires_at) < new Date()) {
      return res.status(401).json({ error: "Sesión expirada" });
    }

    if (req.method === "GET") {
      const result = await db.sql`
        SELECT signature_data_url FROM employees WHERE id = ${session.employee_id}
      `;
      return res.status(200).json({ signatureDataUrl: result.rows[0]?.signature_data_url || null });
    }

    if (req.method === "POST") {
      const { signatureDataUrl } = (req.body ?? {}) as { signatureDataUrl?: string };

      if (!signatureDataUrl) {
        return res.status(400).json({ error: "Falta la imagen de la firma" });
      }

      await db.sql`
        UPDATE employees SET signature_data_url = ${signatureDataUrl} WHERE id = ${session.employee_id}
      `;

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: "Método no permitido" });
  } catch (error) {
    console.error("Error en /employees/signature:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
}