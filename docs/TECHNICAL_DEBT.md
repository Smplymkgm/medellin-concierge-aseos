# Technical Debt Report

Inventario concreto de deuda técnica del proyecto. Cada ítem tiene severidad, esfuerzo y impacto en el objetivo (reducción de Apps Script).

Severidad: **A**=crítico (causa bugs o bloquea progreso), **B**=relevante (lo notamos), **C**=cosmético.
Esfuerzo: **S** (<1 día), **M** (1-3 días), **L** (semana+).

## Frontend

| # | Item | Severidad | Esfuerzo | Notas |
|---|---|---|---|---|
| F1 | Babel compila JSX en cada page load | B | M | Resuelve con Vite. Fuera de scope inmediato. Mientras tanto: TTI ~4s |
| F2 | Cache buster manual (`?v=N`) en `Index.html` | A | S | Resuelve con auto-bump al SHA del commit en CI (ver `CICD_ROADMAP.md`). 5 min de implementación |
| F3 | `Object.assign(window, {...})` para exportar componentes | C | M | Funciona pero impide tree-shaking y dificulta unit tests. Migración a ESM viene con Vite |
| F4 | `PERSONAL`/`PROPIEDADES`/`ASEOS` hardcoded en `data.jsx` como placeholder | B | S | Se queda como fallback si la API no responde. Pero `PERSONAL` causa la UI inicial confusa ("Alisson", "María Fernanda" antes de que llegue el getDatos) |
| F5 | Falta `useMemo` en `sortAseos`, `groupByDay`, `aseoEnriched` | C | S | Re-render perceptible solo en sets grandes (>500 aseos) |
| F6 | No hay error boundary global | B | S | Si un componente rompe, pantalla en blanco. Un error boundary muestra "Algo salió mal · Recargar" |
| F7 | No hay loading state para botones que disparan API | B | S | El usuario puede tap-tap el mismo botón. `LockService` lo salva backend pero genera spam |
| F8 | Personal API call no actualiza el state local con response | C | S | Ya funciona porque hay rehydration al refresh, pero ideal sería confirmar response shape |
| F9 | `GAS_URL` hardcoded en `app.jsx` | B | S | Cuando cambie el deployment URL hay que editar y deployar. Mover a un `config.js` o `<meta>` tag inyectado por CI |
| F10 | No hay 'última actualización' visible en UI | C | S | El usuario no sabe si los datos son frescos |

## Backend (Apps Script)

| # | Item | Severidad | Esfuerzo | Notas |
|---|---|---|---|---|
| B1 | `Code.gs` tiene ~1046 líneas, monolítico | B | M | Partir en archivos pequeños (ver `GITHUB_FIRST_ROADMAP.md` Paso 7). Cero cambios de lógica |
| B2 | Duplicación: existe handler `completar` y `completarAseo` con misma implementación | C | S | Mantenido por compat. Documentado en código |
| B3 | `handleCompletarAseo` hace `getRange(fila, 1, 1, 20).setBackground(...)`: extiende rango fijo a 20 cols, pero `Sync.gs:escribirReservas` solo formatea hasta 13 | B | S | Inconsistencia en el rango de formato. No causa bug pero confunde mantenimiento |
| B4 | `handleAgregarAseo` genera codigo `MAN + lastRow.padStart(4)` — si lastRow > 9999, se rompe. Si dos calls concurrentes, mismo código | A | S | Cambiar a `MAN-${timestamp_ms.slice(-7)}` o `MAN-${Utilities.getUuid().slice(0,6)}` |
| B5 | `handleGetFormRespuestas` tiene un `SHEET_ID` hardcoded (otro spreadsheet) | B | S | Mover a `PropertiesService.getScriptProperties()` (o quitarlo si ya no se usa) |
| B6 | `notificarHubspot` lee la API key fresh en cada call | C | S | Read-once en memoria al inicio del script |
| B7 | `parsearICal` no maneja UID nulos ni eventos sin DESCRIPTION | C | S | Edge case raro pero genera duplicados si UID es el mismo string vacío |
| B8 | `sincronizarHojaAseos`: el `for` index `i` es shadowed en el `if (nuevas.length > 0)` block | C | S | Funciona por var-hoisting pero genera warning de lint. Renombrar a `n` |
| B9 | `LockService` solo en `completar` y `asignar`. `moverAseo`, `agregarAseo`, CRUD propiedades/personal sin lock | B | S | Race condition teórica. Bajo riesgo por bajo concurrency, pero gratis de arreglar |
| B10 | `appsscript.json` está en raíz pero `Code.gs`/`Sync.gs` también — clasp config debe coincidir | C | S | Solo requiere atención al armar `.clasp.json` |
| B11 | `handleGetUploadUrl`: si la primera llamada falla creando la carpeta, los re-intentos no tienen retry/backoff | B | S | Drive API ocasional 503. Try once, log, devuelve error claro |
| B12 | `getDatos` devuelve `precio: p.precioAseo` pero `getPropiedades` también ofrece `precioAseoInterno` en un commit previo — los dos coexisten en el código actual | C | S | Confusión histórica. Unificar a `precioAseo` en todo |

## Infra / DevOps

| # | Item | Severidad | Esfuerzo | Notas |
|---|---|---|---|---|
| I1 | Deploy es copy-paste manual | A | M | Resuelto por `CICD_ROADMAP.md`. Es la deuda más cara que tenemos |
| I2 | No hay versionado git del Apps Script — un revert del editor no aparece en git | A | S | clasp + auto-deploy resuelve |
| I3 | Bus factor del backend = 1 (solo el owner del editor) | A | M | Resuelto en parte por clasp; sigue siendo 1 para identidad de ejecución (Drive, Calendar) |
| I4 | No hay tests | A | L | Plan: unit tests del frontend en Vitest + smoke tests del backend (POST a cada endpoint con sample payload) |
| I5 | Secrets en `PropertiesService` no están documentados | B | S | Crear `docs/SECRETS.md` o agregarlo a HANDOFF |
| I6 | `.clasp.json` no existe | A | S | Crear con `clasp clone` |
| I7 | No hay branch protection en `main` | B | S | Settings → Branches → require PR + status checks |
| I8 | No hay separación de environments (dev/staging/prod) | B | M | Para este proyecto probablemente no aplica. Marker para futuro |
| I9 | Sin Lighthouse CI o métricas de performance | C | M | Después del bundle migration |
| I10 | Sin Dependabot ni auto-updates | C | S | Configurar `.github/dependabot.yml` |

## Datos / Spreadsheet

| # | Item | Severidad | Esfuerzo | Notas |
|---|---|---|---|---|
| D1 | Hoja "📋 Todas las Reservas" puede tener variantes corruptas (`üìã ...`) | B | S | `limpiarHojasDuplicadas` ya está en el menú, falta correrlo |
| D2 | Columnas 14-20 en `Todos los Aseos` se crean lazy (`ensureAseosFormColumns`) | C | S | Funciona pero la primera completada paga el costo de añadir cols. Bajísimo |
| D3 | `Personal` PIN en plano (col C) | B | M | Para reducir riesgo: hash bcrypt. Pero requiere cambiar `handleLogin`. Decisión: aceptar mientras el spreadsheet sea privado |
| D4 | `Acceso` (col K de Aseos) usa `|` como separador, frágil si la dirección contiene `|` | C | S | Bajísima probabilidad. Documentar como convención |
| D5 | No hay índice por código de aseo — todo es scan lineal | B | M | Con 120 filas no se nota. A 5000+ se notaría. Para resolver: o índice manual en hoja oculta, o migrar a DB |

## Priorización contra el objetivo (reducir Apps Script)

| # | Item | Bloquea reducción? |
|---|---|---|
| I1, I2, I6 | Deploy manual + sin clasp | **Sí — primera prioridad** |
| I7 | Branch protection | Indirectamente — sin esto el CI no es confiable |
| F9 | `GAS_URL` hardcoded | Sí — cuando el URL del backend cambie (al migrar), hay que poder actualizar sin redeploy manual |
| B1, B10 | Estructura del backend | Sí — partir `Code.gs` facilita identificar qué migra cuándo |
| B4 | `MAN-NNNN` racing | No, pero alto riesgo de bug en producción |
| F2 | Cache buster manual | No, pero gratuito de resolver con CI |

Todo lo demás puede esperar.
