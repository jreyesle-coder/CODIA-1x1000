/**
 * Sincronizador: npm run sync            → año en curso (y el anterior en enero–febrero)
 *                npm run sync -- 2025    → un año específico
 */
import { config } from "dotenv";
config({ path: [".env.local", ".env"], quiet: true });
import { almacen } from "../src/lib/almacen";
import { sincronizar } from "../src/lib/sincronizar";

async function main() {
  const hoy = new Date();
  const arg = Number(process.argv[2]);
  const anios = arg ? [arg] : hoy.getMonth() < 2 ? [hoy.getFullYear() - 1, hoy.getFullYear()] : [hoy.getFullYear()];
  const alm = almacen();
  console.log(`Almacén: ${alm.tipo} · años: ${anios.join(", ")}`);
  const r = await sincronizar(alm, anios);
  console.log(`Listo: ${r.nuevos.length} meses actualizados, ${r.sinCambios} sin cambios, ${r.errores.length} errores`);
  for (const e of r.errores) console.error("  ✗ " + e);
  if (r.errores.length) process.exit(1);
}

main();
