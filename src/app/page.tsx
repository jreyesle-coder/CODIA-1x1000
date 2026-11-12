import Link from "next/link";
import { cargar, rd, num, pct, fechaHora } from "@/lib/datos";
import { MESES_CORTOS, MESES_LARGOS, TASA, etiquetaPeriodos, nombreCorto, periodos, porInstitucion, reciente, resumen } from "@/lib/calculo";
import { GraficoBarras } from "@/components/grafico-barras";
import { Tarjeta, Seccion, EstadoSync, SinDatos, BotonActualizar, AvisoSync, FaltaConfiguracion } from "@/components/ui";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // «Actualizar ahora» descarga de la Tesorería y puede tardar

export default async function Tablero({ searchParams }: PageProps<"/">) {
  const { anio: q, sync, estado, detalle } = await searchParams;
  const d = await cargar(typeof q === "string" ? q : undefined);
  if (d.faltan) return <FaltaConfiguracion faltan={d.faltan} />;
  if (!d.rd.length) return <SinDatos ultimaSync={d.ultimaSync} />;

  const filas = resumen(d.rd);
  const total = filas.at(-1)!;
  const meses = filas.filter((f) => f.tipo === "mes");
  // Todo se deriva de los meses guardados: cuando llega un mes nuevo, títulos, totales y gráficos cambian solos.
  const anioTexto = etiquetaPeriodos(periodos(d.rd));
  const rec = reciente([...d.rdAnterior, ...d.rd]); // a inicios de año incluye los últimos meses del anterior
  const cambio = rec.x1000Anterior ? rec.x1000 / rec.x1000Anterior - 1 : null;
  const top3 = porInstitucion(rec.pagos).slice(0, 3);
  const sumaTop3 = top3.reduce((s, f) => s + f.x1000, 0);
  const instAnio = porInstitucion(d.rd);
  const numsMes = meses.map((m) => MESES_LARGOS.indexOf(m.etiqueta) + 1);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-tinta">1x1000 teórico del CODIA · {d.anio}</h1>
          <p className="text-sm text-tinta-2">
            Pagos de OBRAS en RD$ de la Tesorería Nacional, {anioTexto} {d.anio}. Tasa {TASA} (Decreto 319-98).
          </p>
        </div>
        <div className="flex items-center gap-3">
          {d.anios.length > 1 && (
            <div className="flex gap-1 text-sm">
              {d.anios.map((a) => (
                <Link key={a} href={`/?anio=${a}`} className={`rounded-md px-2.5 py-1 ${a === d.anio ? "bg-codia text-white" : "text-tinta-2 hover:bg-superficie"}`}>{a}</Link>
              ))}
            </div>
          )}
          <EstadoSync s={d.ultimaSync} horas={d.horasSinRevisar} />
          <BotonActualizar />
        </div>
      </div>
      {sync === "1" && <AvisoSync estado={String(estado ?? "")} detalle={String(detalle ?? "")} />}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tarjeta titulo={`1x1000 ${anioTexto}`} valor={rd(total.x1000)} nota={`Sobre ${rd(total.bruto)} de monto bruto`} />
        <Tarjeta titulo="1x1000 depurado" valor={rd(total.x1000Depurado)} nota={`Sin ${rd(total.cesiones)} cedidos a Banreservas`} />
        <Tarjeta titulo={`${rec.titulo} (${rec.etiqueta})`} valor={rd(rec.x1000)}
          nota={cambio === null ? undefined : `${cambio >= 0 ? "+" : ""}${pct(cambio)} frente a ${rec.etiquetaAnterior}`}
          tono={cambio === null ? undefined : cambio >= 0 ? "bueno" : "malo"} />
        <Tarjeta titulo="Pagos de obra" valor={num(total.pagos)} nota={`Retención agregada: ${pct(total.pctRetencion)} del bruto`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Seccion titulo="1x1000 por mes" subtitulo={`Total ${anioTexto}: ${rd(total.x1000)}`}>
          <GraficoBarras series={[{ nombre: "1x1000", color: "var(--serie-1)" }]}
            grupos={meses.map((m) => ({ etiqueta: MESES_CORTOS[MESES_LARGOS.indexOf(m.etiqueta)], valores: [m.x1000] }))} />
        </Seccion>
        <Seccion titulo={`Las 3 instituciones con más 1x1000 · ${rec.etiqueta}`}
          subtitulo={`Juntas suman ${rd(sumaTop3)}, el ${pct(rec.x1000 ? sumaTop3 / rec.x1000 : 0)} del ${rec.ult.length === 3 ? "trimestre" : "período"} (${rd(rec.x1000)})`}>
          {/* porMes va por número de mes: en una ventana de 3 meses no se repite aunque cruce de año */}
          <GraficoBarras etiquetaLarga
            series={rec.ult.map((p, i) => ({ nombre: MESES_LARGOS[p.mes - 1] + (rec.conAnio ? ` ${p.anio}` : ""), color: `var(--serie-${i + 1})` }))}
            grupos={top3.map((f) => ({ etiqueta: nombreCorto(f.institucion), valores: rec.ult.map((p) => f.porMes[p.mes] ?? 0), total: `Total ${rd(f.x1000)}` }))} />
        </Seccion>
      </div>

      <Seccion titulo="Resumen por mes y trimestre" subtitulo="Cesiones = pagos al Banco de Reservas o al Banco Agrícola (cesiones de crédito, no obras del banco). La retención es la agregada que publica la Tesorería, sin desglose.">
        <div className="overflow-x-auto">
          <table className="cifra w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b border-borde text-left text-xs text-tinta-2">
                {["", "Pagos", "Monto bruto", "Retención", "% ret.", "Cesiones Banreservas", "Base depurada", "1x1000 bruto", "1x1000 depurado"].map((h, i) => (
                  <th key={h} className={`py-2 pr-3 font-medium ${i ? "text-right" : ""}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.etiqueta} className={`border-b border-borde ${f.tipo === "mes" ? "" : f.tipo === "trimestre" ? "bg-fondo font-semibold" : "bg-codia/10 font-bold"}`}>
                  <td className="whitespace-nowrap py-2 pr-3">{f.etiqueta}</td>
                  <td className="py-2 pr-3 text-right">{num(f.pagos)}</td>
                  <td className="py-2 pr-3 text-right">{rd(f.bruto)}</td>
                  <td className="py-2 pr-3 text-right">{rd(f.retencion)}</td>
                  <td className="py-2 pr-3 text-right">{pct(f.pctRetencion)}</td>
                  <td className="py-2 pr-3 text-right">{rd(f.cesiones)}</td>
                  <td className="py-2 pr-3 text-right">{rd(f.depurada)}</td>
                  <td className="py-2 pr-3 text-right">{rd(f.x1000)}</td>
                  <td className="py-2 pr-3 text-right">{rd(f.x1000Depurado)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Seccion>

      <Seccion titulo="1x1000 por institución" subtitulo={`${instAnio.length} instituciones, de mayor a menor. Clic en una institución para ver sus libramientos.`}>
        <div className="max-h-[560px] overflow-auto">
          <table className="cifra w-full min-w-[1100px] text-sm">
            <thead className="sticky top-0 bg-superficie">
              <tr className="border-b border-borde text-left text-xs text-tinta-2">
                <th className="py-2 pr-3 font-medium">Institución</th>
                {numsMes.map((m) => <th key={m} className="py-2 pr-3 text-right font-medium">{MESES_CORTOS[m - 1]}</th>)}
                <th className="py-2 pr-3 text-right font-medium">Pagos</th>
                <th className="py-2 pr-3 text-right font-medium">1x1000 total</th>
                <th className="py-2 pr-3 text-right font-medium">% del total</th>
              </tr>
            </thead>
            <tbody>
              {instAnio.map((f) => (
                <tr key={f.institucion} className="border-b border-borde hover:bg-fondo">
                  <td className="min-w-[260px] max-w-[340px] py-1.5 pr-3">
                    <Link href={`/detalle?anio=${d.anio}&inst=${encodeURIComponent(f.institucion)}`} className="hover:text-codia hover:underline">{f.institucion}</Link>
                  </td>
                  {numsMes.map((m) => <td key={m} className="py-1.5 pr-3 text-right text-tinta-2">{f.porMes[m] ? num(f.porMes[m]) : "–"}</td>)}
                  <td className="py-1.5 pr-3 text-right">{num(f.pagos)}</td>
                  <td className="py-1.5 pr-3 text-right font-semibold">{rd(f.x1000)}</td>
                  <td className="py-1.5 pr-3 text-right">{pct(f.pct)}</td>
                </tr>
              ))}
              <tr className="sticky bottom-0 bg-superficie font-bold">
                <td className="py-2 pr-3">Total</td>
                {numsMes.map((m) => <td key={m} className="py-2 pr-3 text-right">{num(meses[numsMes.indexOf(m)].x1000)}</td>)}
                <td className="py-2 pr-3 text-right">{num(total.pagos)}</td>
                <td className="py-2 pr-3 text-right">{rd(total.x1000)}</td>
                <td className="py-2 pr-3 text-right">100.0%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Seccion>

      <Seccion titulo="Cómo se calcula">
        <ul className="list-disc space-y-1 pl-5 text-sm text-tinta-2">
          <li>Cada día, entre 7:00 y 8:00 a. m., se revisa el portal de la Tesorería. Cuando publica un mes nuevo o corrige uno, se descarga y se recalcula solo. El botón «Actualizar ahora» hace lo mismo en el momento.</li>
          <li>Se toman solo los pagos en RD$ cuyo «Concepto general» es OBRAS. 1x1000 = monto bruto × {TASA}.</li>
          <li>Los pagos de obra en USD y EUR no entran en el cálculo; están en <Link href="/excluidos" className="text-codia underline">USD y EUR</Link>.</li>
          <li>La Tesorería solo publica los pagos por la Cuenta Única del Tesoro. No incluye descentralizadas con tesorería propia ni ayuntamientos: la cifra es un piso.</li>
          <li>Archivos de {d.anio}: {d.archivos.map((a) => (
            <a key={a.mes} href={a.url} target="_blank" rel="noreferrer" className="mr-2 text-codia underline">{MESES_CORTOS[a.mes - 1]}</a>
          ))}</li>
        </ul>
        {d.ultimaSync?.fin && <p className="mt-3 text-xs text-tinta-3">Última revisión: {fechaHora(d.ultimaSync.fin)}.</p>}
      </Seccion>
    </div>
  );
}
