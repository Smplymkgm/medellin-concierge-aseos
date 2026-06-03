# Medcon Cleanings — Mobile cleaning management for Airbnb properties

Sistema interno para gestión de aseos en propiedades de alquiler corto en Medellín.

## Live

- **App (aseadora + admin)**: https://smplymkgm.github.io/medellin-concierge-aseos/
- **API (Apps Script Web App)**: https://script.google.com/macros/s/AKfycbwcMH9Ovbh0kS1QE_8kIqhnBd3fjHqYDvRwONARydXoYj67U9Kr5wT7Nukndbpo0tNG/exec
- **Repo**: https://github.com/smplymkgm/medellin-concierge-aseos

## Stack

| Capa | Tech |
|---|---|
| Frontend | React 18 + Babel-in-browser (no build) |
| Hosting frontend | GitHub Pages (`gh-pages` branch) |
| Backend | Google Apps Script (V8) |
| Database | Google Sheets |
| Storage media | Google Drive |
| Calendar | Google Calendar |

## Cómo desplegar

**Frontend o backend — el flujo es el mismo:**

```bash
git push origin main
```

CI hace el resto:

- `app/**` o `Index.html` → `deploy-pages.yml` → publica en `gh-pages` con cache buster auto (`?v=<SHA>`)
- `Code.gs`, `Sync.gs`, `appsscript.json` → `deploy-appsscript.yml` → `clasp push` + `clasp deploy --deploymentId <pinned>` (URL del backend nunca cambia)
- Cualquier cambio en `main` → `ci.yml` valida sintaxis `.gs` + parses JSX

## Triggers programados (Apps Script)

| Función | Frecuencia |
|---|---|
| `sincronizarCalendarios` | Cada 6 h |
| `sincronizarGoogleCalendar` | Cada 2 h |
| `autoCompletarAseosPasados` | 10 PM diario |

## Menú del Spreadsheet

| Item | Función |
|---|---|
| Sincronizar Airbnb | `sincronizarCalendarios` manual |
| Sincronizar Google Calendar | `sincronizarGoogleCalendar` manual |
| Crear triggers automáticos | `crearTriggersAutomaticos` (one-shot) |
| Agregar Admin a Personal | `agregarAdmin` (one-shot) |
| Limpiar hojas duplicadas con emojis | `limpiarHojasDuplicadas` |
| Self-test (diagnóstico) | `runSelfTest` |

## Documentación

Toda la arquitectura, decisiones, roadmaps y handoff están en [`docs/`](docs/):

- [HANDOFF.md](docs/HANDOFF.md) — entrega rápida para alguien que tome el proyecto cold
- [CURRENT_ARCHITECTURE.md](docs/CURRENT_ARCHITECTURE.md) — estado actual
- [TARGET_ARCHITECTURE.md](docs/TARGET_ARCHITECTURE.md) — estado deseado (sin SaaS)
- [RESPONSIBILITIES_MAP.md](docs/RESPONSIBILITIES_MAP.md) — quién hace qué hoy
- [APPSCRIPT_AUDIT.md](docs/APPSCRIPT_AUDIT.md) — categorización función por función
- [GITHUB_FIRST_ROADMAP.md](docs/GITHUB_FIRST_ROADMAP.md) — flujo de desarrollo
- [CICD_ROADMAP.md](docs/CICD_ROADMAP.md) — workflows y secretos
- [APPSCRIPT_REDUCTION_PLAN.md](docs/APPSCRIPT_REDUCTION_PLAN.md) — fases para reducir dependencia
- [TECHNICAL_DEBT.md](docs/TECHNICAL_DEBT.md) — inventario priorizado
- [RISK_ANALYSIS.md](docs/RISK_ANALYSIS.md) — riesgos identificados y mitigaciones
- [IMPLEMENTATION_ORDER.md](docs/IMPLEMENTATION_ORDER.md) — orden de pasos
- [DATABASE_DESIGN.md](docs/DATABASE_DESIGN.md) — schema Postgres (futuro lejano)
- [MIGRATION_ROADMAP.md](docs/MIGRATION_ROADMAP.md) — fases largo plazo

## Cuentas + credenciales

- Owner: `michaelmgm1249@gmail.com`
- Admin app: usuario `Admin`, PIN `2025`
- Aseadoras: Ana (1234), Fernanda (5678), Claudia (9012)
- Secrets en GitHub Actions: `CLASPRC_JSON`, `CLASP_JSON`, `APPSCRIPT_DEPLOYMENT_ID`, `GAS_URL`
- Secrets en Apps Script: `HUBSPOT_API_KEY` (opcional)
