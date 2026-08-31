// api/payslips/[code]/request-otp.ts
//
// Genera un código OTP de 6 dígitos y lo envía al correo del empleado.
// Debe llamarse antes de POST /sign; el código devuelto por /sign debe
// coincidir con el último generado aquí para esa boleta.

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db } from "../../_lib/db.js";
import {
  generateOtpCode,
  hashOtpCode,
  sendOtpEmail,
  maskEmail,
  OTP_EXPIRY_MINUTES,
  OTP_RESEND_COOLDOWN_SECONDS,
} from "../../_lib/otp.js";

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
    if (!code) {
      return res.status(400).json({ error: "Código de boleta requerido" });
    }

    const payslipResult = await db.sql`
      SELECT id, status FROM payslips
      WHERE payslip_code = ${code} AND employee_id = ${session.employee_id}
    `;

    if (payslipResult.rows.length === 0) {
      return res.status(404).json({ error: "Boleta no encontrada" });
    }

    const payslip = payslipResult.rows[0];

    if (payslip.status === "signed") {
      return res.status(400).json({ error: "Esta boleta ya fue firmada anteriormente" });
    }

    // Evita spam de correos: si ya se pidió un código hace muy poco, no genera otro.
    const recentResult = await db.sql`
      SELECT created_at FROM signature_otp_codes
      WHERE payslip_id = ${payslip.id}
      ORDER BY created_at DESC
      LIMIT 1
    `;

    if (recentResult.rows.length > 0) {
      const secondsSinceLast = (Date.now() - new Date(recentResult.rows[0].created_at).getTime()) / 1000;
      if (secondsSinceLast < OTP_RESEND_COOLDOWN_SECONDS) {
        const waitSeconds = Math.ceil(OTP_RESEND_COOLDOWN_SECONDS - secondsSinceLast);
        return res.status(429).json({
          error: `Espera ${waitSeconds} segundo${waitSeconds === 1 ? "" : "s"} antes de pedir otro código`,
        });
      }
    }

    const employeeResult = await db.sql`
      SELECT full_name, email, requires_password_change FROM employees WHERE id = ${session.employee_id}
    `;
    const employee = employeeResult.rows[0];
    if (!employee?.email) {
      return res.status(400).json({ error: "Tu cuenta no tiene un correo registrado" });
    }

    // Bloqueo de no-repudio: si el admin creó esta cuenta y el empleado todavía
    // no estableció su propia contraseña, no puede iniciar el flujo de firma.
    if (employee.requires_password_change) {
      return res.status(403).json({
        error: "Debes cambiar tu contraseña temporal antes de poder firmar boletas",
        requiresPasswordChange: true,
      });
    }

    const otpCode = generateOtpCode();
    const codeHash = hashOtpCode(otpCode);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    await db.sql`
      INSERT INTO signature_otp_codes (payslip_id, employee_id, code_hash, expires_at)
      VALUES (${payslip.id}, ${session.employee_id}, ${codeHash}, ${expiresAt.toISOString()})
    `;

    await sendOtpEmail({
      toEmail: employee.email,
      employeeName: employee.full_name,
      payslipCode: code,
      otpCode,
    });

    return res.status(200).json({
      success: true,
      maskedEmail: maskEmail(employee.email),
      expiresInSeconds: OTP_EXPIRY_MINUTES * 60,
    });
  } catch (error) {
    console.error("Error al generar OTP:", error);
    return res.status(500).json({ error: "No se pudo enviar el código. Intenta de nuevo." });
  }
}
