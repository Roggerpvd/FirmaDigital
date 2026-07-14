import { useParams, Link } from "react-router-dom";
import EmployeeSignPortal from "./EmployeeSignPortal";

// Simulación de una base de datos de boletas pendientes.
// Cuando conectes tu backend real, reemplaza esto por un fetch usando payslipId.
const MOCK_DB: Record<string, { employeeName: string; employeeCode: string; period: string; netAmount: string; issueDate: string }> = {
  "BP-2026-014": { employeeName: "María Fernanda Quispe", employeeCode: "EMP-0142", period: "Julio 2026", netAmount: "S/ 2,850.00", issueDate: "13 jul 2026" },
  "BP-2026-002": { employeeName: "Carlos Alberto Torres", employeeCode: "EMP-0138", period: "Julio 2026", netAmount: "S/ 3,120.00", issueDate: "10 jul 2026" },
  "BP-2026-004": { employeeName: "Jorge Luis Mamani", employeeCode: "EMP-0151", period: "Julio 2026", netAmount: "S/ 2,600.00", issueDate: "10 jul 2026" },
  "BP-2026-006": { employeeName: "Miguel Ángel Flores", employeeCode: "EMP-0163", period: "Julio 2026", netAmount: "S/ 2,950.00", issueDate: "10 jul 2026" },
};

function EmployeeSignRoute() {
  const { payslipId } = useParams<{ payslipId: string }>();
  const record = payslipId ? MOCK_DB[payslipId] : undefined;

  if (!payslipId || !record) {
    return (
      <div className="min-h-screen bg-background text-on-surface flex items-center justify-center p-md">
        <div className="max-w-sm text-center bg-surface-container-lowest border border-outline-variant rounded-xl p-xl shadow-sm">
          <span className="material-symbols-outlined text-[40px] text-outline opacity-40 mb-md">error</span>
          <h2 className="font-headline-sm text-headline-sm text-primary font-bold mb-xs">Boleta no encontrada</h2>
          <p className="text-[13px] text-on-surface-variant mb-lg">
            El enlace de firma no es válido o la boleta ya fue procesada.
          </p>
          <Link to="/" className="text-primary text-[13px] font-semibold hover:underline">Volver al inicio</Link>
        </div>
      </div>
    );
  }

  return (
    <EmployeeSignPortal
      payslip={{
        id: payslipId,
        employeeName: record.employeeName,
        employeeCode: record.employeeCode,
        period: record.period,
        netAmount: record.netAmount,
        issueDate: record.issueDate,
      }}
    />
  );
}

export default EmployeeSignRoute;
