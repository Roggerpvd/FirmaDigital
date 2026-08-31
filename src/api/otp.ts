export interface RequestOtpResult {
  success: boolean;
  maskedEmail?: string;
  expiresInSeconds?: number;
  error?: string;
}

export async function requestSignatureOtp(payslipCode: string): Promise<RequestOtpResult> {
  const res = await fetch(`/api/payslips/${payslipCode}/request-otp`, {
    method: "POST",
    credentials: "include",
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    return { success: false, error: data.error || "No se pudo enviar el código" };
  }

  return {
    success: true,
    maskedEmail: data.maskedEmail,
    expiresInSeconds: data.expiresInSeconds,
  };
}
