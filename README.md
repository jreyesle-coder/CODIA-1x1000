# 1x1000 CODIA · Tesorería

Tablero que calcula el 1x1000 teórico del CODIA (Decreto 319-98) sobre los pagos de **OBRAS** que publica la Tesorería Nacional en sus archivos mensuales «Pagos Detallados Suplidores y Contratistas». Se actualiza solo: cada día revisa el portal y, si hay un mes nuevo o corregido, lo descarga y recalcula.

## Cómo funciona

| Pieza | Qué hace |
|---|---|
| `src/lib/tesoreria.ts` | Encuentra los archivos de cada mes en tesoreria.gob.do y los descarga (el portal exige enviar su formulario con token). |
| `src/lib/lector.ts` | Lee el Excel: hojas RD$, USD y EUR; solo filas con «Concepto general» = OBRAS; marca cesiones a Banreservas / Banco Agrícola. |
| `src/lib/sincronizar.ts` + `worker/sync.ts` | Descarga, compara con lo guardado (huella SHA-256) y reemplaza solo los meses que cambiaron. |
| `src/lib/calculo.ts` | Resumen por mes y trimestre, 1x1000 bruto y depurado, por institución. |
| `.github/workflows/sync.yml` | Corre la sincronización todos los días a las 7:00 a. m. (hora RD). También se puede lanzar a mano desde GitHub → Actions. |
| `src/app` | Tablero (`/`), libramientos con filtros (`/detalle`), obras en USD/EUR (`/excluidos`), entrada con contraseña (`/login`). |

## Probar en la PC

```bash
npm install
npm run sync      # descarga el año en curso a datos/almacen.json
npm run dev       # abre http://localhost:3000
npm test
```

## Puesta en línea (una sola vez)

1. **Supabase**: crear un proyecto, abrir SQL Editor y correr `supabase/migraciones/001_esquema.sql`.
2. **GitHub**: subir este repositorio. En Settings → Secrets and variables → Actions, crear los secretos `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`. Luego en Actions → «Sincronizar Tesorería» → Run workflow, para la primera carga.
3. **Vercel**: importar el repositorio y poner las variables `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` y `APP_CLAVE`.

## Límites del cálculo

- Solo pagos por la Cuenta Única del Tesoro: no incluye descentralizadas con tesorería propia ni ayuntamientos. La cifra es un piso.
- La retención que publica la Tesorería viene agregada; no se puede saber si incluye el 1x1000.
- Las obras en USD y EUR se listan aparte y no entran en el cálculo.
