"use client";
import { useState } from "react";

export interface Serie { nombre: string; color: string }
export interface Grupo { etiqueta: string; valores: number[]; total?: string }

const rd = (n: number) => "RD$" + Math.round(n).toLocaleString("en-US");
const corto = (n: number) => (n / 1e6).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " M";

/**
 * Barras verticales (simples o agrupadas) en SVG, con el monto sobre cada barra
 * y detalle al pasar el cursor.
 */
export function GraficoBarras({ grupos, series, alto = 300, etiquetaLarga = false }: {
  grupos: Grupo[]; series: Serie[]; alto?: number; etiquetaLarga?: boolean;
}) {
  const [activo, setActivo] = useState<{ g: number; s: number } | null>(null);
  const ancho = 600, izq = 44, der = 8, arriba = grupos.some((g) => g.total) ? 44 : 28, abajo = etiquetaLarga ? 52 : 28;
  const max = Math.max(1, ...grupos.flatMap((g) => g.valores));
  const paso = niceStep(max / 4);
  const tope = Math.ceil(max / paso) * paso;
  const y = (v: number) => arriba + (alto - arriba - abajo) * (1 - v / tope);
  const anchoGrupo = (ancho - izq - der) / grupos.length;
  const ns = series.length;
  const anchoBarra = Math.min(72, (anchoGrupo * 0.72) / ns);
  const hueco = 4;
  const compacto = ns > 1 || grupos.length > 4; // con muchas barras, montos cortos (el exacto va en el detalle)

  return (
    <div className="relative">
      {ns > 1 && (
        <div className="mb-2 flex flex-wrap gap-4 text-xs text-tinta-2">
          {series.map((s) => (
            <span key={s.nombre} className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
              {s.nombre}
            </span>
          ))}
        </div>
      )}
      <svg viewBox={`0 0 ${ancho} ${alto}`} className="w-full" role="img" onMouseLeave={() => setActivo(null)}>
        {Array.from({ length: Math.round(tope / paso) + 1 }, (_, i) => i * paso).map((v) => (
          <g key={v}>
            <line x1={izq} x2={ancho - der} y1={y(v)} y2={y(v)} stroke="var(--borde)" strokeWidth={1} />
            <text x={izq - 6} y={y(v) + 4} textAnchor="end" fontSize={11} fill="var(--tinta-3)">{v ? `${v / 1e6} M` : "0"}</text>
          </g>
        ))}
        {grupos.map((g, gi) => {
          const cx = izq + anchoGrupo * (gi + 0.5);
          const inicio = cx - (ns * anchoBarra + (ns - 1) * hueco) / 2;
          const maxG = Math.max(...g.valores);
          return (
            <g key={g.etiqueta}>
              {g.valores.map((v, si) => {
                const x = inicio + si * (anchoBarra + hueco);
                const on = activo?.g === gi && activo.s === si;
                return (
                  <g key={si} onMouseEnter={() => setActivo({ g: gi, s: si })}>
                    <rect x={x - hueco / 2} y={arriba - 10} width={anchoBarra + hueco} height={alto - arriba - abajo + 10} fill="transparent" />
                    <path d={barra(x, y(v), anchoBarra, y(0) - y(v))} fill={series[si].color} opacity={activo && !on ? 0.55 : 1} />
                    <text x={x + anchoBarra / 2} y={y(v) - 6} textAnchor="middle" fontSize={compacto ? 11 : 13}
                      fontWeight={ns > 1 ? 400 : 600} fill={ns > 1 ? "var(--tinta-2)" : "var(--tinta)"} className="cifra">
                      {compacto ? corto(v) : rd(v)}
                    </text>
                  </g>
                );
              })}
              {g.total && (
                <text x={cx} y={y(maxG) - 24} textAnchor="middle" fontSize={13} fontWeight={700} fill="var(--tinta)" className="cifra">{g.total}</text>
              )}
              <text x={cx} y={alto - abajo + 18} textAnchor="middle" fontSize={12} fill="var(--tinta-2)">
                {etiquetaLarga ? partir(g.etiqueta).map((l, i) => <tspan key={i} x={cx} dy={i ? 14 : 0}>{l}</tspan>) : g.etiqueta}
              </text>
            </g>
          );
        })}
        <line x1={izq} x2={ancho - der} y1={y(0)} y2={y(0)} stroke="var(--tinta-3)" strokeWidth={1} />
      </svg>
      {activo && (
        <div className="pointer-events-none absolute right-2 top-0 rounded-md border border-borde bg-superficie px-3 py-2 text-xs shadow-sm">
          <div className="font-semibold text-tinta">{grupos[activo.g].etiqueta}{ns > 1 ? ` · ${series[activo.s].nombre}` : ""}</div>
          <div className="cifra text-tinta-2">1x1000: {rd(grupos[activo.g].valores[activo.s])}</div>
        </div>
      )}
    </div>
  );
}

/** Barra con esquinas superiores redondeadas (4px), anclada a la base. */
function barra(x: number, y: number, w: number, h: number) {
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`;
}

function niceStep(v: number) {
  const p = 10 ** Math.floor(Math.log10(v));
  return [1, 2, 2.5, 5, 10].map((m) => m * p).find((s) => s >= v)!;
}

function partir(t: string, max = 34) {
  const out: string[] = [];
  let linea = "";
  for (const p of t.split(" ")) {
    if ((linea + " " + p).trim().length > max && linea) { out.push(linea); linea = p; } else linea = (linea + " " + p).trim();
  }
  return [...out, linea].slice(0, 3);
}
