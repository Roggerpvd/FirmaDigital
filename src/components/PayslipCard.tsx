import { Link } from "react-router-dom";
import type { EmployeePayslip } from "../types/payslip";

interface PayslipCardProps {
  payslip: EmployeePayslip;
  onDownload: (payslip: EmployeePayslip) => void;
}

function PayslipCard({ payslip, onDownload }: PayslipCardProps) {
  const isSigned = payslip.status === "Signed";

  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-lg shadow-sm flex items-center justify-between gap-md">
      <div className="flex items-center gap-md min-w-0">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${isSigned ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"}`}>
          <span className="material-symbols-outlined text-[20px]">
            {isSigned ? "task_alt" : "schedule"}
          </span>
        </div>
        <div className="min-w-0">
          <p className="font-body-md text-body-md font-semibold text-primary truncate">{payslip.period}</p>
          <p className="text-[12px] text-on-surface-variant font-data-mono">{payslip.id}</p>
          <p className="text-[12px] text-on-surface-variant">
            {isSigned ? `Firmado el ${payslip.signedDate}` : `Emitido el ${payslip.issueDate}`}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-sm shrink-0">
        {isSigned ? (
          <button
            onClick={() => onDownload(payslip)}
            className="text-[12px] font-semibold text-primary hover:underline flex items-center gap-xs"
          >
            <span className="material-symbols-outlined text-[16px]">download</span>
            Descargar
          </button>
        ) : (
          <Link
            to={`/firmar/${payslip.id}`}
            className="bg-primary text-on-primary px-md py-xs rounded-lg text-[12px] font-semibold hover:opacity-90 active:scale-95 transition-all flex items-center gap-xs"
          >
            <span className="material-symbols-outlined text-[16px]">draw</span>
            Firmar
          </Link>
        )}
      </div>
    </div>
  );
}

export default PayslipCard;