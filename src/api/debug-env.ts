import type { VercelRequest, VercelResponse } from "@vercel/node";

export default function handler(req: VercelRequest, res: VercelResponse) {
  return res.status(200).json({
    hasBlobToken: !!process.env.BLOB_READ_WRITE_TOKEN,
    blobTokenStart: process.env.BLOB_READ_WRITE_TOKEN?.slice(0, 25) ?? null,
    hasStoreId: !!process.env.BLOB_STORE_ID,
    storeId: process.env.BLOB_STORE_ID ?? null,
    hasOidc: !!process.env.VERCEL_OIDC_TOKEN,
    hasWebhook: !!process.env.BLOB_WEBHOOK_PUBLIC_KEY,
    nodeEnv: process.env.NODE_ENV,
  });
}