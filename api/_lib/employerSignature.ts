// api/_lib/employerSignature.ts
//
// Pega aquí el string base64 de la imagen de la firma del empleador
// (PNG, idealmente con fondo transparente), SIN el prefijo
// "data:image/png;base64,".
//
// Cómo generarlo:
//   - En Mac/Linux, en una terminal, parado en la carpeta donde está la imagen:
//       base64 -i firma-empleador.png | tr -d '\n' > firma-base64.txt
//     y copia el contenido de firma-base64.txt aquí abajo.
//   - En Windows (PowerShell):
//       [Convert]::ToBase64String([IO.File]::ReadAllBytes("firma-empleador.png")) | Set-Content firma-base64.txt
//   - O simplemente sube la imagen en el chat y pide que la conviertan por ti.
//
// Mientras este valor esté vacío (""), el sistema sigue funcionando normal:
// simplemente no se coloca ninguna firma de empleador al subir boletas.
export const EMPLOYER_SIGNATURE_BASE64 = "";
