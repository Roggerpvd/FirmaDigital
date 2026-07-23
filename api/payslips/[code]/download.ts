// api/payslips/[code]/download.ts

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db } from "../../lib/db.js";

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
      SELECT user_type, employee_id, expires_at FROM sessions WHERE token = ${sessionToken}
    `;

    if (sessionResult.rows.length === 0) {
      return res.status(401).json({ error: "Sesión inválida" });
    }

    const session = sessionResult.rows[0];

    if (session.user_type !== "employee") {
      return res.status(403).json({ error: "Solo empleados pueden descargar sus boletas" });
    }

    if (new Date(session.expires_at) < new Date()) {
      return res.status(401).json({ error: "Sesión expirada" });
    }

    const { code } = req.query as { code?: string };
    if (!code) {
      return res.status(400).json({ error: "Código de boleta requerido" });
    }

    const result = await db.sql`
      SELECT pdf_url, signed_pdf_url, status FROM payslips
      WHERE payslip_code = ${code} AND employee_id = ${session.employee_id}
    `;

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Boleta no encontrada" });
    }

    const { pdf_url, signed_pdf_url } = result.rows[0];

    // Prioriza siempre el PDF firmado si existe; si no, cae al original
    const fileUrl = signed_pdf_url || pdf_url;
    if (!fileUrl) {
      return res.status(404).json({ error: "Esta boleta no tiene un PDF asociado" });
    }

    const fileResponse = await fetch(fileUrl);
    if (!fileResponse.ok) {
      return res.status(502).json({ error: "No se pudo obtener el PDF del storage" });
    }

    const arrayBuffer = await fileResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const suffix = signed_pdf_url ? "-firmada" : "";

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${code}${suffix}.pdf"`);
    res.setHeader("Content-Length", buffer.length.toString());
    res.setHeader("Cache-Control", "private, max-age=0, no-cache");

    return res.send(buffer);
  } catch (error) {
    console.error("Error al descargar boleta:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
}
