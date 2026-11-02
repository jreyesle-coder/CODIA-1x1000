import type { Metadata } from "next";
import { Geist } from "next/font/google";
import Link from "next/link";
import Image from "next/image";
import "./globals.css";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "1x1000 CODIA",
  description: "1x1000 teórico del CODIA sobre los pagos de obras de la Tesorería Nacional (Decreto 319-98)",
};

const NAV = [
  { href: "/", texto: "Tablero" },
  { href: "/detalle", texto: "Libramientos" },
  { href: "/excluidos", texto: "USD y EUR" },
];

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${geist.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        <header className="border-b border-borde bg-superficie">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-8 gap-y-2 px-4 py-3">
            <Link href="/" className="flex items-center gap-3">
              <Image src="/logo-codia.png" alt="CODIA" width={182} height={40} priority />
              <span className="hidden border-l border-borde pl-3 text-sm font-semibold text-codia sm:block">1x1000 · Tesorería</span>
            </Link>
            <nav className="flex gap-1 text-sm">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} className="rounded-md px-3 py-1.5 text-tinta-2 hover:bg-fondo hover:text-tinta">
                  {n.texto}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">{children}</main>
        <footer className="border-t border-borde px-4 py-4 text-center text-xs text-tinta-3">
          Fuente: Tesorería Nacional, Pagos Detallados a Suplidores y Contratistas (concepto OBRAS). Cálculo teórico según el Decreto 319-98.
        </footer>
      </body>
    </html>
  );
}
