"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const PESTANAS = [
  { href: "/", texto: "Tablero" },
  { href: "/detalle", texto: "Libramientos" },
  { href: "/excluidos", texto: "USD y EUR" },
];

/** Pestañas del encabezado; marca la activa y no se muestra en la pantalla de contraseña. */
export function Nav() {
  const ruta = usePathname();
  if (ruta === "/login") return null;
  return (
    <nav className="flex gap-1 text-sm">
      {PESTANAS.map((p) => {
        const activa = p.href === "/" ? ruta === "/" : ruta.startsWith(p.href);
        return (
          <Link key={p.href} href={p.href} aria-current={activa ? "page" : undefined}
            className={`rounded-md px-3 py-1.5 ${activa ? "bg-codia text-white" : "text-tinta-2 hover:bg-fondo hover:text-tinta"}`}>
            {p.texto}
          </Link>
        );
      })}
    </nav>
  );
}
