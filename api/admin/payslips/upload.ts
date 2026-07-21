import type { VercelRequest, VercelResponse } from "@vercel/node";
import { put } from "@vercel/blob";
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
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  const isAdmin = await requireAdmin(req);
  if (!isAdmin) {
    return res.status(403).json({ error: "Acceso solo para administradores" });
  }

  try {
    const { employeeEmail, payslipCode, period, issueDate, pdfBase64 } = (req.body ?? {}) as {
      employeeEmail?: string;
      payslipCode?: string;
      period?: string;
      issueDate?: string;
      pdfBase64?: string;
    };

    if (!employeeEmail || !payslipCode || !period || !issueDate || !pdfBase64) {
      return res.status(400).json({ error: "Faltan campos obligatorios" });
    }

    const employeeResult = await db.sql`
      SELECT id FROM employees WHERE email = ${employeeEmail.trim().toLowerCase()}
    `;

    if (employeeResult.rows.length === 0) {
      return res.status(404).json({ error: "No existe un empleado con ese correo" });
    }

    const employeeId = employeeResult.rows[0].id;

    // Convierte el base64 (sin el prefijo "data:application/pdf;base64,") a bytes reales
    const base64Data = pdfBase64.includes(",") ? pdfBase64.split(",")[1] : pdfBase64;
    const pdfBuffer = Buffer.from(base64Data, "base64");

    const blob = await put(`payslips/${payslipCode}-original.pdf`, pdfBuffer, {
      access: "public",
      addRandomSuffix: false,
      contentType: "application/pdf",
      allowOverwrite: true,
    });

    await db.sql`
      INSERT INTO payslips (payslip_code, employee_id, period, net_amount, issue_date, status, pdf_url)
      VALUES (${payslipCode}, ${employeeId}, ${period}, 0, ${issueDate}, 'pending', ${blob.url})
    `;

    return res.status(201).json({ success: true, pdfUrl: blob.url });
  } catch (error: any) {
    console.error("Error al subir boleta PDF:", error);
    if (error.code === "23505") {
      return res.status(409).json({ error: "Ya existe una boleta con ese código" });
    }
    return res.status(500).json({ error: "Error interno del servidor" });
  }
}