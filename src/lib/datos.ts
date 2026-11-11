import "server-only";
import { almacen, ErrorConfiguracion, type ArchivoGuardado, type Sincronizacion } from "./almacen";
import type { PagoObra } from "./lector";

export interface Datos {
  faltan: null;
  anio: number;
  anios: number[];
  archivos: ArchivoGuardado[];
  ultimaSync: Sincronizacion | null;
  rd: PagoObra[];
  divisas: PagoObra[];
}

/** El servidor no tiene las variables de entorno: la página dice cuáles faltan. */
export interface SinConfigurar { faltan: string[] }

/** Carga todo lo que necesita una página para un año. */
export async function cargar(anioPedido?: string): Promise<Datos | SinConfigurar> {
  let alm;
  try {
    alm = almacen();
  } catch (e) {
    if (e instanceof ErrorConfiguracion) return { faltan: e.faltan };
    throw e;
  }
  const [archivos, ultimaSync] = await Promise.all([alm.archivos(), alm.ultimaSync()]);
  const anios = [...new Set(archivos.map((a) => a.anio))].sort((a, b) => b - a);
  const anio = anios.includes(Number(anioPedido)) ? Number(anioPedido) : (anios[0] ?? new Date().getFullYear());
  const pagos = await alm.pagos(anio);
  return {
    faltan: null,
    anio,
    anios,
    archivos: archivos.filter((a) => a.anio === anio),
    ultimaSync,
    rd: pagos.filter((p) => p.moneda === "RD"),
    divisas: pagos.filter((p) => p.moneda !== "RD"),
  };
}

export const rd = (n: number) => "RD$" + Math.round(n).toLocaleString("en-US");
export const num = (n: number) => Math.round(n).toLocaleString("en-US");
export const pct = (n: number) => (n * 100).toFixed(1) + "%";
export const millones = (n: number) => (n / 1e6).toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 }) + " M";
export const fechaHora = (iso: string) =>
  new Date(iso).toLocaleString("es-DO", { timeZone: "America/Santo_Domingo", dateStyle: "long", timeStyle: "short" });
