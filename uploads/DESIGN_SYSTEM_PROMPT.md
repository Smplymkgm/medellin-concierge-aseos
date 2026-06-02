# PROMPT — Medellin Concierge App Design System v2

## Contexto del producto

App de gestión de limpieza para propiedades de alquiler corto en Medellín, Colombia. Dos roles: aseadoras (acceso exclusivo desde celular) y admin (celular y desktop). ~30 propiedades, reservas sincronizadas desde Airbnb via iCal.

---

## Filosofía visual

Menos es más. La interfaz debe sentirse como una herramienta de trabajo seria — no una app de consumo. Colores usados con propósito, no como decoración. El 90% de la UI es neutro; el color aparece solo para comunicar estado o acción. Sin emojis en ninguna parte de la interfaz.

---

## Paleta de colores

Toda la paleta parte de un neutro cálido como base.

```css
/* Fondos */
--bg-base:       #F7F4F0;   /* crema cálido, fondo principal */
--bg-surface:    #FFFFFF;   /* cards y modales */
--bg-subtle:     #F0EDE8;   /* secciones secundarias, inputs */
--bg-muted:      #E8E3DC;   /* dividers, bordes suaves */

/* Texto */
--text-primary:  #1C1917;   /* casi negro cálido */
--text-secondary:#6B6560;   /* gris cálido, subtítulos */
--text-tertiary: #A09890;   /* hints, placeholders */

/* Accent — usado SOLO en acciones principales y estados activos */
--accent:        #C4622D;   /* terracota */
--accent-hover:  #A8501F;
--accent-subtle: #F5E8DF;   /* fondo suave del accent, badges */

/* Estados */
--state-urgent:  #C4622D;   /* terracota — aseos HOY / prioridad alta */
--state-pending: #8C7355;   /* café cálido — pendiente */
--state-done:    #5A7A5E;   /* verde musgo — completado */
--state-neutral: #A09890;   /* gris cálido — sin asignar */

/* Bordes */
--border-light:  #E8E3DC;
--border-medium: #D4CEC6;
```

### Reglas de uso del color

- El accent (`#C4622D`) aparece únicamente en: botón de acción principal, badge de prioridad urgente, estado activo del tab seleccionado
- Cero colores en backgrounds de pantallas — siempre `--bg-base` o `--bg-surface`
- Los estados (urgente, pendiente, completado) se comunican con un punto de color y una etiqueta de texto, no con backgrounds de cards
- No hay gradientes, sombras decorativas, ni efectos de profundidad exagerados

---

## Tipografía

- Font: **Inter** (Google Fonts)
- H1: 20px / 600
- H2: 17px / 600
- H3: 15px / 500
- Body: 14px / 400 / line-height 1.6
- Label / badge: 11px / 500 / uppercase / letter-spacing 0.6px
- Caption: 12px / 400
- Tamaño mínimo en mobile: 12px

---

## Iconografía

Sin emojis. Iconos SVG de línea, trazo 1.5px, esquinas redondeadas, diseño propio consistente con el sistema. Tamaños: 20px (navegación), 16px (inline en texto), 24px (acciones principales).

Iconos necesarios — diseñar set completo:

| Nombre | Uso |
|---|---|
| `icon-home` | propiedad / inicio |
| `icon-calendar` | calendario |
| `icon-list` | lista de aseos |
| `icon-check` | completado |
| `icon-clock` | pendiente / hora |
| `icon-user` | aseadora / personal |
| `icon-users` | equipo / admin |
| `icon-key` | claves de acceso |
| `icon-location` | dirección |
| `icon-video` | subir video |
| `icon-upload` | cargar archivo |
| `icon-filter` | filtros |
| `icon-chevron-right` | navegar / expandir |
| `icon-chevron-down` | expandir sección |
| `icon-plus` | agregar |
| `icon-edit` | editar |
| `icon-logout` | salir |
| `icon-alert` | urgente / prioridad |
| `icon-money` | pago / ganancia |
| `icon-notes` | notas del aseo |
| `icon-sync` | sincronización iCal |

Estilo: línea limpia, sin relleno (outline), `stroke-linecap: round`, `stroke-linejoin: round`. Consistentes con el peso visual del texto Body.

---

## Spacing system

```
4px   — micro    (entre icon e inline label)
8px   — small    (padding interno de badges)
12px  — base     (gap entre elementos de una card)
16px  — medium   (padding de cards, gap entre items de lista)
20px  — large    (padding horizontal de pantallas)
24px  — xl       (separación entre secciones)
32px  — 2xl      (espaciado entre grupos mayores)
```

---

## Componentes clave

### 1. Aseo card

- Fondo `--bg-surface`, borde izquierdo 3px que indica estado: terracota=urgente, café=pendiente, verde=completado, gris=sin asignar
- Nombre de la propiedad: `--text-primary` / 15px / 500
- Fecha checkout: `--text-primary` / 14px — check-in y noches: `--text-secondary` / 12px
- Badge de estado: punto circular 6px del color del estado + etiqueta 11px uppercase
- Sección expandible con `icon-chevron-down` para ver claves y dirección
- Actions al expandir: botón primario "Completar" y botón secundario "Reasignar"

### 2. Bottom navigation

- Fondo `--bg-surface`, border-top 1px `--border-light`
- Aseadora: 3 tabs — Hoy / Calendario / Historial
- Admin: 4 tabs — Aseos / Calendario / Propiedades / Personal
- Tab activo: icon + label en `--accent`, inactivo en `--text-tertiary`
- Badge numérico solo si hay aseos urgentes pendientes

### 3. Login

- Fondo `--bg-base`, centrado verticalmente
- Nombre del sistema en H1, subtítulo en `--text-secondary`
- Dropdown de nombre con borde `--border-medium`
- Input PIN: 4 círculos grandes (20px) que se llenan al escribir, sin teclado numérico forzado
- Botón "Entrar" full-width, fondo `--accent`, texto blanco

### 4. Modal completar aseo (bottom sheet)

- Sube desde abajo, ocupa 80% del viewport
- Handle gris en la parte superior (32px wide, 4px height, centered)
- Campo de notas: textarea 3 líneas, fondo `--bg-subtle`
- Zona de upload: `icon-upload` + texto "Seleccionar video", borde dashed `--border-medium`
- Preview del archivo: nombre + tamaño en caption
- Barra de progreso linear durante la subida: color `--accent`
- Botón "Enviar y completar" full-width en `--accent`

### 5. Vista calendario

- Mes completo en grid 7 columnas
- Header: mes y año en H2 + flechas izquierda/derecha con `icon-chevron`
- Días con aseos: punto de 4px debajo del número según color de estado
- Día seleccionado: círculo fondo `--accent-subtle`, número en `--accent`
- Lista de aseos del día seleccionado debajo del grid, cards compactas

### 6. Filtros admin

- Chips horizontales scrolleables sin scroll bar visible
- Estado activo: fondo `--accent-subtle`, texto `--accent`, borde `--accent`
- Estado inactivo: fondo `--bg-subtle`, texto `--text-secondary`, borde `--border-light`
- Date range: dos inputs compactos de fecha en línea con `icon-calendar` inline
- Botón "Limpiar" en texto simple, sin background
- Sin dropdowns — todo visible y tocable directamente

### 7. Pantalla propiedad (admin)

- Foto de portada cuando exista, o placeholder con iniciales en `--bg-muted`
- Nombre en H2, dirección con `icon-location` en `--text-secondary`
- Sección "Claves" con `icon-key`, texto oculto por defecto con `icon-eye` para revelar
- Lista de últimos aseos completados en formato compacto

### 8. Modal agregar aseo extra (admin)

- Bottom sheet que sube desde abajo, ocupa 85% del viewport
- Título "Agregar aseo" en H2
- Selector de propiedad: dropdown con las ~30 propiedades listadas en Sheets / Airbnb, con buscador inline
- Selector de fecha: date picker nativo
- Selector de aseadora: chips horizontales (Ana / Fernanda / Claudia / Sin asignar)
- Tipo de aseo con dos opciones tipo toggle prominente:
  - **Full** — precio normal, sin descuento. Label secundario: "Precio estándar"
  - **Express** — 40% menos del precio normal. Label secundario: "40% descuento". El precio calculado se muestra en tiempo real debajo del toggle al seleccionar Express
- Campo precio: pre-llenado con el precio de la propiedad, editable manualmente
- Campo notas: opcional, una línea
- Botón "Agregar aseo" full-width en `--accent`
- El precio Express se calcula automáticamente al cambiar de tipo: `precio_full * 0.60`

---

## Badge de prioridad

Aseo urgente = checkout es hoy, o check-in y check-out son el mismo día:

- Etiqueta "PRIORIDAD" 10px uppercase, color `--accent`, background `--accent-subtle`
- Borde izquierdo 4px en `--accent` (vs 3px normal)
- Siempre aparece en la parte superior de la lista

---

## Lo que NO debe aparecer

- Emojis en ninguna pantalla
- Tablas con scroll horizontal
- Menú hamburguesa
- Sombras decorativas — solo sombra funcional en modales: `0 -2px 16px rgba(0,0,0,0.08)`
- Colores en fondos de pantalla
- Más de un botón de acción primario por pantalla
- Texto de más de 3 palabras en botones de acción
- Bordes redondeados mayores a 12px en cards
