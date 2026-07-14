export type PayslipStatus = "Signed" | "Pending";

export interface EmployeePayslip {
  id: string;           // ej. "BP-2026-014"
  period: string;        // ej. "Julio 2026"
  netAmount: string;      // ej. "S/ 2,850.00"
  issueDate: string;      // ej. "13 jul 2026"
  status: PayslipStatus;
  signedDate?: string;    // solo si status === "Signed"
}

export interface EmployeeProfile {
  employeeCode: string;   // ej. "EMP-0142"
  fullName: string;
  email: string;
  position?: string;
}