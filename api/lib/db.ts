import { createPool } from "@vercel/postgres";

// Usamos STORAGE_POSTGRES_URL porque así se llamó la variable
// en tu proyecto (por el prefijo "STORAGE" que elegiste en Vercel).
export const db = createPool({
  connectionString: process.env.STORAGE_POSTGRES_URL,
});