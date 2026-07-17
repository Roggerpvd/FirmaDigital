import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db } from "../lib/db.js";

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
      return res.status(403).json({ error: "Solo empleados pueden ver sus boletas" });
    }

    if (new Date(session.expires_at) < new Date()) {
      return res.status(401).json({ error: "Sesión expirada" });
    }

    const payslipsResult = await db.sql`
      SELECT payslip_code, period, net_amount, issue_date, status, signed_at
      FROM payslips
      WHERE employee_id = ${session.employee_id}
      ORDER BY issue_date DESC
    `;

    const payslips = payslipsResult.rows.map((p) => ({
      id: p.payslip_code,
      period: p.period,
      netAmount: `S/ ${Number(p.net_amount).toFixed(2)}`,
      issueDate: new Date(p.issue_date).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" }),
      status: p.status === "signed" ? "Signed" : "Pending",
      signedDate: p.signed_at
        ? new Date(p.signed_at).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" })
        : undefined,
    }));

    return res.status(200).json({ payslips });
  } catch (error) {
    console.error("Error al obtener boletas:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
}