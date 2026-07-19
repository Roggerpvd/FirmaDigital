import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db } from "../../../lib/db.js";

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
    if (!sessionToken) return res.status(401).json({ error: "No autenticado" });

    const sessionResult = await db.sql`
      SELECT user_type, expires_at FROM sessions WHERE token = ${sessionToken}
    `;

    if (sessionResult.rows.length === 0 || sessionResult.rows[0].user_type !== "admin") {
      return res.status(403).json({ error: "Acceso solo para administradores" });
    }

    if (new Date(sessionResult.rows[0].expires_at) < new Date()) {
      return res.status(401).json({ error: "Sesión expirada" });
    }

    const { code } = req.query as { code?: string };

    const result = await db.sql`
      SELECT proof_image_url FROM payslips WHERE payslip_code = ${code}
    `;

    if (result.rows.length === 0 || !result.rows[0].proof_image_url) {
      return res.status(404).json({ error: "Comprobante no disponible" });
    }

    return res.status(200).json({ proofImageUrl: result.rows[0].proof_image_url });
  } catch (error) {
    console.error("Error al obtener comprobante:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
}