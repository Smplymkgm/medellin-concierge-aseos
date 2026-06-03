# Target Architecture — Medcon Cleanings (SaaS-ready)

Objetivo: que la app sirva no solo a Medcon sino a docenas de admins de servicios de aseo de Airbnb en LATAM, con datos confiables, despliegue automatizado y dependencia mínima del editor de Apps Script.

## Stack objetivo

| Capa | Tech | Por qué |
|---|---|---|
| Frontend | React 18 + Vite build → bundle estático | Quita Babel del cliente, baja TTI 1.5s+ |
| Hosting frontend | GitHub Pages o Cloudflare Pages | Cero cost en escala media |
| Backend API | Apps Script `doPost` (corto plazo) → migración gradual a Cloudflare Workers o Node/Fastify (largo plazo) | Apps Script tiene rate limit de 6 min/exec, no escala bien con multi-tenant |
| Database | Postgres (Supabase o Neon) | Joins reales, RLS por tenant, transacciones |
| Storage media | Google Drive (transición) → S3 / Cloudflare R2 | Drive impone cuotas y dependencia de OAuth del owner |
| Auth | Supabase Auth o Clerk (multi-tenant) con PIN como secondary factor | El PIN en sheet es OK para 1 admin, no escala |
| iCal source | Pull periódico desde Cloudflare Worker cron | Apps Script ya no se queda como cron primario |
| Calendar | Google Calendar API directa (no via Apps Script) | Mantener integración pero sin la dependencia de un editor |
| CI/CD | GitHub Actions: clasp push, Vite build, Pages deploy | Cero copy-paste al editor |
| Tests | Vitest (frontend) + supertest o Apps Script local tests | Confianza para refactorizar |

## Diagrama objetivo

```
┌──────────────────────┐         ┌─────────────────────┐
│  Vite-built SPA      │ ──────▶ │  Edge API (Worker)  │
│  (Cloudflare Pages)  │ ◀────── │  validates JWT      │
└──────────────────────┘         └──────────┬──────────┘
                                            │
                                            ▼
                                  ┌─────────────────────┐
                                  │  Postgres (Neon)    │
                                  │  + RLS multi-tenant │
                                  └─────────┬───────────┘
                                            │
                          ┌─────────────────┼──────────────────┐
                          ▼                 ▼                  ▼
                  ┌───────────────┐ ┌──────────────┐  ┌───────────────┐
                  │ R2 (videos)   │ │ Cron Worker  │  │ Google APIs   │
                  │               │ │ (iCal sync)  │  │ (Calendar     │
                  │               │ │              │  │  events only) │
                  └───────────────┘ └──────────────┘  └───────────────┘
```

## Multi-tenancy

| Aspecto | Hoy | Objetivo |
|---|---|---|
| Tenant boundary | 1 spreadsheet = 1 cliente | `tenant_id` column en cada tabla, RLS policy |
| Auth | PIN compartido por equipo | OAuth/SSO admin + PIN para aseadoras |
| Branding | Hardcoded "Medcon Cleanings" | Logo + nombre del tenant en `tenant.config` |
| Pricing | Por aseo, columna en Propiedades | Plan de subscripción por tenant + precios por servicio |
| Custom domain | Solo `*.github.io` | `<tenant>.medcon.app` o dominio del cliente |

## Modelo de datos objetivo (resumen)

Detalle en `DATABASE_DESIGN.md`. Tablas principales:

- `tenants` (organizations)
- `users` (admins + aseadoras, FK tenant)
- `properties` (FK tenant)
- `reservations` (raw iCal data, FK property)
- `cleanings` (1 por reservation, FK reservation + assignee)
- `cleaning_reports` (form data del completar, FK cleaning)
- `media` (videos en R2, FK cleaning)
- `audit_log` (toda mutación)

## Apps Script: rol residual

Apps Script no muere de un día para otro. Pasa a ser:

1. **iCal sync legacy** (transitorio, hasta que el Worker cron esté listo)
2. **Google Calendar bridge** (sigue siendo el más simple para mantener eventos con guests)
3. **Backfill / migración** desde sheets → Postgres (script único)

Ver `APPSCRIPT_REDUCTION_PLAN.md` para fases.

## Performance objetivo

| Métrica | Hoy | Objetivo |
|---|---|---|
| Time to interactive (3G fast) | ~4 s (Babel client-side) | <1.5 s (bundle) |
| Login latency (cold) | 1.5–3 s | <500 ms |
| Refresh `getDatos` | 1–2 s | <300 ms con cache |
| Sync Airbnb 120 reservas | ~30 s (pre Fase 7) → ~5 s (hoy) | <3 s |

## Lo que sobrevive del actual

- React component model (`AseoCard`, `Sheet`, etc.) — buena base
- Data model (códigos, status, columnas) — solo cambia el backing store
- Service identity (Medcon como tenant #1)
- Drive folders por propiedad (transición lenta a R2)
