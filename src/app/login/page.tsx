import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { COOKIE, DIAS_SESION, emitirCookie } from "@/lib/sesion";

async function entrar(datos: FormData) {
  "use server";
  const clave = process.env.APP_CLAVE;
  if (!clave) redirect("/");
  if (String(datos.get("clave")) !== clave) {
    await new Promise((r) => setTimeout(r, 1500)); // frena los intentos automatizados
    redirect("/login?error=1");
  }
  (await cookies()).set(COOKIE, await emitirCookie(), { httpOnly: true, secure: true, sameSite: "lax", maxAge: DIAS_SESION * 86_400, path: "/" });
  revalidatePath("/", "layout"); // descarta lo que el navegador haya precargado sin sesión
  redirect("/");
}

export default async function Login({ searchParams }: PageProps<"/login">) {
  const { error } = await searchParams;
  return (
    <form action={entrar} className="mx-auto mt-16 max-w-sm space-y-4 rounded-lg border border-borde bg-superficie p-6">
      <h1 className="text-lg font-semibold">Entrar</h1>
      <p className="text-sm text-tinta-2">Tablero interno del CODIA. Escriba la contraseña de acceso.</p>
      <input name="clave" type="password" required autoFocus className="w-full rounded-md border border-borde px-3 py-2" />
      {error && <p className="text-sm text-malo">Contraseña incorrecta.</p>}
      <button className="w-full rounded-md bg-codia py-2 text-sm font-medium text-white">Entrar</button>
    </form>
  );
}
