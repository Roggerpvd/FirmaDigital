import { useState, useEffect } from "react";

/**
 * Modo oscuro compartido entre todas las páginas.
 * Se guarda en localStorage para que la preferencia persista
 * al navegar entre Login, Dashboard de admin y de empleado.
 * El <script> inline en index.html ya aplica la clase "dark"
 * antes del primer render para evitar parpadeo.
 */
export function useDarkMode() {
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return document.documentElement.classList.contains("dark");
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [isDarkMode]);

  return [isDarkMode, setIsDarkMode] as const;
}
