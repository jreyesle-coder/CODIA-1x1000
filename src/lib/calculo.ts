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

export interface Periodo { anio: number; mes: number }

const clavePeriodo = (p: Periodo) => p.anio * 100 + p.mes;

/** Meses con datos (año y mes), en orden, aunque abarquen varios años. */
export function periodos(pagos: PagoObra[]): Periodo[] {
  const m = new Map<number, Periodo>();
  for (const p of pagos) m.set(clavePeriodo(p), { anio: p.anio, mes: p.mes });
  return [...m.entries()].sort((a, b) => a[0] - b[0]).map(([, p]) => p);
}

/** «octubre», «agosto–octubre» o, si cruza de año o se pide, «noviembre 2026–enero 2027». */
export function etiquetaPeriodos(ps: Periodo[], conAnio = false): string {
  if (!ps.length) return "";
  const a = ps[0], b = ps.at(-1)!;
  const anio = conAnio || a.anio !== b.anio;
  const nombre = (p: Periodo) => MESES_LARGOS[p.mes - 1].toLowerCase() + (anio ? ` ${p.anio}` : "");
  return ps.length === 1 ? nombre(a) : `${nombre(a)}–${nombre(b)}`;
}

export interface Reciente {
  /** «Últimos 3 meses», «Últimos 2 meses» o «Último mes», según los datos que haya. */
  titulo: string;
  ult: Periodo[];
  /** Los mismos meses inmediatamente anteriores; vacío si no hay suficientes para comparar. */
  ant: Periodo[];
  pagos: PagoObra[];
  x1000: number;
  x1000Anterior: number | null;
  etiqueta: string;
  etiquetaAnterior: string;
  /** Los meses recientes o los anteriores abarcan más de un año. */
  conAnio: boolean;
}

/**
 * Los últimos n meses con datos y los n anteriores para comparar. Recibe los pagos de uno o
 * varios años: a inicios de año, «los últimos 3 meses» incluyen noviembre y diciembre del anterior.
 */
export function reciente(pagos: PagoObra[], n = 3, tasa = TASA): Reciente {
  const ps = periodos(pagos);
  const ult = ps.slice(-n);
  const ant = ps.slice(-2 * n, -n);
  const comparar = ant.length === ult.length && ult.length > 0;
  const en = (lista: Periodo[]) => new Set(lista.map(clavePeriodo));
  const kUlt = en(ult), kAnt = en(ant);
  const rec = pagos.filter((p) => kUlt.has(clavePeriodo(p)));
  const x1000 = rec.reduce((s, p) => s + p.monto_bruto, 0) * tasa;
  const x1000Anterior = comparar ? pagos.filter((p) => kAnt.has(clavePeriodo(p))).reduce((s, p) => s + p.monto_bruto, 0) * tasa : null;
  const anios = new Set([...ult, ...(comparar ? ant : [])].map((p) => p.anio));
  const conAnio = anios.size > 1;
  return {
    titulo: ult.length === 1 ? "Último mes" : `Últimos ${ult.length} meses`,
    ult,
    ant: comparar ? ant : [],
    pagos: rec,
    x1000,
    x1000Anterior,
    etiqueta: etiquetaPeriodos(ult, conAnio),
    etiquetaAnterior: comparar ? etiquetaPeriodos(ant, conAnio) : "",
    conAnio,
  };
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
