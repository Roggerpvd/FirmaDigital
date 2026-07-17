import bcrypt from "bcryptjs";

const password = process.argv[2];

if (!password) {
  console.error("Uso: node scripts/hash-password.mjs \"tu-contraseña\"");
  process.exit(1);
}

const hash = bcrypt.hashSync(password, 10);
console.log("\nHash generado:\n");
console.log(hash);
console.log("\nCopia ese hash completo para el siguiente paso.\n");