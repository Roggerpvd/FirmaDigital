import { useState } from "react";

type LoginStep = "email" | "password" | "error";

function Login() {
  const [step, setStep] = useState<LoginStep>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error || "Ocurrió un error. Intenta de nuevo.");
        setStep("error");
        return;
      }

      if (data.requiresPassword) {
        setStep("password");
      }
    } catch {
      setErrorMessage("No se pudo conectar con el servidor.");
      setStep("error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error || "Correo o contraseña incorrectos.");
        return;
      }

      window.location.href = "/";
    } catch {
      setErrorMessage("No se pudo conectar con el servidor.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetToEmailStep = () => {
    setStep("email");
    setPassword("");
    setErrorMessage("");
  };

  return (
    <div className="min-h-screen bg-background text-on-surface flex items-center justify-center p-md">
      <div className="w-full max-w-sm">
        <div className="text-center mb-xl">
          <h1 className="font-headline-md text-headline-md text-primary font-bold">Mister Pan</h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-xs">Gestor de boletas de pago</p>
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-xl shadow-sm">
          {step === "email" && (
            <form onSubmit={handleEmailSubmit} className="space-y-md">
              <div>
                <label className="block text-[12px] font-bold uppercase tracking-wider text-on-surface-variant mb-xs">
                  Correo electrónico
                </label>
                <input
                  type="email"
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@correo.pe"
                  className="w-full bg-surface-container border border-outline-variant rounded-lg px-md py-sm font-body-md focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-primary text-on-primary px-lg py-md rounded-lg font-body-md text-body-md hover:opacity-90 active:scale-95 transition-all disabled:opacity-50"
              >
                {isSubmitting ? "Verificando..." : "Continuar"}
              </button>
            </form>
          )}

          {step === "password" && (
            <form onSubmit={handlePasswordSubmit} className="space-y-md">
              <div>
                <p className="text-[13px] text-on-surface-variant mb-md">
                  Iniciando sesión como <span className="font-semibold text-primary">{email}</span>
                </p>
                <label className="block text-[12px] font-bold uppercase tracking-wider text-on-surface-variant mb-xs">
                  Contraseña
                </label>
                <input
                  type="password"
                  required
                  autoFocus
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-surface-container border border-outline-variant rounded-lg px-md py-sm font-body-md focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              {errorMessage && <p className="text-[12px] text-error">{errorMessage}</p>}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-primary text-on-primary px-lg py-md rounded-lg font-body-md text-body-md hover:opacity-90 active:scale-95 transition-all disabled:opacity-50"
              >
                {isSubmitting ? "Ingresando..." : "Ingresar"}
              </button>

              <button
                type="button"
                onClick={resetToEmailStep}
                className="w-full text-[12px] text-on-surface-variant hover:text-primary transition-colors"
              >
                Usar otro correo
              </button>
            </form>
          )}

          {step === "error" && (
            <div className="text-center space-y-md">
              <span className="material-symbols-outlined text-[40px] text-error opacity-70">error</span>
              <p className="text-[13px] text-on-surface-variant">{errorMessage}</p>
              <button onClick={resetToEmailStep} className="text-[12px] text-primary hover:underline">
                Intentar de nuevo
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Login;