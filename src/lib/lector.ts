/** Lee un Excel mensual de la Tesorería y devuelve solo los pagos con «Concepto general» = OBRAS. */
import ExcelJS from "exceljs";

export type Moneda = "RD" | "USD" | "EUR";

export interface PagoObra {
  anio: number;
  mes: number;
  moneda: Moneda;
  fecha: string | null; // AAAA-MM-DD
  institucion: string;
  unidad_ejecutora: string | null;
  libramiento: string | null;
  proveedor: string | null;
  concepto: string | null;
  monto_bruto: number;
  retencion: number;
  monto_neto: number;
  cesion: boolean;
}

function norm(s: unknown) {
  return String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/\s+/g, " ").trim();
}

/** Cesiones de crédito: la Tesorería escribe «BANCO DE RESERVA…» (sin la S final). */
export function esCesion(proveedor: string | null) {
  const p = norm(proveedor);
  return p.includes("BANCO DE RESERVA") || p.includes("BANCO AGRICOLA");
}

function texto(v: ExcelJS.CellValue): string | null {
  if (v == null) return null;
  if (typeof v === "object" && "richText" in v) return v.richText.map((t) => t.text).join("").trim() || null;
  if (typeof v === "object" && "result" in v) return v.result == null ? null : String(v.result).trim();
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).trim() || null;
}

function numero(v: ExcelJS.CellValue): number {
  if (typeof v === "number") return v;
  if (v && typeof v === "object" && "result" in v) return Number(v.result) || 0;
  const n = Number(String(v ?? "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function fecha(v: ExcelJS.CellValue): string | null {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const m = String(texto(v) ?? "").match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : null;
}

function monedaDeHoja(nombre: string): Moneda | null {
  const n = norm(nombre);
  if (n.includes("RD$")) return "RD";
  if (n.includes("USD")) return "USD";
  if (n.includes("EUR")) return "EUR";
  return null;
}

export async function leerArchivo(buf: Buffer, anio: number, mes: number): Promise<PagoObra[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ArrayBuffer);
  const out: PagoObra[] = [];
  for (const ws of wb.worksheets) {
    const moneda = monedaDeHoja(ws.name);
    if (!moneda) continue;
    // Ubica la fila de encabezados y las columnas por nombre.
    let filaEnc = 0;
    const col: Record<string, number> = {};
    ws.eachRow((row, i) => {
      if (filaEnc) return;
      const vals = (row.values as ExcelJS.CellValue[]).map(norm);
      if (vals.includes("INSTITUCION") && vals.some((v) => v === "CONCEPTO GENERAL")) {
        filaEnc = i;
        vals.forEach((v, j) => { if (v && !(v in col)) col[v] = j; });
      }
    });
    if (!filaEnc) throw new Error(`Hoja «${ws.name}»: no se encontró la fila de encabezados`);
    const c = (nombre: string) => {
      const j = col[nombre];
      if (!j) throw new Error(`Hoja «${ws.name}»: falta la columna «${nombre}»`);
      return j;
    };
    const C = {
      inst: c("INSTITUCION"), ue: c("UNIDAD EJECUTORA"), fecha: c("FECHA GENERACION"), lib: c("LIBRAMIENTO"),
      prov: c("PROVEEDOR / BENEFICIARIO"), conc: c("CONCEPTO"), bruto: c("MONTO BRUTO"),
      ret: c("RETENCION / DEDUCCION"), neto: c("MONTO NETO"), gen: c("CONCEPTO GENERAL"),
    };
    ws.eachRow((row, i) => {
      if (i <= filaEnc) return;
      const v = (j: number) => row.getCell(j).value;
      const inst = texto(v(C.inst));
      if (!inst || norm(v(C.gen)) !== "OBRAS") return; // descarta totales, notas y otros conceptos
      const proveedor = texto(v(C.prov));
      out.push({
        anio, mes, moneda, fecha: fecha(v(C.fecha)), institucion: inst.replace(/\s+/g, " "),
        unidad_ejecutora: texto(v(C.ue)), libramiento: texto(v(C.lib)), proveedor, concepto: texto(v(C.conc)),
        monto_bruto: numero(v(C.bruto)), retencion: numero(v(C.ret)), monto_neto: numero(v(C.neto)),
        cesion: esCesion(proveedor),
      });
    });
  }
  return out;
}
