// api/payslips/[code]/sign.ts

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { PDFDocument } from "pdf-lib";
import { put } from "@vercel/blob";
import { db } from "../../lib/db.js";

function getCookie(req: VercelRequest, name: string): string | null {
  const cookies = req.headers.cookie;
  if (!cookies) return null;
  const match = cookies.split("; ").find((c) => c.startsWith(`${name}=`));
  return match ? match.split("=")[1] : null;
}

// Coordenadas fijas donde va la firma dentro del PDF.
// Ajusta estos valores según el diseño real de tu boleta.
// En PDF, el origen (0,0) está en la esquina INFERIOR izquierda de la página.
const SIGNATURE_X = 60;
const SIGNATURE_Y = 80;
const SIGNATURE_WIDTH = 180;
const SIGNATURE_HEIGHT = 70;

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
    const { signatureDataUrl: providedSignature } = (req.body ?? {}) as { signatureDataUrl?: string };

    if (!code) {
      return res.status(400).json({ error: "Código de boleta requerido" });
    }

    const checkResult = await db.sql`
      SELECT id, status, pdf_url FROM payslips 
      WHERE payslip_code = ${code} AND employee_id = ${session.employee_id}
    `;

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: "Boleta no encontrada" });
    }

    const payslipRow = checkResult.rows[0];

    if (payslipRow.status === "signed") {
      return res.status(400).json({ error: "Esta boleta ya fue firmada anteriormente" });
    }

    if (!payslipRow.pdf_url) {
      return res.status(400).json({ error: "Esta boleta no tiene un PDF asociado" });
    }

    // Determina qué firma usar: la enviada ahora, o la firma maestra guardada
    let signatureDataUrl = providedSignature;
    if (!signatureDataUrl) {
      const employeeResult = await db.sql`
        SELECT signature_data_url FROM employees WHERE id = ${session.employee_id}
      `;
      signatureDataUrl = employeeResult.rows[0]?.signature_data_url;
    }

    if (!signatureDataUrl) {
      return res.status(400).json({ error: "No tienes una firma guardada. Crea tu firma primero." });
    }

    if (providedSignature) {
      await db.sql`
        UPDATE employees SET signature_data_url = ${providedSignature} WHERE id = ${session.employee_id}
      `;
    }

    // Descarga el PDF original
    const pdfResponse = await fetch(payslipRow.pdf_url);
    const pdfBytes = await pdfResponse.arrayBuffer();
    const pdfDoc = await PDFDocument.load(pdfBytes);

    // Convierte la firma (base64 PNG) en bytes e incrústala
    const signatureBase64 = signatureDataUrl.includes(",") ? signatureDataUrl.split(",")[1] : signatureDataUrl;
    const signatureBytes = Buffer.from(signatureBase64, "base64");
    const signatureImage = await pdfDoc.embedPng(signatureBytes);

    const pages = pdfDoc.getPages();
    const lastPage = pages[pages.length - 1];

    lastPage.drawImage(signatureImage, {
      x: SIGNATURE_X,
      y: SIGNATURE_Y,
      width: SIGNATURE_WIDTH,
      height: SIGNATURE_HEIGHT,
    });

    const signedPdfBytes = await pdfDoc.save();

    // En producción/preview, Vercel inyecta BLOB_READ_WRITE_TOKEN automáticamente al conectar el store.
    // En desarrollo local (vercel dev) usamos BLOB_READ_WRITE_TOKEN_DEV como respaldo,
    // porque las variables "Sensitive" no se pueden habilitar para el ambiente Development.
    const blobToken = process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_READ_WRITE_TOKEN_DEV;
    if (!blobToken) {
      console.error("Falta BLOB_READ_WRITE_TOKEN en las variables de entorno del servidor");
      return res.status(500).json({ error: "Configuración de storage incompleta. Contacta al administrador." });
    }

    const signedBlob = await put(`payslips/${code}-signed.pdf`, Buffer.from(signedPdfBytes), {
      access: "public",
      contentType: "application/pdf",
      allowOverwrite: true,
      token: blobToken,
    });

    const signedAt = new Date();

    await db.sql`
      UPDATE payslips 
      SET status = 'signed', signature_data_url = ${signatureDataUrl}, signed_at = ${signedAt.toISOString()}, signed_pdf_url = ${signedBlob.url}
      WHERE id = ${payslipRow.id}
    `;

    return res.status(200).json({
      success: true,
      signedAt: signedAt.toLocaleString("es-PE", {
        day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
      }),
      signedPdfUrl: signedBlob.url,
    });
  } catch (error) {
    console.error("Error al firmar boleta:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
}