# Responsibilities Map — Where each piece runs today

Snapshot of the current system. Strictly factual; no aspirational targets.

## Capa por capa

| Responsabilidad | Donde corre hoy | Quien lo invoca | Notas |
|---|---|---|---|
| **Servir HTML/JSX/CSS** | GitHub Pages (`gh-pages` branch) | Browser | `Index.html` + `app/*.jsx` + `app/styles.css` |
| **Babel JSX→JS** | Browser (in-runtime) | Browser | `@babel/standalone` 7.29 desde unpkg |
| **React render** | Browser | Browser | React 18 desde unpkg |
| **Sesión** | Browser `localStorage` | App | Clave `medcon_session_v1` |
| **API HTTP** | Apps Script `doPost` | App (fetch) | Single URL `script.google.com/macros/s/.../exec` |
| **Validación de PIN** | Apps Script `handleLogin` | doPost | Hash en plano en col C de hoja `Personal` |
| **Lectura de aseos** | Apps Script `getDatos`/`getAllAseos` | doPost | Lee directo de hoja `Todos los Aseos` |
| **Escritura de aseos** | Apps Script `handleCompletarAseo`, `handleAsignarAseo`, `handleMoverAseo`, `handleAgregarAseo` | doPost | LockService 10s |
| **Filtros historial** | Frontend (client-side) + endpoint `getHistorial` (no consumido aún) | App | Tab Historial filtra del array que vino en `getDatos` |
| **CRUD propiedades** | Apps Script `handleGetPropiedades`, `handleAgregarPropiedad`, `handleActualizarPropiedad` | doPost | Crea folder en Drive al agregar |
| **CRUD personal** | Apps Script `handleGetPersonal`, `handleActualizarPersonal` | doPost | Edita PIN/email/tel en hoja `Personal` |
| **Drive uploads** | Apps Script `handleGetUploadUrl` (resumable URL) + `handleRegistrarVideo` (logging) | doPost → Drive API v3 | OAuth del owner del script |
| **iCal sync** | Apps Script `sincronizarCalendarios` (Sync.gs) | Trigger time-based 6h | UrlFetchApp + LockService 20s |
| **Hoja Aseos sync** | Apps Script `sincronizarHojaAseos` (Sync.gs) | Llamado al final de `sincronizarCalendarios` | LockService 20s, batch writes |
| **Google Calendar sync** | Apps Script `sincronizarGoogleCalendar` (Sync.gs) | Trigger time-based 2h | CalendarApp del owner |
| **Auto-complete past-due** | Apps Script `autoCompletarAseosPasados` | Trigger time-based 22:00 diario | Marca Completado los Pendientes con checkout < hoy |
| **HubSpot notification** | Apps Script `notificarHubspot` | `handleAsignarAseo` | `PropertiesService.HUBSPOT_API_KEY` |
| **Lectura de Form respuestas** | Apps Script `handleGetFormRespuestas` | doPost | Lee otro spreadsheet hardcoded ID |
| **Menú Spreadsheet** | Apps Script `onOpen` | Apertura del Sheet | UI helpers para Mike |
| **Setup helpers** | Apps Script `llenarTodo`, `fixSheetNames`, `agregarAdmin`, `limpiarHojasDuplicadas`, `crearTriggersAutomaticos`, `debugSheets`, `getSpreadsheetId` | Mike manual desde editor | One-shot |
| **Deploy frontend** | Manual: `git push` a `gh-pages` o commit a `main` (sin automatización) | Mike | Ningún CI |
| **Deploy backend** | Manual: copy-paste en editor + Deploy → Manage → Edit → New version | Mike | Ningún CI; sin versionado en Git linked |
| **Tests** | Inexistentes | — | — |

## Data flow simplificado

```
                                  ┌────────────────────┐
                                  │  Airbnb iCal feeds │
                                  └─────────┬──────────┘
                                            │ pull 6h
                                            ▼
┌──────────────┐  ┌────────────┐   ┌────────────────────┐
│   Browser    │──│ Apps Script│──▶│ Sheets (5 tablas)  │
│   (React)    │◀─│   doPost   │◀──│                    │
└──────────────┘  └─────┬──────┘   └────────────────────┘
                        │                     ▲
                        │ optional            │ sync 2h
                        ▼                     │
              ┌───────────────────┐  ┌────────┴──────────┐
              │ Drive (videos)    │  │ Google Calendar   │
              │ HubSpot (notas)   │  │ del owner         │
              └───────────────────┘  └───────────────────┘
```

## Single points of failure hoy

| SPoF | Impacto si cae |
|---|---|
| Cuenta Google del owner | iCal sync, Calendar sync, Drive uploads, API endpoint — **todo** |
| Deployment URL del Apps Script | Si por error se borra el deployment, el frontend deja de funcionar hasta que se actualice `GAS_URL` |
| Babel-in-browser desde unpkg | Si unpkg cae, la app no carga |
| Apps Script execution quota (6h/día) | Si se agota, los triggers paran hasta el día siguiente |
| Editor Apps Script | Cualquier cambio de backend requiere acceso manual al editor — bus factor = 1 |

## Lo que NO depende de Apps Script

- Servir el HTML/CSS/JSX (GitHub Pages)
- React render
- `localStorage` session
- Cache buster manual (`?v=N` en `Index.html`)

Eso es todo. Cualquier otra interacción del usuario pasa por Apps Script.

## Bus factor

| Componente | Quien puede mantenerlo hoy |
|---|---|
| Frontend | Cualquiera con acceso al repo |
| `Code.gs`/`Sync.gs` | Cualquiera con acceso al editor del owner |
| Triggers programados | Solo el owner (los triggers viven en su cuenta) |
| Spreadsheet | Owner + cualquier editor invitado |
| Drive root folder | Owner |

Bus factor efectivo del backend: **1**.
