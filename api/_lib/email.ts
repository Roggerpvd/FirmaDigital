// api/_lib/email.ts
//
// Utilidades de correo compartidas: validación de formato de email "real"
// (no solo que tenga un "@") y envío de las credenciales de acceso al
// empleado cuando el admin lo crea o le restablece la contraseña.
// Reutiliza la misma cuenta de Gmail que ya usa el flujo de OTP.

import { sendMail } from "./mailer.js";

// Regex práctica para un email "real": usuario@dominio.tld
// - No permite espacios, ni "@" duplicados, ni dominios sin punto (ej. "correo@empresa").
// - No es 100% RFC 5322 (nada lo es sin enviar un correo de verificación),
//   pero descarta con confianza los typos más comunes: "juan@", "juan@empresa",
//   "juan empresa.com", "juan@@empresa.com", etc.
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

/** true si el correo tiene un formato real y válido (usuario@dominio.tld). */
export function isValidEmail(email: string): boolean {
  if (typeof email !== "string") return false;
  const trimmed = email.trim();
  if (trimmed.length === 0 || trimmed.length > 254) return false;
  return EMAIL_REGEX.test(trimmed);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Envía al empleado su correo (usuario) y contraseña temporal para que pueda
 * ingresar por primera vez. Se usa tanto al crear la cuenta como al
 * restablecer la contraseña desde el panel de admin.
 * Lanza un error si no se pudo enviar, para que quien llama decida cómo
 * avisarle al admin (la cuenta ya quedó creada/actualizada de todos modos).
 */
export async function sendCredentialsEmail(params: {
  toEmail: string;
  employeeName: string;
  temporaryPassword: string;
  isReset?: boolean;
}): Promise<void> {
  const appUrl = process.env.APP_URL || "https://misterpanboletas.vercel.app";
  const loginUrl = `${appUrl.replace(/\/$/, "")}/login`;
  const subject = params.isReset
    ? "Tu contraseña de acceso fue restablecida"
    : "Tu acceso al sistema de boletas de pago";

  await sendMail({
    toEmail: params.toEmail,
    subject,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <p>Hola ${escapeHtml(params.employeeName)},</p>
        <p>${
          params.isReset
            ? "Se restableció la contraseña de tu cuenta en el sistema de boletas de pago."
            : "Se creó tu cuenta en el sistema de boletas de pago."
        } Estas son tus credenciales de acceso:</p>
        <div style="background:#f5f5f5; border-radius:8px; padding:16px; margin:20px 0;">
          <p style="margin:0 0 4px 0; font-size:12px; color:#666;">Correo</p>
          <p style="margin:0 0 12px 0; font-weight:bold;">${escapeHtml(params.toEmail)}</p>
          <p style="margin:0 0 4px 0; font-size:12px; color:#666;">Contraseña temporal</p>
          <p style="margin:0; font-weight:bold; font-size:18px; letter-spacing:1px;">${escapeHtml(
            params.temporaryPassword
          )}</p>
        </div>
        <p>Por seguridad, al ingresar por primera vez con esta contraseña temporal se te pedirá <strong>crear una contraseña nueva y propia</strong> antes de poder ver o firmar tus boletas.</p>
        <p>
          <a href="${escapeHtml(loginUrl)}" style="display:inline-block; background:#1a73e8; color:#ffffff; text-decoration:none; padding:10px 20px; border-radius:6px; font-weight:bold;">Ingresar al sistema</a>
        </p>
        <p style="font-size:12px; color:#666;">Si el botón no funciona, copia y pega este enlace en tu navegador:<br/>${escapeHtml(loginUrl)}</p>
        <p style="color:#999; font-size:12px;">Si no esperabas este correo, contacta a tu administrador.</p>
      </div>
    `,
  });
}
