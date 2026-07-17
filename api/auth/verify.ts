import type { VercelRequest, VercelResponse } from "@vercel/node";
import crypto from "crypto";
import { db } from "../lib/db.js";

const EMPLOYEE_SESSION_HOURS = 12;

function generateToken() {
  return crypto.randomBytes(32).toString("hex");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  try {
    const { token } = req.query as { token?: string };

    if (!token) {
      return res.status(400).send("Enlace inválido: falta el token.");
    }

    // Busca el magic link y trae también los datos del empleado
    const result = await db.sql`
      SELECT ml.id, ml.expires_at, ml.used_at, e.id as employee_id, e.full_name
      FROM magic_links ml
      JOIN employees e ON e.id = ml.employee_id
      WHERE ml.token = ${token}
    `;

    if (result.rows.length === 0) {
      return res.status(400).send("Este enlace no es válido.");
    }

    const link = result.rows[0];

    if (link.used_at) {
      return res.status(400).send("Este enlace ya fue utilizado. Solicita uno nuevo.");
    }

    if (new Date(link.expires_at) < new Date()) {
      return res.status(400).send("Este enlace ha expirado. Solicita uno nuevo.");
    }

    // Marca el magic link como usado (de un solo uso)
    await db.sql`
      UPDATE magic_links SET used_at = now() WHERE id = ${link.id}
    `;

    // Crea la sesión del empleado
    const sessionToken = generateToken();
    const expiresAt = new Date(Date.now() + EMPLOYEE_SESSION_HOURS * 60 * 60 * 1000);

    await db.sql`
      INSERT INTO sessions (token, user_type, employee_id, expires_at)
      VALUES (${sessionToken}, 'employee', ${link.employee_id}, ${expiresAt.toISOString()})
    `;

    res.setHeader(
      "Set-Cookie",
      `session_token=${sessionToken}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${EMPLOYEE_SESSION_HOURS * 60 * 60}`
    );

    // Redirige al portal del empleado (la app del frontend)
    const host = req.headers.host || "";
    const isLocalhost = host.includes("localhost") || host.includes("127.0.0.1");
    const baseUrl = isLocalhost ? `http://${host}` : (process.env.APP_URL || `https://${host}`);
    res.writeHead(302, { Location: `${baseUrl}/` });
    res.end();
  } catch (error) {
    console.error("Error en verify:", error);
    return res.status(500).send("Ocurrió un error al verificar el enlace.");
  }
}