// src/pages/AppGate.tsx

import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import type { Session } from "../types/session";
import type { EmployeePayslip } from "../types/payslip";
import { fetchCurrentSession } from "../api/auth";
import { fetchMyPayslips } from "../api/payslips";
import AdminDashboard from "./AdminDashboard";
import EmployeeDashboard from "./EmployeeDashboard";

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
        <div className="w-8 h-8 border-4 border-outline-variant border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  if (session === null) {
    return <Navigate to="/login" replace />;
  }

  if (session.role === "admin") {
    return <AdminDashboard />;
  }

  if (payslipsLoading) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-outline-variant border-t-primary rounded-full animate-spin"></div>
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