import type { Session } from "../types/session";

export async function fetchCurrentSession(): Promise<Session | null> {
  const res = await fetch("/api/auth/me", {
    credentials: "include",
  });

  if (!res.ok) {
    return null;
  }

  return res.json();
}

export async function logout(): Promise<void> {
  await fetch("/api/auth/me", {
    method: "DELETE",
    credentials: "include",
  });
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const res = await fetch("/api/auth/password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "No se pudo cambiar la contraseña");
}
