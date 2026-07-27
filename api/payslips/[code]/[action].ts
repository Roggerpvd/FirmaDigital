// api/payslips/[code]/[action].ts
//
// Sirve el PDF de la boleta (firmado si existe, si no el original).
// Un solo endpoint dinámico cubre dos rutas (para no pasarnos del límite
// de Serverless Functions del plan Hobby de Vercel):
//   GET /api/payslips/:code/download -> fuerza la descarga (attachment)
//   GET /api/payslips/:code/view     -> lo muestra inline (ej. dentro de un <iframe>)
//
// El PDF vive en storage PRIVADO de Vercel Blob, así que esta es la única forma
// legítima de acceder a él: siempre pasando por acá, que valida sesión y dueño
// antes de servirlo.

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { get } from "@vercel/blob";
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

  const { action } = req.query as { action?: string };
  if (action !== "download" && action !== "view") {
    return res.status(404).json({ error: "Ruta no encontrada" });
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
      return res.status(403).json({
        error: action === "download" ? "Solo empleados pueden descargar sus boletas" : "Solo empleados pueden ver sus boletas",
      });
    }

    if (new Date(session.expires_at) < new Date()) {
      return res.status(401).json({ error: "Sesión expirada" });
    }

    const { code } = req.query as { code?: string };
    if (!code) {
      return res.status(400).json({ error: "Código de boleta requerido" });
    }

    const result = await db.sql`
      SELECT pdf_url, signed_pdf_url FROM payslips
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

    const blobToken = process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_READ_WRITE_TOKEN_DEV;
    if (!blobToken) {
      console.error("Falta BLOB_READ_WRITE_TOKEN en las variables de entorno del servidor");
      return res.status(500).json({ error: "Configuración de storage incompleta. Contacta al administrador." });
    }

    const blobResult = await get(fileUrl, { access: "private", token: blobToken });
    if (!blobResult || blobResult.statusCode !== 200) {
      return res.status(502).json({ error: "No se pudo obtener el PDF del storage" });
    }

    const arrayBuffer = await new Response(blobResult.stream).arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    res.setHeader("Content-Type", "application/pdf");

    if (action === "download") {
      const suffix = signed_pdf_url ? "-firmada" : "";
      res.setHeader("Content-Disposition", `attachment; filename="${code}${suffix}.pdf"`);
      res.setHeader("Content-Length", buffer.length.toString());
      res.setHeader("Cache-Control", "private, max-age=0, no-cache");
    } else {
      // "inline" (no "attachment"): el navegador lo muestra en el iframe en vez de descargarlo.
      res.setHeader("Content-Disposition", "inline");
      res.setHeader("Content-Length", buffer.length.toString());
      // Nunca cachear: cada boleta puede pasar de "pendiente" a "firmada" y el contenido cambia.
      res.setHeader("Cache-Control", "private, max-age=0, no-cache, no-store");
    }

    return res.send(buffer);
  } catch (error) {
    console.error(`Error al ${action === "download" ? "descargar" : "previsualizar"} boleta:`, error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
}
