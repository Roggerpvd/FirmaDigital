// api/_lib/otp.ts
//
// Utilidades para el segundo factor de autenticación (OTP) usado al firmar
// una boleta. El código se genera en el servidor, se guarda hasheado
// (nunca en texto plano) y se envía al correo del empleado por Gmail SMTP.

import { createHash, randomInt } from "node:crypto";
import { sendMail } from "./mailer.js";

export const OTP_LENGTH = 6;
export const OTP_EXPIRY_MINUTES = 5;
export const OTP_MAX_ATTEMPTS = 5;
// Tiempo mínimo entre solicitudes de un nuevo código, para evitar spam de correos.
export const OTP_RESEND_COOLDOWN_SECONDS = 45;

/** Genera un código numérico de 6 dígitos (con ceros a la izquierda si hace falta). */
export function generateOtpCode(): string {
  const max = 10 ** OTP_LENGTH;
  const value = randomInt(0, max);
  return value.toString().padStart(OTP_LENGTH, "0");
}

/** Hashea el código para guardarlo en la base de datos (nunca texto plano). */
export function hashOtpCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

/**
 * Envía el código OTP al correo del empleado por Gmail SMTP.
 * Lanza un error si no se pudo enviar, para que el endpoint que llama
 * decida cómo responder (y no deje al usuario pensando que se envió).
 */
export async function sendOtpEmail(params: {
  toEmail: string;
  employeeName: string;
  payslipCode: string;
  otpCode: string;
}): Promise<void> {
  await sendMail({
    toEmail: params.toEmail,
    subject: `Tu código para firmar la boleta ${params.payslipCode}`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <p>Hola ${escapeHtml(params.employeeName)},</p>
        <p>Usa este código para confirmar la firma de tu boleta <strong>${escapeHtml(params.payslipCode)}</strong>:</p>
        <p style="font-size: 32px; font-weight: bold; letter-spacing: 8px; margin: 24px 0;">
          ${params.otpCode}
        </p>
        <p>Este código vence en ${OTP_EXPIRY_MINUTES} minutos. Si no fuiste tú quien lo solicitó, ignora este correo.</p>
      </div>
    `,
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Enmascara un correo para mostrarlo en la UI sin revelarlo completo, ej. "ma***@gmail.com". */
export function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  if (!domain) return email;
  const visible = user.slice(0, 2);
  return `${visible}${"*".repeat(Math.max(user.length - 2, 3))}@${domain}`;
}
