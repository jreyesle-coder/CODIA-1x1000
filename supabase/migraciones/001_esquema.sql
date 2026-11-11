-- CODIA 1x1000 · esquema inicial
-- Correr una vez en Supabase → SQL Editor.

create table if not exists archivos_tn (
  anio            int  not null,
  mes             int  not null check (mes between 1 and 12),
  phoca_id        int  not null,
  titulo          text not null,
  url             text not null,
  sha256          text not null,
  filas_obras     int  not null,
  descargado_en   timestamptz not null default now(),
  primary key (anio, mes)
);

create table if not exists pagos_obras (
  id                bigint generated always as identity primary key,
  anio              int  not null,
  mes               int  not null,
  moneda            text not null check (moneda in ('RD', 'USD', 'EUR')),
  fecha             date,
  institucion       text not null,
  unidad_ejecutora  text,
  libramiento       text,
  proveedor         text,
  concepto          text,
  monto_bruto       numeric(18, 2) not null,
  retencion         numeric(18, 2) not null,
  monto_neto        numeric(18, 2) not null,
  cesion            boolean not null default false
);
create index if not exists pagos_obras_periodo on pagos_obras (anio, mes);
create index if not exists pagos_obras_libramiento on pagos_obras (libramiento);

create table if not exists sincronizaciones (
  id          bigint generated always as identity primary key,
  inicio      timestamptz not null default now(),
  fin         timestamptz,
  estado      text not null,          -- ok | sin_cambios | error
  detalle     text
);

-- RLS activo. Las reglas de acceso (lectura pública con la clave publishable y escritura
-- solo por RPC con secreto) se definen en 002_acceso.sql y 003_candado_mes.sql.
alter table archivos_tn      enable row level security;
alter table pagos_obras      enable row level security;
alter table sincronizaciones enable row level security;
