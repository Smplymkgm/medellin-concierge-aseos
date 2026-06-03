# Database Design — Postgres target

DB de destino para migrar lejos de Google Sheets cuando llegue el momento. Diseñado para multi-tenant desde el día 1 y para soportar el modelo actual de Medcon sin pérdida.

## Convenciones

- Todas las tablas tienen `id uuid` PK (gen_random_uuid())
- Todas tienen `tenant_id uuid` FK → `tenants(id)` para RLS
- `created_at`, `updated_at` con default `now()`
- `deleted_at timestamptz` (soft-delete; nunca se borra físicamente)
- Enums en lugar de strings libres

## Esquema

```sql
-- Multi-tenancy
create table tenants (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,                  -- 'medcon', 'lima-cleaning', etc.
  name text not null,
  brand_color text,
  brand_logo_url text,
  timezone text not null default 'America/Bogota',
  currency text not null default 'COP',
  created_at timestamptz not null default now()
);

-- Personal: admins + aseadoras
create type user_role as enum ('admin', 'aseadora');

create table users (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  role user_role not null,
  pin_hash text,                              -- bcrypt; nunca plain
  drive_folder_url text,                      -- legacy compat
  form_url text,                              -- legacy compat
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, name)
);

-- Propiedades (Airbnb units)
create table properties (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  external_code text not null,                -- '#0083' del sheet legacy
  name text not null,
  ical_url text,
  access_info text,                           -- claves, dirección
  default_price_cents int not null default 0,
  default_assignee_id uuid references users(id),
  drive_folder_id text,                       -- legacy compat
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, external_code)
);

-- Reservas crudas del iCal
create type reservation_status as enum ('confirmed', 'cancelled');

create table reservations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  property_id uuid not null references properties(id) on delete cascade,
  external_code text not null,                -- 'HM...' o 'MAN-...'
  checkin date not null,
  checkout date not null,
  nights int not null,
  status reservation_status not null default 'confirmed',
  guest_notes text,
  source text not null default 'airbnb',      -- 'airbnb' | 'manual'
  ical_uid text,                              -- raw UID del iCal para dedupe
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (tenant_id, property_id, external_code)
);

-- Aseos: 1 cleaning por reservation (en su checkout)
create type cleaning_status as enum ('pending', 'urgent', 'completed', 'cancelled');

create table cleanings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  reservation_id uuid not null references reservations(id) on delete cascade,
  property_id uuid not null references properties(id) on delete cascade,
  cleaner_id uuid references users(id),       -- null = unassigned
  scheduled_date date not null,               -- = reservations.checkout
  status cleaning_status not null default 'pending',
  price_cents int not null,                   -- snapshot del precio al asignar
  notes text,
  completed_at timestamptz,
  google_calendar_event_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, reservation_id)
);

create index cleanings_tenant_date on cleanings(tenant_id, scheduled_date);
create index cleanings_cleaner_status on cleanings(tenant_id, cleaner_id, status);

-- Reporte del formulario al completar (cols 14-20 actuales)
create table cleaning_reports (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  cleaning_id uuid not null unique references cleanings(id) on delete cascade,
  entrada_at time,
  salida_at time,
  revision jsonb,                             -- {habitaciones:'ok', cocina:'review', ...}
  reposicion jsonb,                           -- {jabon:true, papelBano:false, ...}
  funcionamiento jsonb,                       -- {aires:'ok', tvs:'review', ...}
  reporte text,
  submitted_at timestamptz not null default now()
);

-- Media (videos del aseo)
create table media (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  cleaning_id uuid not null references cleanings(id) on delete cascade,
  storage text not null default 'gdrive',     -- 'gdrive' | 'r2' | 's3'
  external_id text not null,                  -- Drive file ID o R2 key
  url text,
  filename text,
  size_bytes bigint,
  uploaded_at timestamptz not null default now()
);

-- Audit log: toda mutación crítica
create table audit_log (
  id bigserial primary key,
  tenant_id uuid not null,
  user_id uuid,
  action text not null,                       -- 'cleaning.assigned', 'cleaning.completed', etc.
  entity_type text not null,
  entity_id uuid not null,
  diff jsonb,                                 -- {before, after}
  ip text,
  user_agent text,
  occurred_at timestamptz not null default now()
);

create index audit_log_tenant_time on audit_log(tenant_id, occurred_at desc);
create index audit_log_entity on audit_log(entity_type, entity_id);
```

## RLS (Row-Level Security)

```sql
alter table users          enable row level security;
alter table properties     enable row level security;
alter table reservations   enable row level security;
alter table cleanings      enable row level security;
alter table cleaning_reports enable row level security;
alter table media          enable row level security;
alter table audit_log      enable row level security;

-- Política base: solo ves tu tenant
create policy tenant_isolation on cleanings
  using (tenant_id = current_setting('app.tenant_id')::uuid);
-- (replicar para todas las tablas)
```

JWT incluye `tenant_id`; el edge worker hace `set local app.tenant_id = '<uuid>'` antes de cada query.

## Mapeo desde el modelo actual

| Hoja Google Sheets | Tabla Postgres |
|---|---|
| `Propiedades` | `properties` |
| `Personal` | `users` (role='aseadora' o 'admin') |
| `Todas las Reservas` | `reservations` + `cleanings` (split) |
| `Todos los Aseos` cols 1-13 | `cleanings` |
| `Todos los Aseos` cols 14-20 | `cleaning_reports` |
| `Videos Aseos` | `media` |
| (nuevo) | `audit_log` |
| (nuevo) | `tenants` (Medcon = tenant #1) |

## Migración

Detallada en `MIGRATION_ROADMAP.md`. Resumen:

1. Crear schema en Neon/Supabase
2. Apps Script `exportAllToPostgres()` (one-shot)
3. Apps Script `dualWrite()` activado por feature flag (sheets + postgres simultáneo)
4. Frontend leyendo de Postgres detrás de flag
5. Cutover: Apps Script ya solo lee iCal y propaga a Postgres
