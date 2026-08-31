// api/payslips/[code]/sign.ts

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { put, get } from "@vercel/blob";
import { createHash } from "node:crypto";
import { db } from "../../_lib/db.js";
import { SIGNATURE_X, SIGNATURE_Y, SIGNATURE_WIDTH, SIGNATURE_HEIGHT, SIGNATURE_TEXT_SIZE, SIGNATURE_TEXT_GAP, SIGNATURE_TEXT_LINE_HEIGHT } from "../../_lib/signaturePlacement.js";
import { hashOtpCode, OTP_MAX_ATTEMPTS } from "../../_lib/otp.js";

// IP real del firmante. En Vercel, la conexión llega desde su proxy, así que
// la IP del cliente viaja en este header (puede traer varias si hay más
// proxies de por medio; la primera es la del navegador del empleado).
function getClientIp(req: VercelRequest): string {
  const forwarded = req.headers["x-forwarded-for"];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return (raw?.split(",")[0].trim()) || req.socket?.remoteAddress || "desconocida";
}

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
    const { signatureDataUrl: providedSignature, otpCode } = (req.body ?? {}) as {
      signatureDataUrl?: string;
      otpCode?: string;
    };

    if (!code) {
      return res.status(400).json({ error: "Código de boleta requerido" });
    }

    if (!otpCode || typeof otpCode !== "string") {
      return res.status(400).json({ error: "Falta el código de verificación (OTP)" });
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

    // Bloqueo de no-repudio (segunda comprobación, por si se intenta firmar
    // saltándose el paso de solicitar el OTP): mientras la contraseña siga
    // siendo la temporal creada por el admin, no se puede firmar.
    const employeeFlagResult = await db.sql`
      SELECT requires_password_change FROM employees WHERE id = ${session.employee_id}
    `;
    if (employeeFlagResult.rows[0]?.requires_password_change) {
      return res.status(403).json({
        error: "Debes cambiar tu contraseña temporal antes de poder firmar boletas",
        requiresPasswordChange: true,
      });
    }

    // Segundo factor de autenticación: valida el código OTP enviado por correo.
    // Toma siempre el código más reciente para esta boleta; los anteriores quedan inválidos.
    const otpResult = await db.sql`
      SELECT id, code_hash, expires_at, attempts, used_at FROM signature_otp_codes
      WHERE payslip_id = ${payslipRow.id}
      ORDER BY created_at DESC
      LIMIT 1
    `;

    if (otpResult.rows.length === 0) {
      return res.status(400).json({ error: "No se ha solicitado un código de verificación. Pide uno primero." });
    }

    const otpRow = otpResult.rows[0];

    if (otpRow.used_at) {
      return res.status(400).json({ error: "Este código ya fue usado. Solicita uno nuevo." });
    }

    if (new Date(otpRow.expires_at) < new Date()) {
      return res.status(400).json({ error: "El código expiró. Solicita uno nuevo." });
    }

    if (otpRow.attempts >= OTP_MAX_ATTEMPTS) {
      return res.status(429).json({ error: "Demasiados intentos con este código. Solicita uno nuevo." });
    }

    const codeMatches = hashOtpCode(otpCode.trim()) === otpRow.code_hash;

    if (!codeMatches) {
      await db.sql`
        UPDATE signature_otp_codes SET attempts = attempts + 1 WHERE id = ${otpRow.id}
      `;
      return res.status(401).json({ error: "El código ingresado es incorrecto" });
    }

    await db.sql`
      UPDATE signature_otp_codes SET used_at = now() WHERE id = ${otpRow.id}
    `;

    // Determina qué firma usar: la enviada ahora, o la firma maestra guardada.
    // De paso traemos el nombre del empleado, para escribirlo debajo de la firma.
    let signatureDataUrl = providedSignature;
    const employeeResult = await db.sql`
      SELECT full_name, signature_data_url FROM employees WHERE id = ${session.employee_id}
    `;
    const employeeFullName: string = employeeResult.rows[0]?.full_name || "";
    if (!signatureDataUrl) {
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

    // En producción/preview, Vercel inyecta BLOB_READ_WRITE_TOKEN automáticamente al conectar el store.
    // En desarrollo local (vercel dev) usamos BLOB_READ_WRITE_TOKEN_DEV como respaldo,
    // porque las variables "Sensitive" no se pueden habilitar para el ambiente Development.
    const blobToken = process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_READ_WRITE_TOKEN_DEV;
    if (!blobToken) {
      console.error("Falta BLOB_READ_WRITE_TOKEN en las variables de entorno del servidor");
      return res.status(500).json({ error: "Configuración de storage incompleta. Contacta al administrador." });
    }

    // Descarga el PDF original (privado: requiere el token para leerlo)
    const originalBlob = await get(payslipRow.pdf_url, { access: "private", token: blobToken });
    if (!originalBlob || originalBlob.statusCode !== 200) {
      return res.status(502).json({ error: "No se pudo obtener el PDF original del storage" });
    }
    const pdfBytes = await new Response(originalBlob.stream).arrayBuffer();
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

    // Nombre del empleado + fecha y hora de firma (hora Perú), debajo de la firma.
    const signedAtForPdf = new Date();
    const signedDateTimeLabel = new Intl.DateTimeFormat("es-PE", {
      timeZone: "America/Lima",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(signedAtForPdf);

    const textFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const textColor = rgb(0.2, 0.2, 0.2);

    let textY = SIGNATURE_Y - SIGNATURE_TEXT_GAP;

    if (employeeFullName) {
      lastPage.drawText(employeeFullName, {
        x: SIGNATURE_X,
        y: textY,
        size: SIGNATURE_TEXT_SIZE,
        font: textFont,
        color: textColor,
      });
      textY -= SIGNATURE_TEXT_LINE_HEIGHT;
    }

    lastPage.drawText(`Firmado el ${signedDateTimeLabel}`, {
      x: SIGNATURE_X,
      y: textY,
      size: SIGNATURE_TEXT_SIZE,
      font: textFont,
      color: textColor,
    });
    textY -= SIGNATURE_TEXT_LINE_HEIGHT;

    // Sello de texto "FIRMADO CONFORME", debajo de todo lo demás (firma, nombre y fecha).
    lastPage.drawText("FIRMADO CONFORME", {
      x: SIGNATURE_X,
      y: textY,
      size: SIGNATURE_TEXT_SIZE,
      font: boldFont,
      color: textColor,
    });

    // Hash del PDF final (con la firma ya incrustada). Esto es lo que da valor
    // probatorio real: cualquier cambio posterior al PDF firmado (aunque sea
    // un byte) produce un hash distinto, así que sirve para detectar alteraciones.
    // No reemplaza a una firma digital PKI, pero es mucho más que una simple imagen.
    const signedPdfBytes = await pdfDoc.save();
    const documentHash = createHash("sha256").update(signedPdfBytes).digest("hex");
    const signerIp = getClientIp(req);
    const signerUserAgent = (req.headers["user-agent"] as string) || "desconocido";

    const signedBlob = await put(`payslips/${code}-signed.pdf`, Buffer.from(signedPdfBytes), {
      access: "private",
      contentType: "application/pdf",
      addRandomSuffix: true,
      token: blobToken,
    });

    const signedAt = signedAtForPdf;

    await db.sql`
      UPDATE payslips 
      SET status = 'signed', signature_data_url = ${signatureDataUrl}, signed_at = ${signedAt.toISOString()},
          signed_pdf_url = ${signedBlob.url}, document_hash = ${documentHash},
          signed_ip = ${signerIp}, signed_user_agent = ${signerUserAgent}
      WHERE id = ${payslipRow.id}
    `;

    return res.status(200).json({
      success: true,
      signedAt: signedAt.toLocaleString("es-PE", {
        timeZone: "America/Lima",
        day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
      }),
      documentHash,
      // La boleta ahora se guarda en storage privado: el navegador no puede leer signedBlob.url
      // directamente. En su lugar, el frontend debe cargar el PDF a través de nuestro propio
      // endpoint autenticado (/view), que sí valida sesión y dueño antes de servirlo.
      viewUrl: `/api/payslips/${code}/view`,
    });
  } catch (error) {
    console.error("Error al firmar boleta:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
}