import { createPool } from "@vercel/postgres";

// Usamos STORAGE_POSTGRES_URL porque así se llamó la variable
// en tu proyecto (por el prefijo "STORAGE" que elegiste en Vercel).
//
// En producción/preview, Vercel la inyecta automáticamente al conectar el store.
// En desarrollo local (vercel dev) usamos STORAGE_POSTGRES_URL_DEV como respaldo,
// porque las variables "Sensitive" no se pueden habilitar para el ambiente
// Development (mismo motivo por el que sign.ts usa BLOB_READ_WRITE_TOKEN_DEV):
// "vercel env pull" nunca trae STORAGE_POSTGRES_URL a .env.local, así que
// db.ts terminaba conectando con connectionString undefined -> ECONNRESET.
const connectionString = process.env.STORAGE_POSTGRES_URL || process.env.STORAGE_POSTGRES_URL_DEV;

if (!connectionString) {
  console.error(
    "Falta STORAGE_POSTGRES_URL (producción) o STORAGE_POSTGRES_URL_DEV (desarrollo local) en las variables de entorno."
  );
}

export const db = createPool({
  connectionString,
});

// IMPORTANTE: el pool mantiene conexiones abiertas de fondo y les puede
// llegar un error de red en cualquier momento (ej. la conexión con Neon se
// corta por WiFi/VPN/firewall, no por algo que hiciste en un request).
// Si nadie escucha ese evento, Node.js lo trata como una excepción NO
// atrapada y mata todo el proceso de "vercel dev" (por eso verías un
// "ECONNRESET" tumbando la terminal entera en vez de solo esa petición).
// Con este listener, ese error se registra en consola pero el servidor
// sigue vivo; el próximo query simplemente abre una conexión nueva.
db.on("error", (err) => {
  console.error("Error de fondo en el pool de PostgreSQL (conexión perdida, no crítico):", err);
});