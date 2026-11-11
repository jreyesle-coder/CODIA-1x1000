/** Descarga los meses publicados y guarda solo los que son nuevos o cambiaron. */
import { createHash } from "node:crypto";
import { listarArchivos, descargar, MESES, type ArchivoTN, type ListadoTN } from "./tesoreria";
import { leerArchivo, type PagoObra } from "./lector";
import type { Almacen, ArchivoGuardado, EstadoSync } from "./almacen";

export interface ResultadoSync {
  estado: EstadoSync;
  detalle: string;
  nuevos: string[];
  sinCambios: number;
  errores: string[];
  pendientes: string[];
  avisos: string[];
}

/** Acceso al portal; se puede reemplazar en pruebas. */
export interface Portal {
  listar: (anio: number) => Promise<ListadoTN>;
  descargar: (a: ArchivoTN) => Promise<Buffer>;
  leer: (buf: Buffer, anio: number, mes: number) => Promise<PagoObra[]>;
}

export interface OpcionesSync {
  /** Tiempo máximo de trabajo; lo que no alcance queda en `pendientes` para la próxima corrida. */
  limiteMs?: number;
  log?: (m: string) => void;
  hoy?: Date;
  portal?: Partial<Portal>;
}

/** Año en curso; en enero y febrero también el anterior, por si la Tesorería aún publica diciembre. */
export function aniosPorDefecto(hoy = new Date()): number[] {
  return hoy.getMonth() < 2 ? [hoy.getFullYear() - 1, hoy.getFullYear()] : [hoy.getFullYear()];
}

const clave = (anio: number, mes: number) => `${anio}-${mes}`;
const mensaje = (e: unknown) => (e instanceof Error ? e.message : String(e));

export async function sincronizar(alm: Almacen, anios: number[], opciones: OpcionesSync = {}): Promise<ResultadoSync> {
  const { limiteMs = Infinity, log = console.log, hoy = new Date() } = opciones;
  const portal: Portal = { listar: listarArchivos, descargar, leer: leerArchivo, ...opciones.portal };
  const t0 = Date.now();
  const inicio = new Date().toISOString();
  const r = { nuevos: [] as string[], sinCambios: 0, errores: [] as string[], pendientes: [] as string[], avisos: [] as string[] };

  try {
    const guardados = new Map<string, ArchivoGuardado>((await alm.archivos()).map((a) => [clave(a.anio, a.mes), a]));
    for (const anio of anios) {
      let listado: ListadoTN;
      try {
        listado = await portal.listar(anio);
      } catch (e) {
        r.errores.push(`${anio}: no se pudo leer el portal de la Tesorería (${mensaje(e)})`);
        continue;
      }
      r.avisos.push(...listado.avisos.map((a) => `${anio}: ${a}`));
      const porMes = new Map<number, ArchivoTN[]>();
      for (const a of listado.archivos) porMes.set(a.mes, [...(porMes.get(a.mes) ?? []), a]);
      log(`${anio}: ${porMes.size} meses publicados`);
      if (porMes.size === 0) {
        // Un año que ya tenía meses, o el año en curso a partir de marzo, debe listar algo:
        // si no, el portal falló o cambió de formato, y eso no puede pasar por «al día».
        const deberiaTener = [...guardados.keys()].some((k) => k.startsWith(`${anio}-`)) || anio < hoy.getFullYear() || hoy.getMonth() >= 2;
        (deberiaTener ? r.errores : r.avisos).push(`${anio}: el portal no lista ningún mes (¿caído o cambió de formato?)`);
        continue;
      }
      // Meses nuevos primero, para que el límite de tiempo no los deje siempre al final.
      const meses = [...porMes.keys()].sort((a, b) =>
        Number(guardados.has(clave(anio, a))) - Number(guardados.has(clave(anio, b))) || a - b);
      for (const mes of meses) {
        const etiqueta = `${MESES[mes - 1]} ${anio}`;
        if (Date.now() - t0 > limiteMs) { r.pendientes.push(etiqueta); continue; }
        // Cada mes se trata por separado: un archivo defectuoso no frena a los demás.
        try {
          await procesarMes(portal, alm, guardados, anio, mes, porMes.get(mes)!, log, r);
        } catch (e) {
          r.errores.push(`${etiqueta}: ${mensaje(e)}`);
        }
      }
    }
  } catch (e) {
    r.errores.push(mensaje(e));
  }

  const estado: EstadoSync = r.errores.length ? "error" : r.pendientes.length || r.avisos.length ? "parcial" : r.nuevos.length ? "ok" : "sin_cambios";
  let detalle = [
    r.nuevos.length ? `Actualizados: ${r.nuevos.join(", ")}` : "",
    r.sinCambios ? `${r.sinCambios} meses sin cambios` : "",
    r.pendientes.length ? `Pendientes para la próxima corrida: ${r.pendientes.join(", ")}` : "",
    r.avisos.length ? `Avisos: ${r.avisos.join("; ")}` : "",
    r.errores.length ? `Errores: ${r.errores.join("; ")}` : "",
  ].filter(Boolean).join(" · ");
  try {
    await alm.registrarSync({ inicio, fin: new Date().toISOString(), estado, detalle: detalle || null });
  } catch (e) {
    const err = `No se pudo registrar la corrida: ${mensaje(e)}`;
    r.errores.push(err);
    detalle = detalle ? `${detalle} · ${err}` : err;
    return { ...r, estado: "error", detalle };
  }
  return { ...r, estado, detalle };
}

async function procesarMes(
  portal: Portal, alm: Almacen, guardados: Map<string, ArchivoGuardado>, anio: number, mes: number,
  candidatos: ArchivoTN[], log: (m: string) => void, r: { nuevos: string[]; sinCambios: number },
) {
  const k = clave(anio, mes);
  const etiqueta = `${MESES[mes - 1]} ${anio}`;
  let ultimoError = "";
  for (const c of candidatos) {
    let buf: Buffer;
    try {
      buf = await portal.descargar(c);
    } catch (e) {
      ultimoError = mensaje(e); // copia en otro formato o fallo de red: probar la siguiente
      continue;
    }
    const sha256 = createHash("sha256").update(buf).digest("hex");
    if (guardados.get(k)?.sha256 === sha256) { r.sinCambios++; return; }
    const filas = await portal.leer(buf, anio, mes);
    const rd = filas.filter((f) => f.moneda === "RD");
    if (rd.length === 0) throw new Error("el archivo no trae pagos de OBRAS en RD$");
    const archivo: ArchivoGuardado = {
      anio, mes, phoca_id: c.phocaId, titulo: c.titulo, url: c.url, sha256,
      filas_obras: filas.length, descargado_en: new Date().toISOString(),
    };
    await alm.reemplazarMes(archivo, filas);
    guardados.set(k, archivo);
    const bruto = rd.reduce((s, f) => s + f.monto_bruto, 0);
    log(`  ✓ ${etiqueta}: ${rd.length} pagos OBRAS RD$, bruto RD$${bruto.toLocaleString("en-US", { maximumFractionDigits: 0 })}`);
    r.nuevos.push(etiqueta);
    return;
  }
  throw new Error(`ningún archivo publicado se pudo abrir como Excel${ultimoError ? ` (último error: ${ultimoError})` : ""}`);
}
