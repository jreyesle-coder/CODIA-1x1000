import Link from "next/link";
import { cargar, rd, num } from "@/lib/datos";
import { MESES_LARGOS, TASA } from "@/lib/calculo";
import { Seccion, SinDatos, FaltaConfiguracion } from "@/components/ui";

export const dynamic = "force-dynamic";
const POR_PAGINA = 100;

const sinAcentos = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export default async function Detalle({ searchParams }: PageProps<"/detalle">) {
  const sp = await searchParams;
  const p = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const d = await cargar(p("anio"));
  if (d.faltan) return <FaltaConfiguracion faltan={d.faltan} />;
  if (!d.rd.length) return <SinDatos ultimaSync={d.ultimaSync} />;

  const mes = Number(p("mes")) || 0, inst = p("inst"), q = p("q").trim(), cesion = p("cesion");
  const pagina = Math.max(1, Number(p("pag")) || 1);
  const instituciones = [...new Set(d.rd.map((x) => x.institucion))].sort();
  const meses = [...new Set(d.rd.map((x) => x.mes))].sort((a, b) => a - b);
  const qn = sinAcentos(q);
  const filas = d.rd
    .filter((x) => (!mes || x.mes === mes) && (!inst || x.institucion === inst)
      && (!cesion || (cesion === "si") === x.cesion)
      && (!qn || sinAcentos(`${x.proveedor} ${x.concepto} ${x.libramiento} ${x.unidad_ejecutora}`).includes(qn)))
    .sort((a, b) => b.monto_bruto - a.monto_bruto);
  const bruto = filas.reduce((s, x) => s + x.monto_bruto, 0);
  const paginas = Math.max(1, Math.ceil(filas.length / POR_PAGINA));
  const visibles = filas.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);
  const enlace = (n: number) => {
    const u = new URLSearchParams({ anio: String(d.anio), ...(mes && { mes: String(mes) }), ...(inst && { inst }), ...(q && { q }), ...(cesion && { cesion }), pag: String(n) });
    return `/detalle?${u}`;
  };
  const campo = "rounded-md border border-borde bg-white px-2 py-1.5 text-sm";

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Libramientos de obra · {d.anio}</h1>
      <form className="flex flex-wrap items-end gap-2 rounded-lg border border-borde bg-superficie p-3">
        <input type="hidden" name="anio" value={d.anio} />
        <label className="text-xs text-tinta-2">Mes<br />
          <select name="mes" defaultValue={mes || ""} className={campo}>
            <option value="">Todos</option>
            {meses.map((m) => <option key={m} value={m}>{MESES_LARGOS[m - 1]}</option>)}
          </select>
        </label>
        <label className="text-xs text-tinta-2">Institución<br />
          <select name="inst" defaultValue={inst} className={`${campo} max-w-[340px]`}>
            <option value="">Todas</option>
            {instituciones.map((i) => <option key={i} value={i}>{i}</option>)}
          </select>
        </label>
        <label className="text-xs text-tinta-2">Cesión a banco<br />
          <select name="cesion" defaultValue={cesion} className={campo}>
            <option value="">Todas</option>
            <option value="si">Solo cesiones</option>
            <option value="no">Sin cesiones</option>
          </select>
        </label>
        <label className="flex-1 text-xs text-tinta-2">Buscar (contratista, concepto, libramiento)<br />
          <input name="q" defaultValue={q} placeholder="Ej.: acueducto, cubicación, Constructora…" className={`${campo} w-full min-w-[220px]`} />
        </label>
        <button className="rounded-md bg-codia px-4 py-1.5 text-sm font-medium text-white">Filtrar</button>
        <Link href={`/detalle?anio=${d.anio}`} className="px-2 py-1.5 text-sm text-tinta-2 hover:underline">Limpiar</Link>
      </form>

      <Seccion titulo={`${num(filas.length)} libramientos · ${rd(bruto)} bruto · 1x1000 ${rd(bruto * TASA)}`}
        subtitulo="Ordenados por monto bruto, de mayor a menor.">
        <div className="overflow-x-auto">
          <table className="cifra w-full min-w-[1100px] text-sm">
            <thead>
              <tr className="border-b border-borde text-left text-xs text-tinta-2">
                {["Fecha", "Institución / Unidad ejecutora", "Contratista", "Concepto", "Monto bruto", "Retención", "1x1000"].map((h, i) => (
                  <th key={h} className={`py-2 pr-3 font-medium ${i >= 4 ? "text-right" : ""}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibles.map((x, i) => (
                <tr key={`${x.libramiento}-${i}`} className="border-b border-borde align-top">
                  <td className="whitespace-nowrap py-2 pr-3 text-tinta-2">{x.fecha?.split("-").reverse().join("/")}</td>
                  <td className="max-w-[240px] py-2 pr-3">
                    <div>{x.institucion}</div>
                    <div className="text-xs text-tinta-3">{x.unidad_ejecutora} · {x.libramiento}</div>
                  </td>
                  <td className="max-w-[200px] py-2 pr-3">
                    {x.proveedor}
                    {x.cesion && <span className="ml-1 rounded bg-serie-2/15 px-1.5 text-xs text-tinta-2">cesión</span>}
                  </td>
                  <td className="max-w-[380px] py-2 pr-3 text-xs text-tinta-2">{x.concepto}</td>
                  <td className="py-2 pr-3 text-right">{rd(x.monto_bruto)}</td>
                  <td className="py-2 pr-3 text-right text-tinta-2">{rd(x.retencion)}</td>
                  <td className="py-2 pr-3 text-right font-semibold">{rd(x.monto_bruto * TASA)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {paginas > 1 && (
          <div className="mt-3 flex items-center justify-between text-sm text-tinta-2">
            <span>Página {pagina} de {paginas}</span>
            <div className="flex gap-2">
              {pagina > 1 && <Link href={enlace(pagina - 1)} className="rounded-md border border-borde px-3 py-1 hover:bg-fondo">← Anterior</Link>}
              {pagina < paginas && <Link href={enlace(pagina + 1)} className="rounded-md border border-borde px-3 py-1 hover:bg-fondo">Siguiente →</Link>}
            </div>
          </div>
        )}
      </Seccion>
    </div>
  );
}
