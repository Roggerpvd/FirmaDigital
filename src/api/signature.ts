export async function fetchMySignature(): Promise<string | null> {
  const res = await fetch("/api/employees/signature", { credentials: "include" });
  if (!res.ok) return null;
  const data = await res.json();
  return data.signatureDataUrl;
}

export async function updateMySignature(signatureDataUrl: string): Promise<boolean> {
  const res = await fetch("/api/employees/signature", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ signatureDataUrl }),
  });
  return res.ok;
}