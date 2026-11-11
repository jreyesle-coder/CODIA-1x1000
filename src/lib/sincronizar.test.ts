import { describe, expect, it } from "vitest";
import { sincronizar } from "./sincronizar";
import type { Almacen, ArchivoGuardado, Sincronizacion } from "./almacen";
import type { PagoObra } from "./lector";
import type { ArchivoTN, ListadoTN } from "./tesoreria";

/** Almacén en memoria con la misma interfaz que el real. */
function memoria() {
  const m = {
    tipo: "local" as const,
    archivosG: [] as ArchivoGuardado[],
    pagosG: [] as PagoObra[],
    syncs: [] as Sincronizacion[],
    async archivos() { return m.archivosG; },
    async reemplazarMes(a: ArchivoGuardado, filas: PagoObra[]) {
      m.pagosG = m.pagosG.filter((p) => !(p.anio === a.anio && p.mes === a.mes)).concat(filas);
      m.archivosG = m.archivosG.filter((x) => !(x.anio === a.anio && x.mes === a.mes)).concat(a);
    },
    async pagos(anio: number) { return m.pagosG.filter((p) => p.anio === anio); },
    async registrarSync(s: Sincronizacion) { m.syncs.push(s); },
    async ultimaSync() { return m.syncs.at(-1) ?? null; },
  };
  return m satisfies Almacen;
}

const archivo = (mes: number, id = mes * 10): ArchivoTN => ({ anio: 2026, mes, phocaId: id, titulo: `t${mes}`, url: `u${mes}` });
const pago = (mes: number): PagoObra => ({
  anio: 2026, mes, moneda: "RD", fecha: null, institucion: "X", unidad_ejecutora: null, libramiento: null,
  proveedor: null, concepto: null, monto_bruto: 100, retencion: 0, monto_neto: 100, cesion: false,
});
const portal = (listado: ListadoTN, opts: { fallaMes?: number } = {}) => ({
  listar: async () => listado,
  descargar: async (a: ArchivoTN) => Buffer.from(`contenido-${a.mes}`),
  leer: async (_b: Buffer, _a: number, mes: number) => {
    if (mes === opts.fallaMes) throw new Error("falta la columna «MONTO BRUTO»");
    return [pago(mes)];
  },
});
const silencio = { log: () => {} };

describe("sincronizar", () => {
  it("guarda los meses nuevos y registra 'ok'", async () => {
    const alm = memoria();
    const r = await sincronizar(alm, [2026], { ...silencio, portal: portal({ archivos: [archivo(1), archivo(2)], avisos: [] }) });
    expect(r.estado).toBe("ok");
    expect(r.nuevos).toEqual(["enero 2026", "febrero 2026"]);
    expect(alm.pagosG).toHaveLength(2);
    expect(alm.syncs.at(-1)?.estado).toBe("ok");
  });

  it("un mes defectuoso no frena a los demás", async () => {
    const alm = memoria();
    const r = await sincronizar(alm, [2026], { ...silencio, portal: portal({ archivos: [archivo(1), archivo(2), archivo(3)], avisos: [] }, { fallaMes: 2 }) });
    expect(r.estado).toBe("error");
    expect(r.nuevos).toEqual(["enero 2026", "marzo 2026"]);
    expect(r.errores).toEqual(["febrero 2026: falta la columna «MONTO BRUTO»"]);
  });

  it("sin cambios cuando el archivo es el mismo; no duplica", async () => {
    const alm = memoria();
    const p = portal({ archivos: [archivo(1)], avisos: [] });
    await sincronizar(alm, [2026], { ...silencio, portal: p });
    const r = await sincronizar(alm, [2026], { ...silencio, portal: p });
    expect(r.estado).toBe("sin_cambios");
    expect(r.sinCambios).toBe(1);
    expect(alm.pagosG).toHaveLength(1);
  });

  it("portal sin meses cuando debería tenerlos: error", async () => {
    const r = await sincronizar(memoria(), [2026], { ...silencio, hoy: new Date(2026, 10, 11), portal: portal({ archivos: [], avisos: [] }) });
    expect(r.estado).toBe("error");
    expect(r.errores[0]).toMatch(/no lista ningún mes/);
  });

  it("portal sin meses en enero del año nuevo: solo aviso ('parcial')", async () => {
    const r = await sincronizar(memoria(), [2027], { ...silencio, hoy: new Date(2027, 0, 5), portal: portal({ archivos: [], avisos: ["el portal no tiene la categoría «Período 2027»"] }) });
    expect(r.estado).toBe("parcial");
    expect(r.errores).toEqual([]);
    expect(r.detalle).toMatch(/Avisos: 2027: el portal no tiene/);
  });

  it("portal caído al listar: error registrado", async () => {
    const alm = memoria();
    const p = { ...portal({ archivos: [], avisos: [] }), listar: async () => { throw new Error("la Tesorería no respondió en 15 s"); } };
    const r = await sincronizar(alm, [2026], { ...silencio, portal: p });
    expect(r.estado).toBe("error");
    expect(r.errores[0]).toMatch(/no se pudo leer el portal.*15 s/);
    expect(alm.syncs.at(-1)?.estado).toBe("error");
  });

  it("sin tiempo: los meses nuevos van primero y el resto queda pendiente ('parcial')", async () => {
    const alm = memoria();
    await sincronizar(alm, [2026], { ...silencio, portal: portal({ archivos: [archivo(1), archivo(2)], avisos: [] }) });
    const r = await sincronizar(alm, [2026], { ...silencio, limiteMs: -1, portal: portal({ archivos: [archivo(1), archivo(2), archivo(3)], avisos: [] }) });
    expect(r.estado).toBe("parcial");
    expect(r.pendientes).toEqual(["marzo 2026", "enero 2026", "febrero 2026"]);
  });

  it("candidato que no abre: prueba el siguiente; si ninguno abre, reporta el último error", async () => {
    const p = {
      ...portal({ archivos: [archivo(1, 10), archivo(1, 11)], avisos: [] }),
      descargar: async (a: ArchivoTN) => { if (a.phocaId === 10) throw new Error("el archivo 10 no es un .xlsx"); return Buffer.from("x"); },
    };
    expect((await sincronizar(memoria(), [2026], { ...silencio, portal: p })).estado).toBe("ok");
    const p2 = { ...p, descargar: async () => { throw new Error("la descarga falló (503)"); } };
    const r = await sincronizar(memoria(), [2026], { ...silencio, portal: p2 });
    expect(r.estado).toBe("error");
    expect(r.errores[0]).toMatch(/^enero 2026: ningún archivo publicado.*503/);
  });

  it("si no puede registrar la corrida, lo dice en el resultado", async () => {
    const alm = memoria();
    alm.registrarSync = async () => { throw new Error("Secreto de sincronización inválido"); };
    const r = await sincronizar(alm, [2026], { ...silencio, portal: portal({ archivos: [archivo(1)], avisos: [] }) });
    expect(r.estado).toBe("error");
    expect(r.detalle).toMatch(/No se pudo registrar la corrida: Secreto/);
  });
});
