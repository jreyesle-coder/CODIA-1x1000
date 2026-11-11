import { NextResponse, type NextRequest } from "next/server";
import { COOKIE, cookieValida } from "@/lib/sesion";

/** Pide la contraseña a quien no tenga una cookie de sesión válida. /api/sync se protege solo, con CRON_SECRET. */
export async function proxy(request: NextRequest) {
  const clave = process.env.APP_CLAVE;
  const ruta = request.nextUrl.pathname;
  if (!clave || ruta === "/login" || ruta === "/api/sync") return NextResponse.next();
  if (await cookieValida(request.cookies.get(COOKIE)?.value)) return NextResponse.next();
  const destino = request.nextUrl.clone();
  destino.pathname = "/login";
  destino.search = "";
  const res = NextResponse.redirect(destino);
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)"],
};
