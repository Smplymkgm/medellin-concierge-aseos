# GitHub-First Roadmap

Goal: GitHub es la **fuente de verdad** del código. Los editores online (Apps Script editor, Google Sheets script attached) dejan de ser canónicos.

No-goal: Cambiar lógica de negocio, workflows de admin/aseadora, ni estructura de datos.

## Estado deseado

```
   GitHub (main)
       │
       ├─────▶ GitHub Action  ──▶  clasp push  ──▶  Apps Script (deployed)
       │
       └─────▶ GitHub Action  ──▶  build + deploy  ──▶  GitHub Pages
```

Cualquier cambio:
1. PR a `main`
2. CI: lint, tests, build
3. Merge
4. Auto-deploy a Apps Script + GitHub Pages
5. Zero copy-paste a editores

## Repo layout objetivo

Mínimo necesario para llegar al estado deseado. Mantiene compatibilidad con lo existente.

```
/
├── .clasp.json                  # configuración del Apps Script (sin token)
├── .claspignore                 # excluir docs/, app/, README.md
├── .github/
│   └── workflows/
│       ├── ci.yml               # lint + test en cada PR
│       ├── deploy-appsscript.yml # clasp push en merge a main
│       └── deploy-pages.yml     # build + push a gh-pages en merge a main
├── apps-script/                 # nuevo home de Code.gs / Sync.gs / appsscript.json
│   ├── Code.gs
│   ├── Sync.gs
│   └── appsscript.json
├── app/                         # frontend (sin cambios)
├── Index.html                   # raíz del Pages site
├── docs/                        # documentación (este folder)
└── README.md
```

### Decisión: ¿mover `Code.gs` a `apps-script/`?

Sí, **eventualmente**. Beneficios:
- Separación visual clara entre frontend y backend
- `.claspignore` más simple (claspignore todo excepto `apps-script/`)
- Permite tener más archivos `.gs` partidos por dominio (`Code.gs` partido en `Auth.gs`, `Aseos.gs`, `Propiedades.gs`, etc.) sin contaminar la raíz

Riesgo: requiere también mover `appsscript.json`. La primera vez que se haga `clasp push` desde el nuevo path puede sobrescribir el deployment si no se hace con cuidado. Mitigación: hacer el move con un commit dedicado + un `clasp pull` inmediato antes del primer `clasp push`.

## Pasos del roadmap (operativos)

### Paso 1 — `clasp` configurado localmente (Mike, 15 min)

Pre-requisito para todo lo demás. Solo lo hace el owner.

```bash
npm install -g @google/clasp
clasp login                      # OAuth flow
# Identifica el scriptId del proyecto actual:
#   editor → Settings → "Script ID"
clasp clone <scriptId> --rootDir .
# Esto crea .clasp.json (con scriptId, rootDir).
# Verificar diff: solo deben existir archivos que ya tenemos
git add .clasp.json .claspignore
git commit -m "infra: clasp config"
```

`.claspignore`:
```
**/**
!Code.gs
!Sync.gs
!appsscript.json
```

(Después del move a `apps-script/`, cambia a `!apps-script/**`.)

### Paso 2 — GitHub Secrets (Mike, 5 min)

En el repo GitHub → Settings → Secrets and variables → Actions:

| Secret | Cómo obtenerlo |
|---|---|
| `CLASPRC_JSON` | Contenido de `~/.clasprc.json` (generado por `clasp login`) |
| `CLASP_JSON` | Contenido de `.clasp.json` (scriptId del proyecto) |

Sin estos secrets, las actions de deploy no corren.

### Paso 3 — Workflow `deploy-appsscript.yml` (1 archivo, 30 min)

Activado en `push` a `main` cuando cambien `Code.gs`, `Sync.gs`, o `appsscript.json`. Hace:

1. Recuperar `~/.clasprc.json` y `.clasp.json` de los secrets
2. `clasp push` (sube cambios al script)
3. `clasp deploy --description "ci: ${{ github.sha }}"` (crea nueva versión)

Failsafe: el deployment ID se mantiene; nunca se reemplaza el URL. Si `clasp deploy` falla, abortar y notificar.

Ver `docs/CICD_ROADMAP.md` para el YAML completo.

### Paso 4 — Workflow `deploy-pages.yml` (1 archivo, 20 min)

Activado en `push` a `main` cuando cambien `Index.html` o `app/**`. Hace:

1. Checkout main
2. Por ahora: copy `Index.html` + `app/` directamente a `gh-pages` branch (no hay build)
3. Cuando se adopte Vite (out-of-scope ahora): `npm ci && npm run build && deploy dist/`

### Paso 5 — Workflow `ci.yml` (1 archivo, 15 min)

En cada PR:

1. Lint (`eslint app/*.jsx` con config mínima)
2. (Cuando exista) `npm test`

### Paso 6 — Mover `Code.gs`/`Sync.gs` a `apps-script/` (1 PR, 10 min, opcional)

Solo cuando los workflows estén verdes con la estructura plana. Beneficio cosmético principalmente.

### Paso 7 — Migrar `Code.gs` partido por dominio (1 PR, 1-2 h, opcional)

Romper `Code.gs` actual (~1046 líneas) en archivos más pequeños:

```
apps-script/
├── 00-config.gs       (CONFIG, getSS, hoyStr, fechaUtils)
├── 01-router.gs       (doPost, doGet, respond)
├── 10-auth.gs         (handleLogin, getPersonal)
├── 20-aseos-read.gs   (handleGetAseos, handleGetAllAseos, handleGetHistorial)
├── 21-aseos-write.gs  (handleCompletarAseo, handleAsignarAseo, handleMoverAseo, handleAgregarAseo)
├── 30-propiedades.gs  (handleGetPropiedades, handleAgregarPropiedad, handleActualizarPropiedad)
├── 31-personal.gs     (handleGetPersonal, handleActualizarPersonal)
├── 40-drive.gs        (handleGetUploadUrl, handleRegistrarVideo)
├── 50-externos.gs     (notificarHubspot, handleGetFormRespuestas)
├── 60-cron.gs         (autoCompletarAseosPasados)
├── 90-setup.gs        (agregarAdmin, llenarTodo, fixSheetNames, limpiarHojasDuplicadas, onOpen)
└── Sync.gs            (sincronizarCalendarios, sincronizarHojaAseos, sincronizarGoogleCalendar)
```

Apps Script concatena archivos `.gs` en orden alfabético, por eso los prefijos numéricos. Beneficio: cada archivo cabe en ~150 líneas, mucho más mantenible.

Cero cambios de lógica — solo división.

## Bus factor objetivo

Después del roadmap:

| Componente | Quien puede mantenerlo |
|---|---|
| Frontend | Cualquiera con acceso al repo |
| Backend `Code.gs` / `Sync.gs` | Cualquiera con acceso al repo + Action `deploy-appsscript` |
| Triggers programados | Aún solo el owner (los triggers viven en su cuenta), pero el **código** se actualiza vía CI |
| Spreadsheet | Owner + invitados |

Bus factor del **código backend**: del **1** actual al **N** (todos los colaboradores del repo).

Bus factor de la **identidad de ejecución** (triggers, Drive, Calendar): sigue siendo **1** (el owner). Esto solo se resuelve migrando triggers a GitHub Actions y storage a algo que no requiera Drive del owner.

## Riesgos del roadmap

Ver `docs/RISK_ANALYSIS.md` para detalle. Resumen:

- **Bajo**: archivos movidos a `apps-script/` con clasp config errónea sobreescriben deployment activo → mitigado con `clasp pull` antes del primer push
- **Bajo**: GitHub Secret expira (clasprc.json es OAuth refresh token) → tiene refresh, pero después de meses sin uso puede invalidarse → process documentado para regenerar
- **Medio**: alguien hace push a `main` con `Code.gs` roto → CI debe correr `clasp push` con un dry-run primero o tests
