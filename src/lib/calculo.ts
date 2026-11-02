/** Cálculo del 1x1000 (Decreto 319-98). Funciones puras: las usan el tablero y las pruebas. */
import type { PagoObra } from "./lector";

export const TASA = 0.001;
export const MESES_CORTOS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
export const MESES_LARGOS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

export interface Fila {
  etiqueta: string;
  tipo: "mes" | "trimestre" | "total";
  pagos: number;
  bruto: number;
  retencion: number;
  pctRetencion: number;
  cesiones: number;
  depurada: number;
  x1000: number;
  x1000Depurado: number;
}

function fila(etiqueta: string, tipo: Fila["tipo"], p: PagoObra[], tasa: number): Fila {
  const bruto = p.reduce((s, x) => s + x.monto_bruto, 0);
  const retencion = p.reduce((s, x) => s + x.retencion, 0);
  const cesiones = p.filter((x) => x.cesion).reduce((s, x) => s + x.monto_bruto, 0);
  return {
    etiqueta, tipo, pagos: p.length, bruto, retencion, pctRetencion: bruto ? retencion / bruto : 0,
    cesiones, depurada: bruto - cesiones, x1000: bruto * tasa, x1000Depurado: (bruto - cesiones) * tasa,
  };
}

/** Meses con datos, ordenados. */
export function mesesConDatos(rd: PagoObra[]): number[] {
  return [...new Set(rd.map((p) => p.mes))].sort((a, b) => a - b);
}

/** Resumen por mes con subtotales por trimestre y total del período (solo RD$). */
export function resumen(rd: PagoObra[], tasa = TASA): Fila[] {
  const meses = mesesConDatos(rd);
  const out: Fila[] = [];
  for (let t = 0; t < 4; t++) {
    const mt = meses.filter((m) => Math.ceil(m / 3) === t + 1);
    if (!mt.length) continue;
    for (const m of mt) out.push(fila(MESES_LARGOS[m - 1], "mes", rd.filter((p) => p.mes === m), tasa));
    const nombre = `Trimestre ${t + 1} (${MESES_CORTOS[t * 3].toLowerCase()}–${MESES_CORTOS[t * 3 + 2].toLowerCase()})`;
    out.push(fila(`Subtotal ${nombre}`, "trimestre", rd.filter((p) => mt.includes(p.mes)), tasa));
  }
  out.push(fila("Total del período", "total", rd, tasa));
  return out;
}

export interface FilaInstitucion {
  institucion: string;
  porMes: Record<number, number>; // 1x1000 por mes
  bruto: number;
  pagos: number;
  x1000: number;
  pct: number;
}

/** 1x1000 por institución y mes, de mayor a menor. */
export function porInstitucion(rd: PagoObra[], tasa = TASA): FilaInstitucion[] {
  const total = rd.reduce((s, x) => s + x.monto_bruto, 0);
  const m = new Map<string, FilaInstitucion>();
  for (const p of rd) {
    const f = m.get(p.institucion) ?? { institucion: p.institucion, porMes: {}, bruto: 0, pagos: 0, x1000: 0, pct: 0 };
    f.porMes[p.mes] = (f.porMes[p.mes] ?? 0) + p.monto_bruto * tasa;
    f.bruto += p.monto_bruto;
    f.pagos++;
    m.set(p.institucion, f);
  }
  return [...m.values()]
    .map((f) => ({ ...f, x1000: f.bruto * tasa, pct: total ? f.bruto / total : 0 }))
    .sort((a, b) => b.bruto - a.bruto);
}

/** Últimos N meses con datos. */
export function ultimosMeses(rd: PagoObra[], n = 3): number[] {
  return mesesConDatos(rd).slice(-n);
}

const SIGLAS: [RegExp, string][] = [
  [/OBRAS PUBLICAS/, "MOPC"], [/MINISTERIO DE EDUCACION$/, "MINERD"], [/VIVIENDA/, "MIVHED"],
  [/AGUAS POTABLES/, "INAPA"], [/ACUEDUCTO Y ALCANTARILLADO DE SANTO DOMINGO/, "CAASD"],
  [/ACUEDUCTO Y ALCANTARILLADO DE SANTIAGO/, "CORAASAN"], [/SERVICIO NACIONAL DE SALUD/, "SNS"],
  [/^PRESIDENCIA DE LA REPUBLICA$/, "Presidencia"], [/MINISTERIO DE DEFENSA/, "MIDE"],
  [/MINISTERIO DE SALUD/, "MISPAS"], [/RECURSOS HIDRAULICOS/, "INDRHI"], [/MINISTERIO DE TURISMO/, "MITUR"],
];

/** Nombre corto para gráficos: sigla conocida, la que trae entre paréntesis o el nombre en tipo título. */
export function nombreCorto(institucion: string) {
  const n = institucion.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  const s = SIGLAS.find(([re]) => re.test(n));
  if (s) return s[1];
  const par = institucion.match(/\(([^)]{2,12})\)\s*$/);
  if (par) return par[1];
  return institucion.toLowerCase().replace(/(^|\s)(\p{L})/gu, (_, e, l) => e + l.toUpperCase())
    .replace(/\b(De|Del|La|Las|Los|Y|E|Para|El)\b/g, (m) => m.toLowerCase());
}
