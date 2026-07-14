import type { EmployeePayslip, EmployeeProfile } from "../types/payslip";

export function downloadPayslipProof(employee: EmployeeProfile, payslip: EmployeePayslip) {
  const canvas = document.createElement("canvas");
  canvas.width = 700;
  canvas.height = 380;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "#c6c6cd";
  ctx.lineWidth = 2;
  ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);

  ctx.fillStyle = "#191c1e";
  ctx.font = "bold 22px Inter, sans-serif";
  ctx.fillText("Boleta de Pago — Firmada Digitalmente", 50, 70);

  ctx.font = "14px Inter, sans-serif";
  ctx.fillStyle = "#45464d";
  const lines = [
    `ID de Boleta: ${payslip.id}`,
    `Empleado: ${employee.fullName} (${employee.employeeCode})`,
    `Período: ${payslip.period}`,
    `Neto a pagar: ${payslip.netAmount}`,
    `Fecha de emisión: ${payslip.issueDate}`,
    `Firmado el: ${payslip.signedDate ?? "—"}`,
  ];
  lines.forEach((line, i) => ctx.fillText(line, 50, 115 + i * 26));

  const link = document.createElement("a");
  link.href = canvas.toDataURL("image/png");
  link.download = `${payslip.id}_comprobante.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}