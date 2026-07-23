import type { VercelRequest, VercelResponse } from "@vercel/node";
import { put } from "@vercel/blob";
import { db } from "../lib/db.js";
import { todayInPeru, currentPeriodInPeru } from "../lib/peruDate.js";

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

async function handleUpload(req: VercelRequest, res: VercelResponse) {
  const { employeeEmail, pdfBase64 } = (req.body ?? {}) as {
    employeeEmail?: string;
    pdfBase64?: string;
  };

  if (!employeeEmail || !pdfBase64) {
    return res.status(400).json({ error: "Falta el empleado o el archivo PDF" });
  }

  const employeeResult = await db.sql`
    SELECT id, employee_code FROM employees WHERE email = ${employeeEmail.trim().toLowerCase()}
  `;

  if (employeeResult.rows.length === 0) {
    return res.status(404).json({ error: "No existe un empleado con ese correo" });
  }

  const employeeId = employeeResult.rows[0].id;
  const employeeCode = employeeResult.rows[0].employee_code;

  // ID correlativo: cuántas boletas tiene ya este empleado + 1, ej. "EMP-0142-003"
  const countResult = await db.sql`
    SELECT COUNT(*)::int AS total FROM payslips WHERE employee_id = ${employeeId}
  `;
  const nextSeq = countResult.rows[0].total + 1;
  const payslipCode = `${employeeCode}-${String(nextSeq).padStart(3, "0")}`;

  const period = currentPeriodInPeru();
  const issueDate = todayInPeru();

  const base64Data = pdfBase64.includes(",") ? pdfBase64.split(",")[1] : pdfBase64;
  const pdfBuffer = Buffer.from(base64Data, "base64");

  const blobToken = process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_READ_WRITE_TOKEN_DEV;

  if (!blobToken) {
    console.error("Falta el BLOB_READ_WRITE_TOKEN en el servidor");
    return res.status(500).json({
      error: "Configuración de storage incompleta. Contacta al administrador.",
    });
  }

  const blob = await put(
    `payslips/${payslipCode}-original.pdf`,
    pdfBuffer,
    {
      access: "public",
      addRandomSuffix: false,
      contentType: "application/pdf",
      allowOverwrite: true,
      token: blobToken, // Pasamos el token explícitamente
    }
  );

  await db.sql`
    INSERT INTO payslips (payslip_code, employee_id, period, net_amount, issue_date, status, pdf_url)
    VALUES (${payslipCode}, ${employeeId}, ${period}, 0, ${issueDate}, 'pending', ${blob.url})
  `;

  return res.status(201).json({ success: true, payslipCode, period, issueDate, pdfUrl: blob.url });
}

async function handleDownload(req: VercelRequest, res: VercelResponse) {
  const { payslipCode, signed } = req.query;
  if (!payslipCode || typeof payslipCode !== "string") {
    return res.status(400).json({ error: "Falta el código de boleta" });
  }

  const wantsSigned = signed === "true" || signed === "1";

  const result = await db.sql`
    SELECT pdf_url, signed_pdf_url FROM payslips WHERE payslip_code = ${payslipCode}
  `;

  if (result.rows.length === 0) {
    return res.status(404).json({ error: "Boleta no encontrada" });
  }

  const { pdf_url, signed_pdf_url } = result.rows[0];

  // Si piden explícitamente el firmado, usamos signed_pdf_url; si no, el original.
  const fileUrl = wantsSigned ? signed_pdf_url : pdf_url;

  if (!fileUrl) {
    return res.status(404).json({
      error: wantsSigned ? "Esta boleta todavía no ha sido firmada" : "Esta boleta no tiene PDF asociado",
    });
  }

  const fileResponse = await fetch(fileUrl);
  if (!fileResponse.ok) {
    return res.status(502).json({ error: "No se pudo obtener el PDF del storage" });
  }

  const arrayBuffer = await fileResponse.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const suffix = wantsSigned ? "-firmada" : "";

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${payslipCode}${suffix}.pdf"`);
  res.setHeader("Content-Length", buffer.length.toString());
  res.setHeader("Cache-Control", "private, max-age=0, no-cache");

  return res.send(buffer);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const isAdmin = await requireAdmin(req);
  if (!isAdmin) {
    return res.status(403).json({ error: "Acceso solo para administradores" });
  }

  try {
    if (req.method === "POST") {
      return await handleUpload(req, res);
    }
    if (req.method === "GET") {
      return await handleDownload(req, res);
    }
    return res.status(405).json({ error: "Método no permitido" });
  } catch (error: any) {
    console.error(`Error en ${req.method}:`, error);
    if (error.code === "23505") {
      return res.status(409).json({ error: "Ya existe una boleta con ese código" });
    }
    if (String(error?.message ?? "").includes("credentials")) {
      return res.status(500).json({ error: "Error de credenciales de storage" });
    }
    return res.status(500).json({ error: "Error interno del servidor" });
  }
}