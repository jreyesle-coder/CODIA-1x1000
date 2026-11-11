# 1x1000 CODIA · Tesorería

Tablero que calcula el 1x1000 teórico del CODIA (Decreto 319-98) sobre los pagos de **OBRAS** que publica la Tesorería Nacional en sus archivos mensuales «Pagos Detallados Suplidores y Contratistas». Se actualiza solo: cada día revisa el portal y, si hay un mes nuevo o corregido, lo descarga y recalcula. También se puede forzar con el botón **Actualizar ahora** del tablero.

En línea: https://codia-1x1000.vercel.app

## Cómo funciona

| Pieza | Qué hace |
|---|---|
| `src/lib/tesoreria.ts` | Encuentra los archivos de cada mes en tesoreria.gob.do y los descarga (el portal exige enviar su formulario con token). |
| `src/lib/lector.ts` | Lee el Excel: hojas RD$, USD y EUR; solo filas con «Concepto general» = OBRAS; marca cesiones a Banreservas / Banco Agrícola. |
| `src/lib/sincronizar.ts` | Descarga, compara con lo guardado (huella SHA-256) y reemplaza solo los meses que cambiaron. |
| `src/lib/almacen.ts` | Guarda en Supabase: lee con la clave pública y escribe a través de funciones protegidas con `CRON_SECRET`. Sin variables, en la PC, usa `datos/almacen.json`. |
| `src/app/api/sync/route.ts` + `vercel.json` | Vercel llama a `/api/sync` todos los días a las 7:00 a. m. (hora RD). |
| `src/app/acciones.ts` | Botón «Actualizar ahora» del tablero. |
| `src/lib/calculo.ts` | Resumen por mes y trimestre, 1x1000 bruto y depurado, por institución. |
| `src/app` | Tablero (`/`), libramientos con filtros (`/detalle`), obras en USD/EUR (`/excluidos`), entrada con contraseña (`/login`). |

## Variables de entorno (Vercel → Settings → Environment Variables)

| Variable | Qué es |
|---|---|
| `SUPABASE_URL` | `https://kvkesiumefziypsxryuf.supabase.co` (proyecto CODIARD) |
| `SUPABASE_ANON_KEY` | Clave pública del proyecto (Supabase → API Keys → *publishable*). No es secreta. |
| `CRON_SECRET` | Secreto del sincronizador. Su hash vive en `privado.secretos`; para cambiarlo, ver `supabase/migraciones/002_acceso.sql`. |
| `APP_CLAVE` | Contraseña para entrar al tablero. |

Si falta alguna, el tablero lo dice en pantalla. Después de agregar o cambiar variables hay que hacer **Deployments → ⋯ → Redeploy**.

## Probar en la PC

```bash
npm install
npm run sync      # descarga el año en curso (a Supabase si .env.local tiene las variables; si no, a datos/almacen.json)
npm run dev       # abre http://localhost:3000
npm test
```

## Base de datos

Proyecto Supabase CODIARD. Los archivos de `supabase/migraciones/` ya están aplicados (`001_esquema.sql` tablas; `002_acceso.sql` lectura pública + funciones de escritura con secreto).

## Límites del cálculo

- Solo pagos por la Cuenta Única del Tesoro: no incluye descentralizadas con tesorería propia ni ayuntamientos. La cifra es un piso.
- La retención que publica la Tesorería viene agregada; no se puede saber si incluye el 1x1000.
- Las obras en USD y EUR se listan aparte y no entran en el cálculo.
