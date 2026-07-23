// src/utils/peruDate.ts
// Solo para mostrarle al admin una vista previa antes de subir; el valor real y
// definitivo se calcula en el servidor (api/lib/peruDate.ts) al momento de guardar.

const PERU_TZ = "America/Lima";

export function todayInPeru(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: PERU_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function currentPeriodInPeru(): string {
  const now = new Date();
  const month = new Intl.DateTimeFormat("es-PE", { month: "long", timeZone: PERU_TZ }).format(now);
  const year = new Intl.DateTimeFormat("en-CA", { year: "numeric", timeZone: PERU_TZ }).format(now);
  return `${month.charAt(0).toUpperCase()}${month.slice(1)} ${year}`;
}
