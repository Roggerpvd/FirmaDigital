export type PayslipStatus = "Signed" | "Pending";

export interface EmployeePayslip {
  id: string;           // ej. "BP-2026-014"
  period: string;        // ej. "Julio 2026"
  netAmount: string;      // ej. "S/ 2,850.00"
  issueDate: string;      // ej. "13 jul 2026"
  status: PayslipStatus;
  signedDate?: string;    // solo si status === "Signed"
  // Datos de auditoría de la firma (solo presentes si status === "Signed").
  documentHash?: string;  // SHA-256 del PDF firmado
  signedIp?: string;
  signedUserAgent?: string;
}

export interface EmployeeProfile {
  employeeCode: string;   // ej. "EMP-0142"
  fullName: string;
  email: string;
  position?: string;
}