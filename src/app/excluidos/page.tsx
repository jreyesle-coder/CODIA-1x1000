import { cargar, num } from "@/lib/datos";
import { MESES_LARGOS } from "@/lib/calculo";
import { Seccion, Tarjeta } from "@/components/ui";

export const dynamic = "force-dynamic";

const moneda = (n: number, m: string) => `${m === "USD" ? "US$" : "€"}${n.toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;

export default async function Excluidos({ searchParams }: PageProps<"/excluidos">) {
  const { anio } = await searchParams;
  const d = await cargar(typeof anio === "string" ? anio : undefined);
  const filas = [...d.divisas].sort((a, b) => a.mes - b.mes || (a.fecha ?? "").localeCompare(b.fecha ?? ""));
  const tot = (m: string) => filas.filter((f) => f.moneda === m);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Pagos de obra en dólares y euros · {d.anio}</h1>
        <p className="text-sm text-tinta-2">No entran en el cálculo del 1x1000. Montos en su moneda original, sin convertir a pesos.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {["USD", "EUR"].map((m) => (
          <Tarjeta key={m} titulo={`Obras en ${m}`} valor={moneda(tot(m).reduce((s, f) => s + f.monto_bruto, 0), m)} nota={`${num(tot(m).length)} pagos`} />
        ))}
      </div>
      <Seccion titulo={`${filas.length} pagos`}>
        <div className="overflow-x-auto">
          <table className="cifra w-full min-w-[1000px] text-sm">
            <thead>
              <tr className="border-b border-borde text-left text-xs text-tinta-2">
                {["Mes", "Institución / Unidad ejecutora", "Contratista", "Concepto", "Monto bruto", "Retención"].map((h, i) => (
                  <th key={h} className={`py-2 pr-3 font-medium ${i >= 4 ? "text-right" : ""}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filas.map((x, i) => (
                <tr key={i} className="border-b border-borde align-top">
                  <td className="py-2 pr-3 text-tinta-2">{MESES_LARGOS[x.mes - 1]}</td>
                  <td className="max-w-[260px] py-2 pr-3"><div>{x.institucion}</div><div className="text-xs text-tinta-3">{x.unidad_ejecutora}</div></td>
                  <td className="max-w-[200px] py-2 pr-3">{x.proveedor}</td>
                  <td className="max-w-[380px] py-2 pr-3 text-xs text-tinta-2">{x.concepto}</td>
                  <td className="whitespace-nowrap py-2 pr-3 text-right">{moneda(x.monto_bruto, x.moneda)}</td>
                  <td className="whitespace-nowrap py-2 pr-3 text-right text-tinta-2">{moneda(x.retencion, x.moneda)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Seccion>
    </div>
  );
}
