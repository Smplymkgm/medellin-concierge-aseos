# HANDOFF TÉCNICO — Medellin Concierge v2.0
## Para Claude Code — Leer completo antes de escribir una línea

---

## CONTEXTO DEL PROYECTO

Sistema de gestión de limpieza para ~30 propiedades de alquiler corto en Medellín. Actualmente en producción como Google Apps Script monolítico. Este documento describe la **reescritura completa** a arquitectura moderna.

**Stack actual (a reemplazar):**
- Google Apps Script hospeda frontend (Index.html) + backend (Code.gs)
- Un solo archivo HTML de ~1100 líneas con todo mezclado
- Deploy manual desde Monaco editor

**Stack nuevo (a construir):**
- GitHub Pages → frontend mobile-first
- Google Apps Script → solo API backend (~10 funciones)
- Google Sheets → base de datos (estructura intacta)
- Google Calendar → sync via triggers GAS (no cambia)
- HubSpot → notificación cuando se asigna un aseo
- Google Drive → carpetas por propiedad para videos

---

## RECURSOS

| Recurso | URL |
|---|---|
| Spreadsheet | https://docs.google.com/spreadsheets/d/1iKbcU8lcr9g5IWxryOzCs73K6TiHsmT2iSPUp6O5s5Q |
| Apps Script actual | https://script.google.com/u/0/home/projects/1gf8aYoNgrXQxRi3g2SEECKzDKLNAGLVc_o614DV0ulTYt1Ds8Q33luNg/edit |
| Web App prod (actual) | https://script.google.com/macros/s/AKfycbwcMH9Ovbh0kS1QE_8kIqhnBd3fjHqYDvRwONARydXoYj67U9Kr5wT7Nukndbpo0tNG/exec |
| GitHub repo | https://github.com/Smplymkgm/medellin-concierge-aseos (privado) |
| Carpeta local | /Users/mike/CLEANERS |

---

## ARQUITECTURA DEL SISTEMA NUEVO

```
[GitHub Pages - Frontend]
        |
        | fetch() → JSON
        |
[Google Apps Script - API]
        |
        |─── lee/escribe ──→ [Google Sheets - DB]
        |─── triggers ──────→ [Google Calendar]
        |─── fetch() ───────→ [HubSpot API]
        |─── Drive API ─────→ [Google Drive - Videos]
        |
[Airbnb iCal] ──trigger 6h──→ [GAS]
[Google Form] ──on-submit───→ [GAS]
```

**Regla crítica:** El frontend NUNCA usa `google.script.run`. Todo via `fetch()` a endpoints GAS que retornan JSON.

---

## ESTRUCTURA DE CARPETAS DEL PROYECTO

```
/Users/mike/CLEANERS/
├── frontend/               ← GitHub Pages (nuevo)
│   ├── index.html
│   ├── css/
│   │   ├── reset.css
│   │   ├── tokens.css     ← design tokens
│   │   └── components.css
│   ├── js/
│   │   ├── api.js         ← todas las llamadas fetch()
│   │   ├── auth.js        ← login/logout/session
│   │   ├── router.js      ← navegación entre pantallas
│   │   ├── screens/
│   │   │   ├── login.js
│   │   │   ├── aseadora.js
│   │   │   ├── admin.js
│   │   │   └── propiedades.js
│   │   └── components/
│   │       ├── aseo-card.js
│   │       ├── calendar.js
│   │       ├── modal.js
│   │       └── bottom-nav.js
│   └── icons/             ← SVG icons personalizados
├── backend/               ← Google Apps Script (reescrito)
│   ├── Code.gs            ← API principal
│   ├── Auth.gs            ← login/session
│   ├── Sync.gs            ← iCal + Calendar + HubSpot
│   ├── Drive.gs           ← manejo de videos
│   └── appsscript.json
├── .clasp.json
└── HANDOFF_CLAUDE_CODE.md
```

---

## GOOGLE SHEETS — ESTRUCTURA DE DATOS

**NO modificar la estructura actual de estas hojas:**

### `📋 Todas las Reservas` (hoja maestra)
| Col | Campo |
|---|---|
| A | Código reserva |
| B | ID Propiedad |
| C | Nombre propiedad |
| D | Check-in (dd/MM/yyyy) |
| E | Check-out (dd/MM/yyyy) |
| F | Noches |
| G | Estado |
| H | Empleada asignada |
| I | Precio aseo |
| J | Notas |
| K | Acceso/claves |
| L | Calendar Event ID (oculta) |
| M | Notas Admin |

### `🧹 Todos los Aseos` (hoja operativa)
Misma estructura que Reservas + col M = timestamp completado

### `👩 Personal`
| Col | Campo |
|---|---|
| A | Activa (checkbox) |
| B | Nombre |
| C | PIN (texto, no número) |
| D | Email |
| E | URL Google Form |
| F | URL Carpeta Drive videos |
| G | Teléfono |

### `⚙️ Propiedades`
Contiene ~30 propiedades con iCal URLs. Ver estructura actual antes de modificar.

**Hojas nuevas a crear:**
- `📹 Videos Aseos` — código aseo, propiedad, aseadora, fecha, link video Drive, notas

---

## API DEL BACKEND (GAS) — ENDPOINTS A IMPLEMENTAR

El backend recibe `fetch()` POST con JSON y retorna JSON.
Endpoint base: URL del deployment de GAS.

```javascript
// Todos los endpoints siguen este patrón:
// POST { action: 'nombre_accion', ...params }
// Response: { ok: true/false, data: ..., error: '...' }

// AUTH
{ action: 'login', nombre: 'Ana', pin: '1234' }
→ { ok: true, rol: 'aseadora'|'admin', nombre: 'Ana' }

// ASEADORA
{ action: 'getAseos', nombre: 'Ana' }
→ { ok: true, data: { proximos: [...], historial: [...] } }

{ action: 'completarAseo', codigo: 'HM123', nombre: 'Ana', notas: '...', videoLink: '...' }
→ { ok: true }

// ADMIN
{ action: 'getAllAseos', filtroAseadora: '', fechaInicio: '', fechaFin: '' }
→ { ok: true, data: [...] }

{ action: 'asignarAseo', codigo: 'HM123', aseadora: 'Fernanda' }
→ { ok: true }

{ action: 'moverAseo', codigo: 'HM123', nuevaFecha: '05/06/2026' }
→ { ok: true }

// PROPIEDADES
{ action: 'getPropiedades' }
→ { ok: true, data: [...] }

{ action: 'agregarPropiedad', datos: { nombre, direccion, claves, icalUrl, fotoUrl } }
→ { ok: true, id: '#0031' }

{ action: 'actualizarPropiedad', id: '#0002', datos: { claves, direccion } }
→ { ok: true }

// PERSONAL
{ action: 'getPersonal' }
→ { ok: true, data: [...] }

{ action: 'actualizarPersonal', nombre: 'Ana', datos: { pin, carpetaUrl } }
→ { ok: true }

// VIDEOS
{ action: 'getUploadUrl', codigo: 'HM123', propiedad: 'Luxury Provenza', filename: 'video.mp4' }
→ { ok: true, uploadUrl: '...', folderId: '...' }
```

---

## FUNCIONES GAS A MANTENER (del sistema actual)

```javascript
// MANTENER — lógica de negocio crítica
fechaToStr(val)          // convierte fechas a string dd/MM/yyyy
fechaADate(str)          // parsea string colombiano a Date
getPersonal()            // lee hoja Personal
loginAseadora(n, pin)    // valida credenciales → {ok, rol, nombre}
sincronizarCalendarios()  // iCal → Sheets (trigger 6h)
sincronizarGoogleCalendar() // Sheets → Google Calendar (trigger 2h)
autoCompletarAseosPasados() // trigger 10PM

// ELIMINAR — one-shots ya ejecutados
crearHojaPropiedades, crearHojaAseos, crearHojaPersonal
importarAseosPasados, agregarAdmin, testFechas

// ELIMINAR — duplicados
getDatosAdmin (aparece 2 veces)

// REEMPLAZAR — versiones mejoradas
getDatosAseadora → getAseos (más limpia, retorna JSON)
getDatosAdmin → getAllAseos (con filtros, retorna JSON)
```

---

## TRIGGERS GAS (no tocar)

| Función | Frecuencia |
|---|---|
| sincronizarCalendarios | Cada 6h |
| sincronizarGoogleCalendar | Cada 2h |
| autoCompletarAseosPasados | 10 PM diario |
| (nuevo) onFormSubmit | On submit Google Form |

---

## USUARIOS Y CREDENCIALES

| Usuario | PIN | Rol |
|---|---|---|
| Ana | 1234 | aseadora |
| Fernanda | 5678 | aseadora |
| Claudia | 9012 | aseadora |
| Admin | 2025 | admin |

---

## DESIGN SYSTEM

### Paleta (tonos cálidos, uso mínimo de color)

```css
/* Fondos */
--bg-base:       #F7F4F0;
--bg-surface:    #FFFFFF;
--bg-subtle:     #F0EDE8;
--bg-muted:      #E8E3DC;

/* Texto */
--text-primary:  #1C1917;
--text-secondary:#6B6560;
--text-tertiary: #A09890;

/* Accent — SOLO en acciones principales y estados activos */
--accent:        #C4622D;
--accent-hover:  #A8501F;
--accent-subtle: #F5E8DF;

/* Estados */
--state-urgent:  #C4622D;
--state-pending: #8C7355;
--state-done:    #5A7A5E;
--state-neutral: #A09890;

/* Bordes */
--border-light:  #E8E3DC;
--border-medium: #D4CEC6;
```

### Tipografía
- Font: Inter (Google Fonts)
- H1: 20px/600, H2: 17px/600, H3: 15px/500
- Body: 14px/400/1.6, Label: 11px/500/uppercase
- Mínimo mobile: 12px

### Spacing
```
4px 8px 12px 16px 20px 24px 32px
```

### Iconos
- SVG inline, stroke 1.5px, linecap/linejoin round
- Tamaños: 16px inline, 20px nav, 24px acciones
- Sin emojis en ninguna parte de la UI
- Set completo: home, calendar, list, check, clock, user, users, key, location, video, upload, filter, chevron-right, chevron-down, plus, edit, logout, alert, money, notes, sync

---

## PANTALLAS A IMPLEMENTAR

### Rol: Aseadora
1. **Login** — dropdown nombre + PIN (4 dígitos)
2. **Hoy** — lista de aseos del día, ordenados por prioridad
3. **Próximos** — aseos futuros en lista
4. **Calendario** — vista mensual con dots de estado
5. **Historial** — aseos completados + ganancias acumuladas
6. **Modal completar aseo** — bottom sheet: notas + upload video

### Rol: Admin
1. **Login** — mismo que aseadora
2. **Todos los aseos** — lista con filtros (aseadora + rango fechas)
3. **Calendario admin** — todos los aseos en vista mensual
4. **Propiedades** — lista de ~30 propiedades
5. **Detalle propiedad** — editar claves, dirección, iCal, historial
6. **Agregar propiedad** — form: nombre, dirección, claves, iCal URL, foto
7. **Personal** — lista aseadoras, editar datos, ver ganancias
8. **Asignar/mover aseo** — modal desde cualquier aseo card

### Bottom navigation
- Aseadora: Hoy / Calendario / Historial (3 tabs)
- Admin: Aseos / Calendario / Propiedades / Personal (4 tabs)

---

## PRIORIDAD DE ASEOS

Un aseo es URGENTE (prioridad alta) cuando:
- `checkout` === hoy Y check-in también es hoy (mismo día)
- O check-out es hoy (independientemente del check-in)

Visual:
- Aparece primero en la lista, antes de otros aseos
- Borde izquierdo 4px en `--accent`
- Badge "PRIORIDAD" en accent-subtle

---

## REGLAS CRÍTICAS

```
1. El frontend USA fetch() — nunca google.script.run
2. GAS retorna SIEMPRE { ok: bool, data: ..., error: '...' }
3. Locale: Colombia — fechas dd/MM/yyyy
4. PINs en Sheets = texto (col C formateada como @)
5. getDisplayValues() para leer columnas de fecha en GAS
6. NO cambiar URL del deployment GAS — aseadoras la tienen guardada
7. NO borrar hojas Todas las Reservas ni Todos los Aseos
8. NO backticks en strings dentro de GAS (restriction de GAS)
9. Deploy GAS siempre como Nueva versión
10. GitHub Pages en rama gh-pages o desde /frontend en main
```

---

## INTEGRACIÓN HUBSPOT

Cuando se asigna un aseo a una aseadora, GAS hace:
```javascript
function notificarHubspot(aseo, aseadora) {
  const API_KEY = PropertiesService.getScriptProperties().getProperty('HUBSPOT_API_KEY');
  const payload = {
    properties: {
      subject: 'Aseo asignado: ' + aseo.propiedad,
      hs_note_body: 'Aseadora: ' + aseadora + ' | Fecha: ' + aseo.checkout,
    }
  };
  UrlFetchApp.fetch('https://api.hubapi.com/crm/v3/objects/notes', {
    method: 'post',
    headers: { Authorization: 'Bearer ' + API_KEY, 'Content-Type': 'application/json' },
    payload: JSON.stringify(payload)
  });
}
```
API key se guarda en Script Properties, nunca hardcodeada.

---

## INTEGRACIÓN GOOGLE DRIVE (videos)

Estructura de carpetas:
```
📁 Medellin Concierge - Videos Aseos/
  📁 Luxury 3BR Provenza/
    📹 2026-05-31_Ana_HM0087.mp4
  📁 Ayamonte 306 2BR/
    ...
```

Cada propiedad tiene su carpeta. El ID de la carpeta se guarda en hoja `⚙️ Propiedades`. Cuando se agrega una propiedad nueva, GAS crea la carpeta automáticamente.

---

## FLUJO DE DESARROLLO SUGERIDO

### Fase 1 — Setup (1 sesión)
1. `npm install -g @google/clasp && clasp login`
2. Clonar el proyecto GAS actual: `clasp clone SCRIPT_ID`
3. Crear estructura de carpetas frontend/backend
4. Configurar GitHub Pages en el repo

### Fase 2 — Backend API (1-2 sesiones)
1. Reescribir Code.gs como API limpia con doPost_handler
2. Mantener funciones de sync (iCal, Calendar)
3. Agregar Drive.gs para manejo de videos
4. Testing de todos los endpoints

### Fase 3 — Frontend aseadora (2 sesiones)
1. Design tokens + componentes base
2. Login → Hoy → Completar aseo (flujo crítico primero)
3. Calendario + Historial

### Fase 4 — Frontend admin (2 sesiones)
1. Lista de aseos + filtros
2. Propiedades (CRUD)
3. Personal + Asignación

### Fase 5 — Integraciones (1 sesión)
1. HubSpot
2. Google Form → on-submit trigger
3. Video upload a Drive

---

## COMANDO DE INICIO

```bash
cd /Users/mike/CLEANERS
# Verificar estado actual
git log --oneline -5
git status

# Instalar clasp si no está
npm install -g @google/clasp

# Configurar clasp con el proyecto existente
echo '{"scriptId":"1gf8aYoNgrXQxRi3g2SEECKzDKLNAGLVc_o614DV0ulTYt1Ds8Q33luNg","rootDir":"./backend"}' > .clasp.json

# Crear estructura
mkdir -p frontend/css frontend/js/screens frontend/js/components frontend/icons
mkdir -p backend
```

---

*Generado: Mayo 31, 2026 | Proyecto: Medellin Concierge v2.0*
