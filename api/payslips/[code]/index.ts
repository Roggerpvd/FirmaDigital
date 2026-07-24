import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db } from "../../_lib/db.js";

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
      return res.status(403).json({ error: "Solo empleados pueden ver boletas individuales" });
    }

    if (new Date(session.expires_at) < new Date()) {
      return res.status(401).json({ error: "Sesión expirada" });
    }

    const { code } = req.query as { code?: string };
    if (!code) {
      return res.status(400).json({ error: "Código de boleta requerido" });
    }

    const result = await db.sql`
      SELECT p.payslip_code, p.period, p.net_amount, p.issue_date, p.status,
             p.pdf_url, p.signed_pdf_url,
             e.full_name, e.employee_code
      FROM payslips p
      JOIN employees e ON e.id = p.employee_id
      WHERE p.payslip_code = ${code} AND p.employee_id = ${session.employee_id}
    `;

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Boleta no encontrada" });
    }

    const p = result.rows[0];

    return res.status(200).json({
      id: p.payslip_code,
      employeeName: p.full_name,
      employeeCode: p.employee_code,
      period: p.period,
      netAmount: `S/ ${Number(p.net_amount).toFixed(2)}`,
      issueDate: new Date(p.issue_date).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" }),
      status: p.status,
      pdfUrl: p.pdf_url,
      signedPdfUrl: p.signed_pdf_url,
    });
  } catch (error) {
    console.error("Error al obtener boleta:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
}