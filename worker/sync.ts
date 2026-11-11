/**
 * Sincronizador manual: npm run sync            → año en curso (y el anterior en enero–febrero)
 *                       npm run sync -- 2025    → un año específico
 * Lee las variables de .env.local; sin ellas escribe en datos/almacen.json.
 */
import { config } from "dotenv";
config({ path: [".env.local", ".env"], quiet: true });
import { almacen } from "../src/lib/almacen";
import { aniosPorDefecto, sincronizar } from "../src/lib/sincronizar";

async function main() {
  const arg = Number(process.argv[2]);
  const anios = arg ? [arg] : aniosPorDefecto();
  const alm = almacen();
  console.log(`Almacén: ${alm.tipo} · años: ${anios.join(", ")}`);
  const t0 = Date.now();
  const r = await sincronizar(alm, anios);
  console.log(`Listo en ${Math.round((Date.now() - t0) / 1000)} s · estado: ${r.estado} · ${r.detalle || "sin novedades"}`);
  if (r.estado === "error") process.exit(1);
}

main();
