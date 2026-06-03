# Target Architecture

Objetivo realista, sin SaaS, sin enterprise. Mismo producto, mismo modelo de datos, mismos workflows. Lo único que cambia: **dónde vive el código** y **cómo se despliega**.

## Estado deseado

```
                  ┌────────────────────────────────┐
                  │           GitHub (main)         │
                  │   Code.gs / Sync.gs / app/...   │
                  └───────────────┬────────────────┘
                                  │ push
              ┌───────────────────┼────────────────────┐
              │                                        │
              ▼                                        ▼
   ┌──────────────────────┐              ┌────────────────────────┐
   │ Action: deploy-pages │              │ Action: deploy-appsscript │
   │  + auto cache-bust   │              │  clasp push + deploy    │
   └──────────┬───────────┘              └──────────┬─────────────┘
              │                                     │
              ▼                                     ▼
     ┌────────────────┐                  ┌──────────────────────┐
     │ GitHub Pages   │                  │  Apps Script (Web)   │
     │ (frontend SPA) │                  │  Single deployment ID │
     └────────┬───────┘                  │  URL preserved        │
              │ user                     └──────────┬───────────┘
              │                                     │
              └────────── POST JSON ───────────────▶│
                                                    │
                       ┌────────────────────────────┼───────────────────┐
                       ▼                            ▼                   ▼
              ┌─────────────────┐         ┌──────────────────┐   ┌─────────────┐
              │ Google Sheets   │         │ Google Calendar  │   │ Google Drive │
              │ (5 hojas)       │         │ del owner        │   │ folders     │
              │ (sin cambios)   │         │ (sin cambios)    │   │ (sin cambios)│
              └─────────────────┘         └──────────────────┘   └─────────────┘
                       ▲
                       │ trigger 6h (Apps Script)
                       │
              ┌─────────────────┐
              │ Airbnb iCal     │
              │ (sin cambios)   │
              └─────────────────┘
```

Diferencias contra el estado actual: **NINGUNA EN RUNTIME**. Mismas hojas, mismos triggers, mismos endpoints, mismo URL.

Diferencias en **operación**:
- Editar `Code.gs` ya no pasa por el editor: PR a GitHub → CI → deploy
- Editar frontend ya no es copy-paste a `gh-pages`: PR → CI → deploy
- Cache buster no es manual
- Cualquier colaborador del repo puede mantener el backend (antes: solo el owner del script)

## Componentes (estado deseado)

| Componente | Donde corre | Dueño del runtime | Dueño del código |
|---|---|---|---|
| Frontend SPA | GitHub Pages (`gh-pages`) | GitHub | Repo |
| API Web | Apps Script Web App | Owner's Google account | **Repo** (via clasp) |
| iCal sync trigger | Apps Script trigger c/6h | Owner's Google account | Repo |
| Calendar sync trigger | Apps Script trigger c/2h | Owner's Google account | Repo |
| Auto-complete trigger | Apps Script trigger 22:00 | Owner's Google account | Repo |
| Drive uploads | Apps Script (resumable URL) | Owner's Google account | Repo |
| Hojas Sheets | Spreadsheet del owner | Owner's Google account | N/A (data) |

**Cambio fundamental** vs hoy: la columna "Dueño del código" pasa de "Owner del editor" a "Repo" para todo lo del backend.

## Frontend

Sin cambios significativos. Sigue siendo:

- React 18 + Babel-in-browser (no build step todavía)
- Cargado vía `<script src="app/*.jsx?v=...">` desde `Index.html`
- Servido por GitHub Pages

Único cambio: cache buster `?v=N` reemplazado por `?v=<SHA del commit>` inyectado por CI. El número se actualiza solo.

(Adopción de Vite + bundle: explícitamente fuera de scope. Es deuda técnica conocida pero no bloquea la reducción de Apps Script.)

## Backend

Apps Script con:

- Mismo Web App URL (deployment ID pin-eado, no cambia entre deploys)
- Mismo modelo de hojas
- Mismas funciones
- Mismos triggers
- Mismos OAuth scopes

Diferencia: el **código** vive en `main` del repo. CI hace `clasp push` + `clasp deploy --deploymentId <fixed>`.

Estructura objetivo de archivos (opcional, recomendado):

```
apps-script/
├── 00-config.gs        # CONFIG, getSS, utilidades fecha
├── 01-router.gs        # doPost, doGet, respond
├── 10-auth.gs          # handleLogin, getPersonal
├── 20-aseos-read.gs    # handleGetAseos, handleGetAllAseos, handleGetHistorial, helpers
├── 21-aseos-write.gs   # handleCompletarAseo, handleAsignarAseo, handleMoverAseo, handleAgregarAseo
├── 30-propiedades.gs   # CRUD propiedades + crearCarpetaPropiedad
├── 31-personal.gs      # handleGetPersonal, handleActualizarPersonal
├── 40-drive.gs         # handleGetUploadUrl, handleRegistrarVideo, getCarpetaRaiz
├── 50-externos.gs      # notificarHubspot, handleGetFormRespuestas
├── 60-cron.gs          # autoCompletarAseosPasados
├── 90-setup.gs         # agregarAdmin, llenarTodo, fixSheetNames, limpiarHojasDuplicadas, onOpen
├── Sync.gs             # sincronizarCalendarios, sincronizarHojaAseos, sincronizarGoogleCalendar
└── appsscript.json
```

Cero cambios de lógica. Solo refactor físico.

## Lo que NO está en el target

- ❌ Migrar a Postgres
- ❌ Multi-tenant
- ❌ SSO/OAuth para admins
- ❌ Vite bundle
- ❌ Mobile native app
- ❌ Reescribir lógica en Node/TypeScript

Todo eso queda para fases futuras que no son parte de este objetivo.

## Test plan del target

Después de implementar el target (ver `IMPLEMENTATION_ORDER.md`):

1. Mike hace un cambio cosmético al frontend, `git push`. En <2 min ve el cambio en producción. ✅
2. Mike hace un cambio al backend, `git push`. En <2 min la API tiene el nuevo handler. URL no cambia. ✅
3. Las aseadoras siguen viendo y completando aseos exactamente igual que antes. ✅
4. El admin sigue asignando y editando exactamente igual que antes. ✅
5. El sync de Airbnb sigue corriendo c/6h con el código nuevo. ✅
6. Calendar y Drive siguen funcionando con la identidad del owner. ✅

Si los 6 se cumplen, el target está vivo en producción.
