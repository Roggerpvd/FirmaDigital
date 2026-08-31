// api/_lib/signaturePlacement.ts
// Coordenadas compartidas para colocar firmas dentro del PDF de la boleta.
// En PDF, el origen (0,0) está en la esquina INFERIOR izquierda de la página.
// Ambas firmas (empleado y empleador) usan la misma altura (SIGNATURE_Y) para
// quedar alineadas visualmente, una a cada lado de la página.

// Firma del empleado (derecha). Se coloca al momento de firmar (sign.ts).
export const SIGNATURE_X = 360;
export const SIGNATURE_Y = 100;
export const SIGNATURE_WIDTH = 180;
export const SIGNATURE_HEIGHT = 70;

// Firma del empleador (izquierda). Se coloca al momento de subir la boleta
// (payslips.ts), pegada al margen izquierdo, a la misma altura (SIGNATURE_Y)
// que la firma del empleado.
export const EMPLOYER_SIGNATURE_X = 40;
export const EMPLOYER_SIGNATURE_Y = SIGNATURE_Y;
export const EMPLOYER_SIGNATURE_WIDTH = SIGNATURE_WIDTH;
export const EMPLOYER_SIGNATURE_HEIGHT = SIGNATURE_HEIGHT;

// Texto debajo de cada firma.
export const SIGNATURE_TEXT_SIZE = 8;
export const SIGNATURE_TEXT_GAP = 12; // separación entre el borde inferior de la firma y la primera línea de texto
export const SIGNATURE_TEXT_LINE_HEIGHT = 10;

// Texto que va debajo de la firma del empleador (una línea por elemento del array).
export const EMPLOYER_SIGNATURE_LABEL_LINES = [
  "Isabel Maria Manchego Rodríguez",
  "Gerente General",
];
