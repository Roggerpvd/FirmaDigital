export interface AdminSession {
  role: "admin";
  fullName: string;
  email: string;
}

export interface EmployeeSession {
  role: "employee";
  employeeCode: string;
  fullName: string;
  email: string;
  position: string | null;
}

export type Session = AdminSession | EmployeeSession;