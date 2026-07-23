// api/lib/peruDate.ts
// Perú no tiene horario de verano, siempre es UTC-5. Usamos el timeZone de Intl
// en vez de restar horas a mano para que sea correcto sin importar dónde corra el servidor.

const PERU_TZ = "America/Lima";

/** Fecha de hoy en Perú, formato YYYY-MM-DD (para columnas DATE). */
export function todayInPeru(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: PERU_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Período actual en Perú, formato "Julio 2026". */
export function currentPeriodInPeru(): string {
  const now = new Date();
  const month = new Intl.DateTimeFormat("es-PE", { month: "long", timeZone: PERU_TZ }).format(now);
  const year = new Intl.DateTimeFormat("en-CA", { year: "numeric", timeZone: PERU_TZ }).format(now);
  return `${month.charAt(0).toUpperCase()}${month.slice(1)} ${year}`;
}
