import { createPool } from "@vercel/postgres";

// Usa la misma variable de entorno que usa el resto del proyecto (api/_lib/db.ts).
// Corre esto con: node scripts/reset-test-data.mjs
// Necesitas tener STORAGE_POSTGRES_URL en tu entorno (ej. con `vercel env pull .env.local`
// y cargando ese archivo, o exportándola manualmente antes de correr el script).

const db = createPool({
  connectionString: process.env.STORAGE_POSTGRES_URL,
});

async function main() {
  console.log("Borrando datos de prueba (payslips, magic_links, sessions, login_attempts, employees)...");
  console.log("La tabla 'admins' NO se toca.\n");

  await db.sql`
    TRUNCATE TABLE payslips, magic_links, sessions, login_attempts, employees
    RESTART IDENTITY CASCADE
  `;

  console.log("Listo. Base de datos limpia, admins intactos.");
  console.log("\nOJO: los PDFs que ya subiste a Vercel Blob NO se borraron con esto,");
  console.log("porque viven fuera de la base de datos. Si quieres borrarlos también,");
  console.log("hazlo desde el dashboard de Vercel -> Storage -> Blob -> selecciona y elimina,");
  console.log("o dime y te preparo un script aparte para eso.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error al limpiar la base de datos:", err);
    process.exit(1);
  });
