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
