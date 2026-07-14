const STORAGE_KEY = "signed_payslips";

// Devuelve el set de IDs de boletas firmadas guardadas localmente
function getSignedIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function saveSignedIds(ids: Set<string>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(ids)));
}

export function isPayslipSigned(payslipId: string): boolean {
  return getSignedIds().has(payslipId);
}

export function markPayslipAsSigned(payslipId: string) {
  const ids = getSignedIds();
  ids.add(payslipId);
  saveSignedIds(ids);
}