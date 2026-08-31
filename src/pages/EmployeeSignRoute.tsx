// src/pages/EmployeeSignRoute.tsx

import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import EmployeeSignPortal from "./EmployeeSignPortal";
import LoadingLogo from "../components/LoadingLogo";

interface PayslipDetail {
  id: string;
  employeeName: string;
  employeeCode: string;
  period: string;
  netAmount: string;
  issueDate: string;
  status: string;
  hasPdf: boolean;
  viewUrl?: string;
}

function EmployeeSignRoute() {
  const { payslipId } = useParams<{ payslipId: string }>();
  const [payslip, setPayslip] = useState<PayslipDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!payslipId) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    fetch(`/api/payslips/${payslipId}`, { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error("No encontrada");
        return res.json();
      })
      .then((data) => setPayslip(data))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [payslipId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <LoadingLogo />
      </div>
    );
  }

  if (notFound || !payslip) {
    return (
      <div className="min-h-screen bg-transparent text-on-surface flex items-center justify-center p-md">
        <div className="max-w-sm text-center bg-surface-container-lowest/10 backdrop-blur-md border border-outline-variant rounded-xl p-xl shadow-sm">
          <span className="material-symbols-outlined text-[40px] text-outline opacity-40 mb-md">error</span>
          <h2 className="font-headline-sm text-headline-sm text-primary font-bold mb-xs">Boleta no encontrada</h2>
          <p className="text-[13px] text-on-surface-variant mb-lg">
            El enlace de firma no es válido, ya fue procesada, o no tienes acceso a ella.
          </p>
          <Link to="/" className="text-primary text-[13px] font-semibold hover:underline">Volver al inicio</Link>
        </div>
      </div>
    );
  }

  return <EmployeeSignPortal payslip={payslip} />;
}

export default EmployeeSignRoute;