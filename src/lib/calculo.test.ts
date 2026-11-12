import { describe, expect, it } from "vitest";
import { etiquetaPeriodos, periodos, porInstitucion, reciente, resumen, ultimosMeses } from "./calculo";
import { esCesion, type PagoObra } from "./lector";

const pago = (mes: number, institucion: string, bruto: number, proveedor = "Constructora X, SRL"): PagoObra => ({
  anio: 2026, mes, moneda: "RD", fecha: null, institucion, unidad_ejecutora: null, libramiento: null, proveedor,
  concepto: null, monto_bruto: bruto, retencion: bruto * 0.05, monto_neto: bruto * 0.95, cesion: esCesion(proveedor),
});

describe("esCesion", () => {
  it("reconoce cómo escribe la Tesorería a Banreservas (sin la S final) y al Agrícola", () => {
    expect(esCesion("BANCO DE RESERVA DE LA REP.  DOM. BANCO SERVICIOS MULTIPLES, SA")).toBe(true);
    expect(esCesion("Banco Agrícola de la República Dominicana")).toBe(true);
    expect(esCesion("Reserva Ingeniería, SRL")).toBe(false);
  });
});

describe("resumen", () => {
  const datos = [
    pago(1, "MOPC", 1_000_000), pago(2, "MOPC", 2_000_000),
    pago(4, "MINERD", 3_000_000), pago(4, "MOPC", 500_000, "BANCO DE RESERVA DE LA REP. DOM."),
  ];
  const r = resumen(datos);
  it("arma meses, subtotales por trimestre y total", () => {
    expect(r.map((f) => f.tipo)).toEqual(["mes", "mes", "trimestre", "mes", "trimestre", "total"]);
    const total = r.at(-1)!;
    expect(total.pagos).toBe(4);
    expect(total.bruto).toBe(6_500_000);
    expect(total.x1000).toBeCloseTo(6_500);
    expect(total.cesiones).toBe(500_000);
    expect(total.x1000Depurado).toBeCloseTo(6_000);
    expect(total.pctRetencion).toBeCloseTo(0.05);
  });
  it("respeta la tasa que se le pase", () => {
    expect(resumen(datos, 0.002).at(-1)!.x1000).toBeCloseTo(13_000);
  });
  it("la suma de instituciones es igual al total", () => {
    const inst = porInstitucion(datos);
    expect(inst[0].institucion).toBe("MOPC");
    expect(inst.reduce((s, f) => s + f.bruto, 0)).toBe(r.at(-1)!.bruto);
    expect(inst.reduce((s, f) => s + f.pct, 0)).toBeCloseTo(1);
  });
  it("toma los últimos meses con datos", () => {
    expect(ultimosMeses(datos, 2)).toEqual([2, 4]);
  });
});

describe("meses recientes (lo que cambia cuando llega un mes nuevo)", () => {
  // Un pago de RD$1,000,000 por mes (1x1000 = RD$1,000), salvo que se indique otro monto.
  const mes = (anio: number, m: number, bruto = 1_000_000): PagoObra => ({ ...pago(m, "MOPC", bruto), anio });
  const anio = (a: number, hasta: number) => Array.from({ length: hasta }, (_, i) => mes(a, i + 1));

  it("enero–septiembre: últimos 3 = julio–septiembre, frente a abril–junio", () => {
    const r = reciente(anio(2026, 9));
    expect(r.titulo).toBe("Últimos 3 meses");
    expect(r.etiqueta).toBe("julio–septiembre");
    expect(r.etiquetaAnterior).toBe("abril–junio");
    expect(r.x1000).toBeCloseTo(3_000);
  });

  it("al llegar octubre todo se corre un mes: agosto–octubre frente a mayo–julio", () => {
    const datos = [...anio(2026, 9), mes(2026, 10, 2_000_000)];
    const r = reciente(datos);
    expect(r.etiqueta).toBe("agosto–octubre");
    expect(r.etiquetaAnterior).toBe("mayo–julio");
    expect(r.x1000).toBeCloseTo(4_000);
    expect(r.x1000Anterior).toBeCloseTo(3_000);
    expect(etiquetaPeriodos(periodos(datos))).toBe("enero–octubre");
    const filas = resumen(datos);
    expect(filas.filter((f) => f.tipo === "mes")).toHaveLength(10);
    expect(filas.at(-1)!.x1000).toBeCloseTo(11_000);
  });

  it("cambio de año: con enero 2027, los últimos 3 incluyen noviembre y diciembre 2026", () => {
    const r = reciente([...anio(2026, 12), mes(2027, 1)]);
    expect(r.titulo).toBe("Últimos 3 meses");
    expect(r.etiqueta).toBe("noviembre 2026–enero 2027");
    expect(r.etiquetaAnterior).toBe("agosto 2026–octubre 2026");
    expect(r.pagos.map((p) => `${p.anio}-${p.mes}`)).toEqual(["2026-11", "2026-12", "2027-1"]);
    expect(r.conAnio).toBe(true);
  });

  it("un solo mes en total: «Último mes», sin comparación", () => {
    const r = reciente([mes(2027, 1)]);
    expect(r.titulo).toBe("Último mes");
    expect(r.etiqueta).toBe("enero");
    expect(r.x1000Anterior).toBeNull();
    expect(r.etiquetaAnterior).toBe("");
    expect(etiquetaPeriodos(periodos([mes(2027, 1)]))).toBe("enero");
  });

  it("dos meses en total: «Últimos 2 meses», sin comparación", () => {
    const r = reciente([mes(2027, 1), mes(2027, 2)]);
    expect(r.titulo).toBe("Últimos 2 meses");
    expect(r.etiqueta).toBe("enero–febrero");
    expect(r.x1000Anterior).toBeNull();
  });
});
