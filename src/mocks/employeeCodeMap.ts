// Mapeo temporal para conectar los documentos del admin (que usan email)
// con los perfiles de empleado (que usan employeeCode).
// Cuando conectes un backend real, esto ya no será necesario:
// la boleta vendrá con el employeeCode directamente.
export const EMAIL_TO_EMPLOYEE_CODE: Record<string, string> = {
  "maria.quispe@empresa.pe": "EMP-0142",
  "carlos.torres@empresa.pe": "EMP-0138",
  "jorge.mamani@empresa.pe": "EMP-0151",
};