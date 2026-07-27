import { list, del } from "@vercel/blob";

// Borra TODOS los archivos guardados en Vercel Blob (los PDFs de boletas).
// Corre esto con: node --env-file=.env.local scripts/reset-blob.mjs
// Necesitas BLOB_READ_WRITE_TOKEN en tu entorno (viene en el .env.local
// que descargas con `vercel env pull .env.local`).

const token = process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_READ_WRITE_TOKEN_DEV;

if (!token) {
  console.error("Falta BLOB_READ_WRITE_TOKEN en el entorno. Corre `vercel env pull .env.local` primero.");
  process.exit(1);
}

async function main() {
  let cursor;
  let totalDeleted = 0;

  do {
    const result = await list({ token, cursor, limit: 100 });

    if (result.blobs.length > 0) {
      const urls = result.blobs.map((b) => b.url);
      console.log(`Borrando ${urls.length} archivo(s)...`);
      urls.forEach((u) => console.log(`  - ${u}`));
      await del(urls, { token });
      totalDeleted += urls.length;
    }

    cursor = result.cursor;
  } while (cursor);

  console.log(`\nListo. Se borraron ${totalDeleted} archivo(s) de Vercel Blob.`);
}

main().catch((err) => {
  console.error("Error al limpiar Blob:", err);
  process.exit(1);
});
