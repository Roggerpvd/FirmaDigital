import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";

interface PayslipData {
  id: string;
  employeeName: string;
  employeeCode: string;
  period: string;
  netAmount: string;
  issueDate: string;
}

const MOCK_PAYSLIP: PayslipData = {
  id: "BP-2026-014",
  employeeName: "María Fernanda Quispe",
  employeeCode: "EMP-0142",
  period: "Julio 2026",
  netAmount: "S/ 2,850.00",
  issueDate: "13 jul 2026",
};

type SignMode = "draw" | "upload";
type FlowStep = "review" | "signing" | "confirm" | "submitting" | "success";

interface EmployeeSignPortalProps {
  payslip?: PayslipData;
}

function EmployeeSignPortal({ payslip = MOCK_PAYSLIP }: EmployeeSignPortalProps) {
  const [step, setStep] = useState<FlowStep>("review");
  const [signMode, setSignMode] = useState<SignMode>("draw");
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [canvasIsEmpty, setCanvasIsEmpty] = useState(true);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [signedAt, setSignedAt] = useState<string>("");

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);

  // Prepara el canvas (tamaño real en píxeles según su tamaño en pantalla, para que no se vea borroso)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.scale(ratio, ratio);
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#191c1e";
    }
  }, [step, signMode]);

  const getPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    isDrawing.current = true;
    lastPoint.current = getPoint(e);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !lastPoint.current) return;
    const point = getPoint(e);
    ctx.beginPath();
    ctx.moveTo(lastPoint.current.x, lastPoint.current.y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    lastPoint.current = point;
    setCanvasIsEmpty(false);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    isDrawing.current = false;
    lastPoint.current = null;
    const canvas = canvasRef.current;
    if (canvas) canvas.releasePointerCapture(e.pointerId);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setCanvasIsEmpty(true);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "image/png") {
      setUploadError("Solo se admiten archivos PNG.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setUploadError("La imagen no debe superar los 2MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setSignatureDataUrl(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleContinueToConfirm = () => {
    if (signMode === "draw") {
      const canvas = canvasRef.current;
      if (canvas && !canvasIsEmpty) {
        setSignatureDataUrl(canvas.toDataURL("image/png"));
      }
    }
    setStep("confirm");
  };

  const canContinue = signMode === "draw" ? !canvasIsEmpty : !!signatureDataUrl;


// ...

const handleSubmit = async () => {
    setStep("submitting");

    try {
      const canvas = canvasRef.current;
      const finalSignature = signMode === "draw" && canvas ? canvas.toDataURL("image/png") : signatureDataUrl;

      const res = await fetch(`/api/payslips/${payslip.id}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ signatureDataUrl: finalSignature }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "No se pudo firmar la boleta");
        setStep("confirm");
        return;
      }

      setSignedAt(data.signedAt);
      setStep("success");
    } catch {
      alert("No se pudo conectar con el servidor");
      setStep("confirm");
    }
  };

  const handleDownloadProof = () => {
    if (!signatureDataUrl) return;
    const canvas = document.createElement("canvas");
    canvas.width = 700;
    canvas.height = 500;
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
      `Empleado: ${payslip.employeeName} (${payslip.employeeCode})`,
      `Período: ${payslip.period}`,
      `Neto a pagar: ${payslip.netAmount}`,
      `Fecha de emisión: ${payslip.issueDate}`,
      `Firmado el: ${signedAt}`,
    ];
    lines.forEach((line, i) => ctx.fillText(line, 50, 115 + i * 26));

    ctx.font = "12px Inter, sans-serif";
    ctx.fillStyle = "#76777d";
    ctx.fillText("Firma del empleado:", 50, 300);
    ctx.strokeStyle = "#c6c6cd";
    ctx.strokeRect(50, 315, 280, 120);

    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 60, 325, 260, 100);
      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      link.download = `${payslip.id}_firmada.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };
    img.src = signatureDataUrl;
  };

  const getInitials = (name: string) => {
    const parts = name.split(" ");
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div className="min-h-screen bg-background text-on-surface flex items-center justify-center p-md">
      <div className="w-full max-w-lg">

        {/* Encabezado del empleado */}
        <div className="flex items-center gap-md mb-lg">
          <div className="w-12 h-12 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center font-bold">
            {getInitials(payslip.employeeName)}
          </div>
          <div>
            <p className="font-body-md text-body-md font-semibold text-primary">{payslip.employeeName}</p>
            <p className="text-[12px] text-on-surface-variant">{payslip.employeeCode}</p>
          </div>
        </div>

        {/* Paso: revisión de la boleta */}
        {step === "review" && (
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-xl shadow-sm">
            <div className="flex items-center justify-between mb-lg">
              <h2 className="font-headline-md text-headline-md text-primary">Tu Boleta de Pago</h2>
              <div className="inline-flex items-center gap-sm px-md py-xs rounded-full bg-amber-50 text-amber-700 text-label-md font-semibold border border-amber-100">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                Pendiente
              </div>
            </div>

            <div className="space-y-sm bg-surface-container-low rounded-lg p-lg mb-lg">
              <div className="flex justify-between text-[13px]">
                <span className="text-on-surface-variant">ID de Boleta</span>
                <span className="font-data-mono text-data-mono text-primary">{payslip.id}</span>
              </div>
              <div className="flex justify-between text-[13px]">
                <span className="text-on-surface-variant">Período</span>
                <span className="text-primary font-medium">{payslip.period}</span>
              </div>
              <div className="flex justify-between text-[13px]">
                <span className="text-on-surface-variant">Fecha de emisión</span>
                <span className="text-primary font-medium">{payslip.issueDate}</span>
              </div>
              <div className="flex justify-between text-[13px] pt-sm border-t border-outline-variant">
                <span className="text-on-surface-variant font-semibold">Neto a pagar</span>
                <span className="text-primary font-bold text-[16px]">{payslip.netAmount}</span>
              </div>
            </div>

            <p className="text-[12px] text-on-surface-variant mb-lg leading-relaxed">
              Al firmar digitalmente, confirmas que has revisado el contenido de esta boleta de pago y aceptas su validez legal como comprobante firmado.
            </p>

            <button
              onClick={() => setStep("signing")}
              className="w-full bg-primary text-on-primary px-lg py-md rounded-lg font-body-md text-body-md hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-sm shadow-sm"
            >
              <span className="material-symbols-outlined text-[20px]">draw</span>
              Firmar de Manera Digital
            </button>
          </div>
        )}

        {/* Paso: captura de firma */}
        {step === "signing" && (
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-xl shadow-sm">
            <div className="flex items-center justify-between mb-lg">
              <h2 className="font-headline-sm text-headline-sm text-primary font-bold">Firma tu Boleta</h2>
              <button onClick={() => setStep("review")} className="material-symbols-outlined text-outline hover:text-primary transition-colors">close</button>
            </div>

            {/* Tabs de método de firma */}
            <div className="flex gap-sm mb-lg bg-surface-container-low rounded-lg p-xs">
              <button
                onClick={() => { setSignMode("draw"); setUploadError(null); }}
                className={`flex-1 py-sm rounded-md text-[13px] font-semibold transition-colors flex items-center justify-center gap-xs ${signMode === "draw" ? "bg-surface-container-lowest text-primary shadow-sm" : "text-on-surface-variant"}`}
              >
                <span className="material-symbols-outlined text-[18px]">draw</span>
                Dibujar firma
              </button>
              <button
                onClick={() => { setSignMode("upload"); }}
                className={`flex-1 py-sm rounded-md text-[13px] font-semibold transition-colors flex items-center justify-center gap-xs ${signMode === "upload" ? "bg-surface-container-lowest text-primary shadow-sm" : "text-on-surface-variant"}`}
              >
                <span className="material-symbols-outlined text-[18px]">upload_file</span>
                Subir imagen PNG
              </button>
            </div>

            {signMode === "draw" ? (
              <div>
                <p className="text-[12px] text-on-surface-variant mb-sm">Usa el mouse o tu dedo para firmar dentro del recuadro.</p>
                <div className="relative">
                  <canvas
                    ref={canvasRef}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerLeave={handlePointerUp}
                    className="w-full h-56 bg-surface-container-low border-2 border-dashed border-outline-variant rounded-lg touch-none cursor-crosshair"
                  />
                  {canvasIsEmpty && (
                    <p className="absolute inset-0 flex items-center justify-center text-on-surface-variant text-[13px] pointer-events-none opacity-50">
                      Firma aquí
                    </p>
                  )}
                </div>
                <button
                  onClick={clearCanvas}
                  className="mt-sm text-[12px] font-semibold text-primary hover:underline flex items-center gap-xs"
                >
                  <span className="material-symbols-outlined text-[16px]">refresh</span>
                  Limpiar firma
                </button>
              </div>
            ) : (
              <div>
                <p className="text-[12px] text-on-surface-variant mb-sm">Sube una imagen PNG de tu firma (fondo transparente recomendado, máx. 2MB).</p>
                {!signatureDataUrl ? (
                  <label className="custom-dashed h-56 rounded-lg flex flex-col items-center justify-center gap-sm cursor-pointer hover:bg-surface-container-low transition-colors relative">
                    <input type="file" accept="image/png" onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                    <span className="material-symbols-outlined text-[40px] text-outline opacity-40">image</span>
                    <p className="text-[13px] text-on-surface-variant">Haz clic para seleccionar tu firma (.png)</p>
                  </label>
                ) : (
                  <div className="h-56 bg-surface-container-low border border-outline-variant rounded-lg flex items-center justify-center relative p-md">
                    <img src={signatureDataUrl} alt="Firma cargada" className="max-h-full max-w-full object-contain" />
                    <button
                      onClick={() => setSignatureDataUrl(null)}
                      className="absolute top-sm right-sm material-symbols-outlined text-[18px] text-outline hover:text-error bg-surface-container-lowest rounded-full p-xs"
                    >
                      close
                    </button>
                  </div>
                )}
                {uploadError && <p className="text-[12px] text-error mt-sm">{uploadError}</p>}
              </div>
            )}

            <button
              onClick={handleContinueToConfirm}
              disabled={!canContinue}
              className="w-full mt-lg bg-primary text-on-primary px-lg py-md rounded-lg font-body-md text-body-md hover:opacity-90 active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Continuar
            </button>
          </div>
        )}

        {/* Paso: confirmación final */}
        {step === "confirm" && signatureDataUrl && (
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-xl shadow-sm">
            <div className="flex items-center justify-between mb-lg">
              <h2 className="font-headline-sm text-headline-sm text-primary font-bold">Confirma tu Firma</h2>
              <button onClick={() => setStep("signing")} className="material-symbols-outlined text-outline hover:text-primary transition-colors">arrow_back</button>
            </div>

            <div className="bg-surface-container-low border border-outline-variant rounded-lg p-lg mb-lg flex items-center justify-center h-40">
              <img src={signatureDataUrl} alt="Vista previa de firma" className="max-h-full max-w-full object-contain" />
            </div>

            <div className="bg-surface-container-low rounded-lg p-md mb-lg text-[12px] text-on-surface-variant space-y-xs">
              <p><span className="font-semibold text-primary">Boleta:</span> {payslip.id} — {payslip.period}</p>
              <p><span className="font-semibold text-primary">Empleado:</span> {payslip.employeeName}</p>
            </div>

            <label className="flex items-start gap-sm mb-lg cursor-pointer">
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-1" />
              <span className="text-[12px] text-on-surface-variant leading-relaxed">
                Confirmo que esta es mi firma y autorizo firmar digitalmente esta boleta de pago, aceptando su validez legal como comprobante.
              </span>
            </label>

            <button
              onClick={handleSubmit}
              disabled={!agreed}
              className="w-full bg-primary text-on-primary px-lg py-md rounded-lg font-body-md text-body-md hover:opacity-90 active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-sm"
            >
              <span className="material-symbols-outlined text-[20px]">send</span>
              Enviar Boleta Firmada
            </button>
          </div>
        )}

        {/* Paso: enviando */}
        {step === "submitting" && (
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-xl shadow-sm flex flex-col items-center justify-center py-16">
            <div className="w-10 h-10 border-4 border-outline-variant border-t-primary rounded-full animate-spin mb-lg"></div>
            <p className="text-body-md font-body-md text-on-surface-variant">Enviando tu boleta firmada...</p>
          </div>
        )}

        {/* Paso: éxito */}
        {step === "success" && (
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-xl shadow-sm text-center">
            <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-lg">
              <span className="material-symbols-outlined text-[32px]">check_circle</span>
            </div>
            <h2 className="font-headline-sm text-headline-sm text-primary font-bold mb-xs">¡Boleta Firmada!</h2>
            <p className="text-[13px] text-on-surface-variant mb-lg">
              Tu boleta {payslip.id} fue firmada y enviada correctamente el {signedAt}.
            </p>
            <div className="flex flex-col gap-sm">
            <button
              onClick={handleDownloadProof}
              className="w-full bg-surface border border-outline-variant px-lg py-md rounded-lg font-body-md text-body-md text-primary hover:bg-surface-container transition-colors flex items-center justify-center gap-sm"
            >
              <span className="material-symbols-outlined text-[20px]">download</span>
              Descargar comprobante
            </button>
            <Link
              to="/mis-boletas"
              className="w-full text-center bg-primary text-on-primary px-lg py-md rounded-lg font-body-md text-body-md hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-sm"
            >
              <span className="material-symbols-outlined text-[20px]">arrow_back</span>
              Volver a Mis Boletas
            </Link>
          </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default EmployeeSignPortal;
