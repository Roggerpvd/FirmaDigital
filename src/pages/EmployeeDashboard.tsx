import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { EmployeePayslip, EmployeeProfile } from "../types/payslip";
import { isPayslipSigned } from "../store/payslipStore";
import PayslipCard from "../components/PayslipCard";
import { logout, changePassword } from "../api/auth";


function getInitials(name: string) {
  const parts = name.split(" ");
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

type FilterTab = "all" | "pending" | "signed";

interface EmployeeDashboardProps {
  employee: EmployeeProfile;
  initialPayslips: EmployeePayslip[];
}

function EmployeeDashboard({ employee, initialPayslips }: EmployeeDashboardProps) {
  const navigate = useNavigate();

  const [payslips] = useState<EmployeePayslip[]>(() =>
    initialPayslips.map(p =>
      isPayslipSigned(p.id) && p.status === "Pending"
        ? { ...p, status: "Signed" as const, signedDate: new Date().toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" }) }
        : p
    )
  );
  const [filterTab, setFilterTab] = useState<FilterTab>("all");

  // Modal: Cambiar contraseña
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const closePasswordModal = () => {
    setShowPasswordModal(false);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPasswordError(null);
    setPasswordSuccess(false);
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);

    if (newPassword.length < 8) {
      setPasswordError("La nueva contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (newPassword.length > 12) {
      setPasswordError("La nueva contraseña no debe exceder los 12 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Las contraseñas no coinciden.");
      return;
    }

    setChangingPassword(true);
    try {
      await changePassword(currentPassword, newPassword);
      setPasswordSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setPasswordError(err.message || "No se pudo cambiar la contraseña.");
    } finally {
      setChangingPassword(false);
    }
  };

  const countSigned = payslips.filter(p => p.status === "Signed").length;
  const countPending = payslips.filter(p => p.status === "Pending").length;

  const filteredPayslips = payslips.filter(p => {
    if (filterTab === "signed") return p.status === "Signed";
    if (filterTab === "pending") return p.status === "Pending";
    return true;
  });
  

  const handleDownload = async (payslip: EmployeePayslip) => {
    try {
      const res = await fetch(`/api/payslips/${payslip.id}/download`, {
        credentials: "include",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "No se pudo descargar la boleta");
        return;
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${payslip.id}${payslip.status === "Signed" ? "-firmada" : ""}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch {
      alert("No se pudo conectar con el servidor para descargar la boleta");
    }
  };

  return (
    <div className="min-h-screen bg-transparent text-on-surface">
      <div className="max-w-2xl mx-auto p-md sm:p-xl">

        {/* Encabezado del empleado */}
        <div className="flex items-center justify-between gap-md mb-xl">
          <div className="flex items-center gap-md">
            <div className="w-14 h-14 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center font-bold text-[18px]">
              {getInitials(employee.fullName)}
            </div>
            <div>
              <h1 className="font-headline-md text-headline-md text-primary font-bold">{employee.fullName}</h1>
              <p className="text-[12px] text-on-surface-variant">
                {employee.employeeCode}{employee.position ? ` · ${employee.position}` : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-lg shrink-0">
            <button
              onClick={() => setShowPasswordModal(true)}
              className="flex items-center gap-xs text-on-surface-variant hover:text-primary transition-all text-[13px]"
              title="Cambiar contraseña"
            >
              <span className="material-symbols-outlined text-[20px]">key</span>
              <span className="hidden sm:inline">Contraseña</span>
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-xs text-on-surface-variant hover:text-error transition-all text-[13px]"
              title="Cerrar sesión"
            >
              <span className="material-symbols-outlined text-[20px]">logout</span>
              <span className="hidden sm:inline">Salir</span>
            </button>
          </div>
        </div>

        {/* Tarjetas resumen */}
        <div className="grid grid-cols-3 gap-md mb-xl">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-lg shadow-sm text-center">
            <p className="text-2xl font-bold text-primary">{payslips.length}</p>
            <p className="text-[12px] text-on-surface-variant mt-xs">Total</p>
          </div>
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-lg shadow-sm text-center">
            <p className="text-2xl font-bold text-emerald-600">{countSigned}</p>
            <p className="text-[12px] text-on-surface-variant mt-xs">Firmadas</p>
          </div>
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-lg shadow-sm text-center">
            <p className="text-2xl font-bold text-amber-600">{countPending}</p>
            <p className="text-[12px] text-on-surface-variant mt-xs">Pendientes</p>
          </div>
        </div>

        {/* Tabs de filtro */}
        <div className="flex gap-lg border-b border-outline-variant mb-lg overflow-x-auto">
          <button
            onClick={() => setFilterTab("all")}
            className={`pb-md border-b-2 text-[13px] whitespace-nowrap transition-all ${filterTab === "all" ? "border-primary text-primary font-semibold" : "border-transparent text-on-surface-variant hover:text-primary"}`}
          >
            Todas ({payslips.length})
          </button>
          <button
            onClick={() => setFilterTab("pending")}
            className={`pb-md border-b-2 text-[13px] whitespace-nowrap transition-all ${filterTab === "pending" ? "border-primary text-primary font-semibold" : "border-transparent text-on-surface-variant hover:text-primary"}`}
          >
            Pendientes ({countPending})
          </button>
          <button
            onClick={() => setFilterTab("signed")}
            className={`pb-md border-b-2 text-[13px] whitespace-nowrap transition-all ${filterTab === "signed" ? "border-primary text-primary font-semibold" : "border-transparent text-on-surface-variant hover:text-primary"}`}
          >
            Firmadas ({countSigned})
          </button>
        </div>

        {/* Lista de boletas */}
        <div className="space-y-md">
          {filteredPayslips.length > 0 ? (
            filteredPayslips.map(p => (
              <PayslipCard key={p.id} payslip={p} onDownload={handleDownload} />
            ))
          ) : (
            <p className="text-center text-on-surface-variant text-[13px] py-xl">
              No hay boletas en esta categoría.
            </p>
          )}
        </div>

      </div>

      {/* Modal: Cambiar contraseña */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-md z-50">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-xl shadow-lg w-full max-w-sm">
            {passwordSuccess ? (
              <div className="text-center">
                <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-lg">
                  <span className="material-symbols-outlined text-[28px]">check_circle</span>
                </div>
                <h2 className="font-headline-sm text-headline-sm text-primary font-bold mb-xs">Contraseña actualizada</h2>
                <p className="text-[13px] text-on-surface-variant mb-lg">
                  Tu contraseña se cambió correctamente. Cualquier otra sesión abierta con tu cuenta fue cerrada.
                </p>
                <button
                  onClick={closePasswordModal}
                  className="w-full bg-primary text-on-primary px-lg py-md rounded-lg font-body-md text-body-md hover:opacity-90 transition-all"
                >
                  Listo
                </button>
              </div>
            ) : (
              <form onSubmit={handleChangePassword}>
                <h2 className="font-headline-sm text-headline-sm text-primary font-bold mb-lg">Cambiar contraseña</h2>

                <label className="block text-[12px] font-semibold text-on-surface-variant mb-xs">Contraseña actual</label>
                <div className="relative mb-md">
                  <input
                    type={showCurrentPassword ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    className="w-full border border-outline-variant rounded-lg px-md py-sm pr-11 text-[13px] bg-surface"
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

                <label className="block text-[12px] font-semibold text-on-surface-variant mb-xs">Nueva contraseña</label>
                <div className="relative mb-md">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={8}
                    maxLength={12}
                    className="w-full border border-outline-variant rounded-lg px-md py-sm pr-11 text-[13px] bg-surface"
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
                <p className="text-[11px] text-on-surface-variant -mt-sm mb-md">Entre 8 y 12 caracteres.</p>

                <label className="block text-[12px] font-semibold text-on-surface-variant mb-xs">Confirmar nueva contraseña</label>
                <div className="relative mb-lg">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={8}
                    maxLength={12}
                    className="w-full border border-outline-variant rounded-lg px-md py-sm pr-11 text-[13px] bg-surface"
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

                {passwordError && <p className="text-[12px] text-error mb-md">{passwordError}</p>}

                <div className="flex gap-sm">
                  <button
                    type="button"
                    onClick={closePasswordModal}
                    className="flex-1 border border-outline-variant px-lg py-md rounded-lg font-body-md text-body-md hover:bg-surface-container transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={changingPassword}
                    className="flex-1 bg-primary text-on-primary px-lg py-md rounded-lg font-body-md text-body-md hover:opacity-90 transition-all disabled:opacity-50"
                  >
                    {changingPassword ? "Guardando..." : "Guardar"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}



export default EmployeeDashboard;