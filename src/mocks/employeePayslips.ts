import type { EmployeeProfile, EmployeePayslip } from "../types/payslip";

interface EmployeeRecord {
  profile: EmployeeProfile;
  payslips: EmployeePayslip[];
}

export const MOCK_EMPLOYEES_DB: Record<string, EmployeeRecord> = {
  "EMP-0142": {
    profile: {
      employeeCode: "EMP-0142",
      fullName: "María Fernanda Quispe",
      email: "maria.quispe@empresa.pe",
      position: "Asistente Administrativo",
    },
    payslips: [
      { id: "BP-2026-014", period: "Julio 2026", netAmount: "S/ 2,850.00", issueDate: "13 jul 2026", status: "Pending" },
      { id: "BP-2026-013", period: "Junio 2026", netAmount: "S/ 2,850.00", issueDate: "13 jun 2026", status: "Signed", signedDate: "14 jun 2026" },
      { id: "BP-2026-012", period: "Mayo 2026", netAmount: "S/ 2,780.00", issueDate: "13 may 2026", status: "Signed", signedDate: "13 may 2026" },
    ],
  },
  "EMP-0138": {
    profile: {
      employeeCode: "EMP-0138",
      fullName: "Carlos Alberto Torres",
      email: "carlos.torres@empresa.pe",
      position: "Analista de Sistemas",
    },
    payslips: [
      { id: "BP-2026-002", period: "Julio 2026", netAmount: "S/ 3,120.00", issueDate: "10 jul 2026", status: "Pending" },
      { id: "BP-2026-002-06", period: "Junio 2026", netAmount: "S/ 3,120.00", issueDate: "10 jun 2026", status: "Signed", signedDate: "11 jun 2026" },
    ],
  },
  "EMP-0151": {
    profile: {
      employeeCode: "EMP-0151",
      fullName: "Jorge Luis Mamani",
      email: "jorge.mamani@empresa.pe",
      position: "Operario de Producción",
    },
    payslips: [
      { id: "BP-2026-004", period: "Julio 2026", netAmount: "S/ 2,600.00", issueDate: "10 jul 2026", status: "Pending" },
    ],
  },
};

// Empleado por defecto, útil como fallback en desarrollo
export const MOCK_EMPLOYEE = MOCK_EMPLOYEES_DB["EMP-0142"].profile;
export const MOCK_EMPLOYEE_PAYSLIPS = MOCK_EMPLOYEES_DB["EMP-0142"].payslips;