import { useState } from "react";
import type { EmployeePayslip, EmployeeProfile } from "../types/payslip";
import { isPayslipSigned } from "../store/payslipStore";
import PayslipCard from "../components/PayslipCard";


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
  const [payslips] = useState<EmployeePayslip[]>(() =>
    initialPayslips.map(p =>
      isPayslipSigned(p.id) && p.status === "Pending"
        ? { ...p, status: "Signed" as const, signedDate: new Date().toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" }) }
        : p
    )
  );
  const [filterTab, setFilterTab] = useState<FilterTab>("all");

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
        <div className="flex items-center gap-md mb-xl">
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
    </div>
  );
}



export default EmployeeDashboard;