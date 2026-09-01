// src/pages/ForcePasswordChange.tsx
//
// Se muestra en vez del dashboard cuando el empleado todavía tiene la
// contraseña temporal que le asignó el administrador. Es el equivalente,
// en esta app (Vite + funciones serverless, sin middleware de Next.js),
// a bloquear la ruta hasta que se resuelva la condición: aquí el "guard"
// vive en AppGate, y el bloqueo real (que nadie puede saltarse desde la
// consola del navegador) está en el backend, en /api/payslips/*/sign
// y /request-otp.

import { useState } from "react";
import { changePassword } from "../api/auth";

interface ForcePasswordChangeProps {
  temporaryPassword?: string;
  email?: string;
  onChanged: () => void;
}

function ForcePasswordChange({ email, onChanged }: ForcePasswordChangeProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    if (newPassword !== confirmPassword) {
      setErrorMessage("Las contraseñas nuevas no coinciden");
      return;
    }

    setIsSubmitting(true);
    try {
      await changePassword(currentPassword, newPassword);
      onChanged();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "No se pudo cambiar la contraseña");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-transparent text-on-surface flex items-center justify-center p-md">
      <div className="w-full max-w-sm">
        <div className="text-center mb-xl">
          <span className="material-symbols-outlined text-[40px] text-primary mb-sm inline-block">lock_reset</span>
          <h1 className="font-headline-md text-headline-md text-primary font-bold">Crea tu contraseña</h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-xs">
            Por seguridad, debes reemplazar la contraseña temporal antes de ver o firmar tus boletas.
          </p>
        </div>

        <div className="bg-surface-container-lowest/70 backdrop-blur-xl border border-white/60 rounded-xl p-xl shadow-2xl ring-1 ring-black/5">
          <form onSubmit={handleSubmit} className="space-y-md">
            {/* Ayuda al navegador a asociar la contraseña nueva con este usuario. */}
            {email && <input type="email" name="email" autoComplete="username" value={email} readOnly hidden />}
            <div>
              <label className="block text-[12px] font-bold uppercase tracking-wider text-on-surface-variant mb-xs">
                Contraseña temporal
              </label>
              <div className="relative">
                <input
                  type={showCurrentPassword ? "text" : "password"}
                  required
                  autoFocus
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full bg-surface-container/60 backdrop-blur-xl border border-white/40 rounded-lg px-md py-sm pr-11 font-body-md focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword((v) => !v)}
                  tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-primary transition-colors"
                  title={showCurrentPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  <span className="material-symbols-outlined text-[20px]">
                    {showCurrentPassword ? "visibility_off" : "visibility"}
                  </span>
                </button>
              </div>
              <p className="text-[11px] text-on-surface-variant mt-xs">La que te compartió tu administrador.</p>
            </div>

            <div>
              <label className="block text-[12px] font-bold uppercase tracking-wider text-on-surface-variant mb-xs">
                Nueva contraseña
              </label>
              <div className="relative">
                <input
                  type={showNewPassword ? "text" : "password"}
                  required
                  minLength={8}
                  maxLength={12}
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-surface-container/60 backdrop-blur-xl border border-white/40 rounded-lg px-md py-sm pr-11 font-body-md focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword((v) => !v)}
                  tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-primary transition-colors"
                  title={showNewPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  <span className="material-symbols-outlined text-[20px]">
                    {showNewPassword ? "visibility_off" : "visibility"}
                  </span>
                </button>
              </div>
              <p className="text-[11px] text-on-surface-variant mt-xs">Entre 8 y 12 caracteres, distinta a la temporal.</p>
            </div>

            <div>
              <label className="block text-[12px] font-bold uppercase tracking-wider text-on-surface-variant mb-xs">
                Confirma la nueva contraseña
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  required
                  minLength={8}
                  maxLength={12}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-surface-container/60 backdrop-blur-xl border border-white/40 rounded-lg px-md py-sm pr-11 font-body-md focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((v) => !v)}
                  tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-primary transition-colors"
                  title={showConfirmPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  <span className="material-symbols-outlined text-[20px]">
                    {showConfirmPassword ? "visibility_off" : "visibility"}
                  </span>
                </button>
              </div>
            </div>

            {errorMessage && <p className="text-[12px] text-error">{errorMessage}</p>}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-primary/80 backdrop-blur-xl border border-primary/40 text-on-primary px-lg py-md rounded-lg font-body-md text-body-md font-semibold shadow-lg hover:bg-primary/90 transition-all disabled:opacity-50"
            >
              {isSubmitting ? "Guardando..." : "Guardar y continuar"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default ForcePasswordChange;
