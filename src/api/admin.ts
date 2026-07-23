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

export async function deleteAdminEmployee(employeeCode: string): Promise<void> {
  const res = await fetch(`/api/admin/employees?employeeCode=${encodeURIComponent(employeeCode)}`, {
    method: "DELETE",
    credentials: "include",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "No se pudo eliminar el empleado");
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

export async function fetchPayslipProof(payslipCode: string): Promise<string> {
  const res = await fetch(`/api/admin/payslips/${payslipCode}/proof`, { credentials: "include" });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "No se pudo obtener el comprobante");
  return data.proofImageUrl;
}

export async function uploadAdminPayslip(payload: {
  employeeEmail: string;
  pdfBase64: string;
}): Promise<{ payslipCode: string; period: string; issueDate: string }> {
  const res = await fetch("/api/admin/payslips-action", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "No se pudo subir la boleta");
  return { payslipCode: data.payslipCode, period: data.period, issueDate: data.issueDate };
}

export const downloadAdminPayslip = async (payslipCode: string, signed = false) => {
  const response = await fetch(
    `/api/admin/payslips-action?payslipCode=${encodeURIComponent(payslipCode)}${signed ? "&signed=true" : ""}`,
    { credentials: "include" }
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: "Error al descargar" }));
    throw new Error(err.error || "Error al descargar el PDF");
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${payslipCode}${signed ? "-firmada" : ""}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};