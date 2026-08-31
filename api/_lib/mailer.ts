// api/_lib/mailer.ts
//
// Envío de correo gratuito usando la cuenta de Gmail del propio negocio,
// vía SMTP con Nodemailer. No requiere verificar un dominio (a diferencia
// de Resend en modo producción) y no está limitado a "solo tu propio correo"
// como el modo de pruebas de Resend.
//
// Requisitos (una sola vez):
// 1. Activar verificación en 2 pasos en la cuenta de Gmail que enviará los correos.
// 2. Crear una "contraseña de aplicación" en https://myaccount.google.com/apppasswords
// 3. Definir en las variables de entorno del servidor (Vercel -> Settings -> Environment Variables):
//      GMAIL_USER = tu-correo@gmail.com
//      GMAIL_APP_PASSWORD = la contraseña de 16 caracteres que te da Google
//      GMAIL_FROM_NAME = Boletas (opcional, nombre que se muestra como remitente)
//
// Límite de Gmail: ~500 correos/día por cuenta, más que suficiente para
// credenciales y OTPs de empleados. Si en el futuro se necesita más volumen,
// se puede migrar a un dominio verificado en Resend sin tocar el resto del código
// (solo este archivo).

import nodemailer from "nodemailer";

let cachedTransporter: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransporter() {
  if (cachedTransporter) return cachedTransporter;

  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (!user || !pass) {
    throw new Error(
      "Faltan GMAIL_USER y/o GMAIL_APP_PASSWORD en las variables de entorno del servidor"
    );
  }

  cachedTransporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });

  return cachedTransporter;
}

/**
 * Envía un correo HTML usando la cuenta de Gmail configurada.
 * Lanza un error si no se pudo enviar, para que quien llama decida cómo avisar.
 */
export async function sendMail(params: {
  toEmail: string;
  subject: string;
  html: string;
}): Promise<void> {
  const transporter = getTransporter();
  const user = process.env.GMAIL_USER as string;
  const fromName = process.env.GMAIL_FROM_NAME || "Boletas";

  try {
    await transporter.sendMail({
      from: `"${fromName}" <${user}>`,
      to: params.toEmail,
      subject: params.subject,
      html: params.html,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`No se pudo enviar el correo: ${message}`);
  }
}
