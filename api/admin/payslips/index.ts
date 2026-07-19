import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db } from "../../lib/db.js";

function getCookie(req: VercelRequest, name: string): string | null {
  const cookies = req.headers.cookie;
  if (!cookies) return null;
  const match = cookies.split("; ").find((c) => c.startsWith(`${name}=`));
  return match ? match.split("=")[1] : null;
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
        SELECT 
          p.id, p.payslip_code, p.status, p.issue_date, p.signed_at,
          e.full_name, e.email
        FROM payslips p
        JOIN employees e ON e.id = p.employee_id
        ORDER BY p.issue_date DESC
      `;

      const documents = result.rows.map((row) => ({
        id: String(row.id),
        name: row.full_name,
        payslipId: row.payslip_code,
        status: row.status === "signed" ? "Signed" : "Pending",
        date: row.signed_at
          ? new Date(row.signed_at).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" })
          : "—",
        email: row.email,
      }));

      return res.status(200).json({ documents });
    } catch (error) {
      console.error("Error al listar boletas (admin):", error);
      return res.status(500).json({ error: "Error interno del servidor" });
    }
  }

  if (req.method === "POST") {
    try {
      const { employeeEmail, payslipCode, period, netAmount, issueDate, status } = (req.body ?? {}) as {
        employeeEmail?: string;
        payslipCode?: string;
        period?: string;
        netAmount?: number;
        issueDate?: string;
        status?: "pending" | "signed";
      };

      if (!employeeEmail || !payslipCode || !period || !netAmount || !issueDate) {
        return res.status(400).json({ error: "Faltan campos obligatorios" });
      }

      const employeeResult = await db.sql`
        SELECT id FROM employees WHERE email = ${employeeEmail.trim().toLowerCase()}
      `;

      if (employeeResult.rows.length === 0) {
        return res.status(404).json({ error: "No existe un empleado con ese correo" });
      }

      const employeeId = employeeResult.rows[0].id;
      const finalStatus = status === "signed" ? "signed" : "pending";
      const signedAt = finalStatus === "signed" ? new Date().toISOString() : null;

      await db.sql`
        INSERT INTO payslips (payslip_code, employee_id, period, net_amount, issue_date, status, signed_at)
        VALUES (${payslipCode}, ${employeeId}, ${period}, ${netAmount}, ${issueDate}, ${finalStatus}, ${signedAt})
      `;

      return res.status(201).json({ success: true });
    } catch (error: any) {
      console.error("Error al crear boleta (admin):", error);
      if (error.code === "23505") {
        return res.status(409).json({ error: "Ya existe una boleta con ese código" });
      }
      return res.status(500).json({ error: "Error interno del servidor" });
    }
  }

  return res.status(405).json({ error: "Método no permitido" });
}