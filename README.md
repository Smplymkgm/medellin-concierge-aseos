# 🏠 Medellin Concierge — Airbnb Manager

Sistema de gestión de limpieza para propiedades Airbnb.

## Stack
- Google Apps Script + Google Sheets + Drive + Calendar
- Web app móvil HTML/CSS/JS para aseadoras

## Web App (producción)
https://script.google.com/macros/s/AKfycbwcMH9Ovbh0kS1QE_8kIqhnBd3fjHqYDvRwONARydXoYj67U9Kr5wT7Nukndbpo0tNG/exec

## Triggers
| Función | Frecuencia |
|---|---|
| sincronizarCalendarios | Cada 6h |
| sincronizarGoogleCalendar | Cada 2h |
| autoCompletarAseosPasados | 10 PM diario |

## Cambios v1.0.22 (May 30 2026)
- Fix: trigger huérfano actualizarHojasEmpleadas eliminado
- Fix: scope script.scriptapp agregado
- Fix: agregarAseoManual línea duplicada eliminada
- Fix: autoCompletarAseosPasados sincroniza a hoja maestra
