import type { EmployeePayslip } from "../types/payslip";

export async function fetchMyPayslips(): Promise<EmployeePayslip[]> {
  const res = await fetch("/api/payslips", {
    credentials: "include",
  });

  if (!res.ok) {
    throw new Error("No se pudieron cargar las boletas");
  }

  const data = await res.json();
  return data.payslips;
}