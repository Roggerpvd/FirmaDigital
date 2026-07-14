import { useParams, Link } from "react-router-dom";
import { MOCK_EMPLOYEES_DB } from "../mocks/employeePayslips";
import EmployeeDashboard from "./EmployeeDashboard";

function EmployeeDashboardRoute() {
  const { employeeCode } = useParams<{ employeeCode: string }>();
  const record = employeeCode ? MOCK_EMPLOYEES_DB[employeeCode] : undefined;

  if (!employeeCode || !record) {
    return (
      <div className="min-h-screen bg-background text-on-surface flex items-center justify-center p-md">
        <div className="max-w-sm text-center bg-surface-container-lowest border border-outline-variant rounded-xl p-xl shadow-sm">
          <span className="material-symbols-outlined text-[40px] text-outline opacity-40 mb-md">error</span>
          <h2 className="font-headline-sm text-headline-sm text-primary font-bold mb-xs">Empleado no encontrado</h2>
          <p className="text-[13px] text-on-surface-variant mb-lg">
            El código de empleado no es válido.
          </p>
          <Link to="/" className="text-primary text-[13px] font-semibold hover:underline">Volver al inicio</Link>
        </div>
      </div>
    );
  }

  return <EmployeeDashboard employee={record.profile} initialPayslips={record.payslips} />;
}

export default EmployeeDashboardRoute;