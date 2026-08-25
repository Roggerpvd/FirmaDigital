import type { VercelRequest, VercelResponse } from "@vercel/node";
import { put, get } from "@vercel/blob";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { db } from "../_lib/db.js";
import { todayInPeru } from "../_lib/peruDate.js";
import { EMPLOYER_SIGNATURE_BASE64 } from "../_lib/employerSignature.js";
import {
  EMPLOYER_SIGNATURE_X,
  EMPLOYER_SIGNATURE_Y,
  EMPLOYER_SIGNATURE_WIDTH,
  EMPLOYER_SIGNATURE_HEIGHT,
  SIGNATURE_TEXT_SIZE,
  SIGNATURE_TEXT_GAP,
  SIGNATURE_TEXT_LINE_HEIGHT,
  EMPLOYER_SIGNATURE_LABEL_LINES,
} from "../_lib/signaturePlacement.js";

// Toma el PDF original (bytes) y, si hay una firma de empleador configurada
// (ver api/_lib/employerSignature.ts), la incrusta en la última página junto
// con su etiqueta de texto. Si todavía no se configuró ninguna firma, devuelve
// el PDF sin cambios (el sistema sigue funcionando normal).
async function withEmployerSignature(pdfBuffer: Buffer): Promise<Buffer> {
  if (!EMPLOYER_SIGNATURE_BASE64) {
    return pdfBuffer;
  }

  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const employerSignatureBytes = Buffer.from(EMPLOYER_SIGNATURE_BASE64, "base64");
  const employerSignatureImage = await pdfDoc.embedPng(employerSignatureBytes);

  const pages = pdfDoc.getPages();
  const lastPage = pages[pages.length - 1];

  // Escala la imagen respetando su proporción real (evita que se vea
  // "achatada" o estirada) para que quepa dentro del recuadro de firma,
  // y la centra en ese espacio.
  const naturalWidth = employerSignatureImage.width;
  const naturalHeight = employerSignatureImage.height;
  const scale = Math.min(
    EMPLOYER_SIGNATURE_WIDTH / naturalWidth,
    EMPLOYER_SIGNATURE_HEIGHT / naturalHeight
  );
  const drawWidth = naturalWidth * scale;
  const drawHeight = naturalHeight * scale;
  const drawX = EMPLOYER_SIGNATURE_X + (EMPLOYER_SIGNATURE_WIDTH - drawWidth) / 2;
  const drawY = EMPLOYER_SIGNATURE_Y + (EMPLOYER_SIGNATURE_HEIGHT - drawHeight) / 2;

  lastPage.drawImage(employerSignatureImage, {
    x: drawX,
    y: drawY,
    width: drawWidth,
    height: drawHeight,
  });

  const textFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const textColor = rgb(0.2, 0.2, 0.2);
  let textY = EMPLOYER_SIGNATURE_Y - SIGNATURE_TEXT_GAP;

  for (const line of EMPLOYER_SIGNATURE_LABEL_LINES) {
    lastPage.drawText(line, {
      x: EMPLOYER_SIGNATURE_X,
      y: textY,
      size: SIGNATURE_TEXT_SIZE,
      font: textFont,
      color: textColor,
    });
    textY -= SIGNATURE_TEXT_LINE_HEIGHT;
  }

  return Buffer.from(await pdfDoc.save());
}

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

// Formato esperado para la fecha de emisión: YYYY-MM-DD (igual al de un <input type="date">).
const ISSUE_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

async function handleUpload(req: VercelRequest, res: VercelResponse) {
  const { employeeEmail, pdfBase64, period, issueDate } = (req.body ?? {}) as {
    employeeEmail?: string;
    pdfBase64?: string;
    period?: string;
    issueDate?: string;
  };

  if (!employeeEmail || !pdfBase64) {
    return res.status(400).json({ error: "Falta el empleado o el archivo PDF" });
  }

  if (!period || !period.trim()) {
    return res.status(400).json({ error: "Falta el período" });
  }

  if (!issueDate || !ISSUE_DATE_REGEX.test(issueDate)) {
    return res.status(400).json({ error: "Fecha de emisión inválida. Formato esperado: YYYY-MM-DD" });
  }

  if (issueDate > todayInPeru()) {
    return res.status(400).json({ error: "La fecha de emisión no puede ser posterior al día de hoy" });
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

  const base64Data = pdfBase64.includes(",") ? pdfBase64.split(",")[1] : pdfBase64;
  const rawPdfBuffer = Buffer.from(base64Data, "base64");
  // Incrusta la firma del empleador (si está configurada) antes de guardar el PDF.
  const pdfBuffer = await withEmployerSignature(rawPdfBuffer);

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
      access: "private",
      addRandomSuffix: true,
      contentType: "application/pdf",
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

  const blobToken = process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_READ_WRITE_TOKEN_DEV;
  if (!blobToken) {
    console.error("Falta el BLOB_READ_WRITE_TOKEN en el servidor");
    return res.status(500).json({ error: "Configuración de storage incompleta. Contacta al administrador." });
  }

  const blobResult = await get(fileUrl, { access: "private", token: blobToken });
  if (!blobResult || blobResult.statusCode !== 200) {
    return res.status(502).json({ error: "No se pudo obtener el PDF del storage" });
  }

  const arrayBuffer = await new Response(blobResult.stream).arrayBuffer();
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