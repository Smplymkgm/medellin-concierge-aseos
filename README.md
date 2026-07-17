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

## Lógica de sincronización (robustez)

`sincronizarCalendarios` (iCal Airbnb → Sheets) sigue estas reglas para no perder ni ensuciar datos:

- **Soft-cancel seguro**: una reserva ausente del feed solo se marca cancelada (se quita del master) si (1) su propiedad respondió el iCal, (2) es a futuro, y (3) lleva ≥2 syncs ausente (debounce ~5h vía ScriptProperties). Absorbe feeds parciales/caídas de Airbnb. Los falsos cancelados se auto-recuperan en el siguiente sync.
- **Master = solo pendientes**: "Todas las Reservas" lleva solo reservas vigentes. Completados viven en "Todos los Aseos"; cancelados/finalizados no se escriben en el master.
- **Sin duplicados**: dedup por código (único en Airbnb) y por estadía (propiedad + checkout).
- **Limpieza garantizada**: `limpiarDatos` quita el filtro y usa `clearContent` sobre toda la cuadrícula (no falla con filtros/rangos protegidos).
- **Protección de pago**: toda fila en "Todos los Aseos" con fecha de completado (col M) nunca se borra, aunque cambie su Estado.
- **Estado "Iniciado" protegido**: las filas `Iniciado` (aseadora ya llegó a la propiedad) también se conservan en la limpieza del sync; el estado vive solo en "Todos los Aseos" (la validación del master no lo acepta) y gana el identity-merge sobre un pendiente plano.

Menú → Setup (avanzado) → **Recuperar reservas mal canceladas** restaura cancelados falsos a mano si hace falta.

## Triggers programados (Apps Script)

| Función | Frecuencia |
|---|---|
| `sincronizarCalendarios` | Cada 6 h + 10 AM diario |
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

Arquitectura, decisiones, roadmaps y handoff en [`docs/`](docs/) — empieza por [HANDOFF.md](docs/HANDOFF.md) (entrega cold) y [CURRENT_ARCHITECTURE.md](docs/CURRENT_ARCHITECTURE.md) (estado actual).

## Cuentas + credenciales

- Owner: `michaelmgm1249@gmail.com` · Owner del Apps Script: `development@medellinconcierge.net`
- Admin app: usuario `Admin`, PIN `2025`
- Aseadoras: Ana (1234), Fernanda (5678), Claudia (9012)
- Secrets en GitHub Actions: `CLASPRC_JSON` (caduca — renovado 15 jul 2026, ver [HANDOFF.md](docs/HANDOFF.md)), `CLASP_JSON`, `APPSCRIPT_DEPLOYMENT_ID`, `GAS_URL`
- Secrets en Apps Script: `HUBSPOT_API_KEY` (opcional)
