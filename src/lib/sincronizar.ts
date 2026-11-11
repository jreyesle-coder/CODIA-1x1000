/** Descarga los meses publicados y guarda solo los que son nuevos o cambiaron. */
import { createHash } from "node:crypto";
import { listarArchivos, descargar, MESES, type ArchivoTN } from "./tesoreria";
import { leerArchivo } from "./lector";
import type { Almacen } from "./almacen";

export interface ResultadoSync { nuevos: string[]; sinCambios: number; errores: string[]; pendientes: string[] }
export interface OpcionesSync {
  /** Tiempo máximo de trabajo; lo que no alcance queda en `pendientes` para la próxima corrida. */
  limiteMs?: number;
  log?: (m: string) => void;
}

/** Año en curso; en enero y febrero también el anterior, por si la Tesorería aún publica diciembre. */
export function aniosPorDefecto(hoy = new Date()): number[] {
  return hoy.getMonth() < 2 ? [hoy.getFullYear() - 1, hoy.getFullYear()] : [hoy.getFullYear()];
}

export async function sincronizar(alm: Almacen, anios: number[], opciones: OpcionesSync = {}): Promise<ResultadoSync> {
  const { limiteMs = Infinity, log = console.log } = opciones;
  const t0 = Date.now();
  const inicio = new Date().toISOString();
  const res: ResultadoSync = { nuevos: [], sinCambios: 0, errores: [], pendientes: [] };
  try {
    const guardados = new Map((await alm.archivos()).map((a) => [`${a.anio}-${a.mes}`, a]));
    for (const anio of anios) {
      const porMes = new Map<number, ArchivoTN[]>();
      for (const a of await listarArchivos(anio)) porMes.set(a.mes, [...(porMes.get(a.mes) ?? []), a]);
      log(`${anio}: ${porMes.size} meses publicados`);
      for (const [mes, candidatos] of porMes) {
        const etiqueta = `${MESES[mes - 1]} ${anio}`;
        if (Date.now() - t0 > limiteMs) { res.pendientes.push(etiqueta); continue; }
        let hecho = false;
        for (const c of candidatos) {
          let buf: Buffer;
          try { buf = await descargar(c); } catch { continue; } // copia en otro formato: probar la siguiente
          const sha256 = createHash("sha256").update(buf).digest("hex");
          if (guardados.get(`${anio}-${mes}`)?.sha256 === sha256) { res.sinCambios++; hecho = true; break; }
          const filas = await leerArchivo(buf, anio, mes);
          const rd = filas.filter((f) => f.moneda === "RD");
          if (rd.length === 0) throw new Error(`${etiqueta}: el archivo no trae pagos de OBRAS en RD$`);
          await alm.reemplazarMes({
            anio, mes, phoca_id: c.phocaId, titulo: c.titulo, url: c.url, sha256,
            filas_obras: filas.length, descargado_en: new Date().toISOString(),
          }, filas);
          const bruto = rd.reduce((s, f) => s + f.monto_bruto, 0);
          log(`  ✓ ${etiqueta}: ${rd.length} pagos OBRAS RD$, bruto RD$${bruto.toLocaleString("en-US", { maximumFractionDigits: 0 })}`);
          res.nuevos.push(etiqueta);
          hecho = true;
          break;
        }
        if (!hecho) res.errores.push(`${etiqueta}: ningún archivo publicado se pudo abrir como Excel`);
      }
    }
  } catch (e) {
    res.errores.push((e as Error).message);
  }
  const estado = res.errores.length ? "error" : res.nuevos.length ? "ok" : "sin_cambios";
  const detalle = [
    res.nuevos.length ? `Actualizados: ${res.nuevos.join(", ")}` : "",
    res.sinCambios ? `${res.sinCambios} meses sin cambios` : "",
    res.pendientes.length ? `Pendientes para la próxima corrida: ${res.pendientes.join(", ")}` : "",
    ...res.errores,
  ].filter(Boolean).join(" · ");
  try {
    await alm.registrarSync({ inicio, fin: new Date().toISOString(), estado, detalle: detalle || null });
  } catch (e) {
    res.errores.push(`No se pudo registrar la corrida: ${(e as Error).message}`);
  }
  return res;
}
