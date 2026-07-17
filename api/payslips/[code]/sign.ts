import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db } from "../../lib/db.js";

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
      SELECT user_type, employee_id, expires_at FROM sessions WHERE token = ${sessionToken}
    `;

    if (sessionResult.rows.length === 0) {
      return res.status(401).json({ error: "Sesión inválida" });
    }

    const session = sessionResult.rows[0];

    if (session.user_type !== "employee") {
      return res.status(403).json({ error: "Solo empleados pueden firmar boletas" });
    }

    if (new Date(session.expires_at) < new Date()) {
      return res.status(401).json({ error: "Sesión expirada" });
    }

    const { code } = req.query as { code?: string };
    const { signatureDataUrl } = (req.body ?? {}) as { signatureDataUrl?: string };

    if (!code) {
      return res.status(400).json({ error: "Código de boleta requerido" });
    }

    if (!signatureDataUrl) {
      return res.status(400).json({ error: "Falta la imagen de la firma" });
    }

    // Verifica que la boleta exista, pertenezca a este empleado, y esté pendiente
    const checkResult = await db.sql`
      SELECT id, status FROM payslips 
      WHERE payslip_code = ${code} AND employee_id = ${session.employee_id}
    `;

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: "Boleta no encontrada" });
    }

    if (checkResult.rows[0].status === "signed") {
      return res.status(400).json({ error: "Esta boleta ya fue firmada anteriormente" });
    }

    const signedAt = new Date();

    await db.sql`
      UPDATE payslips 
      SET status = 'signed', signature_data_url = ${signatureDataUrl}, signed_at = ${signedAt.toISOString()}
      WHERE id = ${checkResult.rows[0].id}
    `;

    return res.status(200).json({
      success: true,
      signedAt: signedAt.toLocaleString("es-PE", {
        day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
      }),
    });
  } catch (error) {
    console.error("Error al firmar boleta:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
}