import { describe, expect, it } from "vitest";
import { porInstitucion, resumen, ultimosMeses } from "./calculo";
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
