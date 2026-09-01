// src/pages/AppGate.tsx

import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import type { Session } from "../types/session";
import type { EmployeePayslip } from "../types/payslip";
import { fetchCurrentSession } from "../api/auth";
import { fetchMyPayslips } from "../api/payslips";
import AdminDashboard from "./AdminDashboard";
import EmployeeDashboard from "./EmployeeDashboard";
import ForcePasswordChange from "./ForcePasswordChange";
import LoadingLogo from "../components/LoadingLogo";

function AppGate() {
  const [session, setSession] = useState<Session | null | "loading">("loading");
  const [payslips, setPayslips] = useState<EmployeePayslip[]>([]);
  const [payslipsLoading, setPayslipsLoading] = useState(false);

  useEffect(() => {
    fetchCurrentSession().then(setSession);
  }, []);

  useEffect(() => {
    if (session !== "loading" && session !== null && session.role === "employee") {
      setPayslipsLoading(true);
      fetchMyPayslips()
        .then(setPayslips)
        .finally(() => setPayslipsLoading(false));
    }
  }, [session]);

  if (session === "loading") {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <LoadingLogo />
      </div>
    );
  }

  if (session === null) {
    return <Navigate to="/login" replace />;
  }

  if (session.role === "admin") {
    return <AdminDashboard adminFullName={session.fullName} />;
  }

  // Bloqueo de no-repudio: mientras el empleado no reemplace la contraseña
  // temporal creada por el admin, no ve boletas ni puede firmar nada.
  // (El bloqueo real, a prueba de manipulación desde el navegador, vive en
  // el backend; esto solo evita que el empleado tenga que descubrirlo
  // a través de un error al intentar firmar.)
  if (session.requiresPasswordChange) {
    return (
      <ForcePasswordChange
        email={session.email}
        onChanged={() => {
          setSession("loading");
          fetchCurrentSession().then(setSession);
        }}
      />
    );
  }

  if (payslipsLoading) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <LoadingLogo />
      </div>
    );
  }

  return (
    <EmployeeDashboard
      employee={{
        employeeCode: session.employeeCode,
        fullName: session.fullName,
        email: session.email,
        position: session.position ?? undefined,
      }}
      initialPayslips={payslips}
    />
  );
}

export default AppGate;