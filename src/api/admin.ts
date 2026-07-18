export interface AdminDocument {
  id: string;
  name: string;
  payslipId: string;
  status: "Signed" | "Pending";
  date: string;
  email: string;
}

export interface AdminEmployee {
  employee_code: string;
  full_name: string;
  email: string;
  position: string | null;
  created_at: string;
}

export async function fetchAdminDocuments(): Promise<AdminDocument[]> {
  const res = await fetch("/api/admin/payslips", { credentials: "include" });
  if (!res.ok) throw new Error("No se pudieron cargar las boletas");
  const data = await res.json();
  return data.documents;
}

export async function fetchAdminEmployees(): Promise<AdminEmployee[]> {
  const res = await fetch("/api/admin/employees", { credentials: "include" });
  if (!res.ok) throw new Error("No se pudieron cargar los empleados");
  const data = await res.json();
  return data.employees;
}

export async function createAdminEmployee(payload: {
  employeeCode: string;
  fullName: string;
  email: string;
  position?: string;
}): Promise<{ employee: AdminEmployee; temporaryPassword: string }> {
  const res = await fetch("/api/admin/employees", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "No se pudo crear el empleado");
  return data;
}

export async function createAdminPayslip(payload: {
  employeeEmail: string;
  payslipCode: string;
  period: string;
  netAmount: number;
  issueDate: string;
  status: "pending" | "signed";
}): Promise<void> {
  const res = await fetch("/api/admin/payslips", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "No se pudo crear la boleta");
}