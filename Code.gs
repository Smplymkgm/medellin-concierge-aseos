// ============================================================
// CONFIGURACIÓN
// ============================================================

const CONFIG = {
  empleadas: [
    { nombre: "Ana",      email: "ayarsakarina@gmail.com" },
    { nombre: "Fernanda", email: "" },
    { nombre: "Claudia",  email: "Cpatriciamonterrozalopez@gmail.com" },
  ],
  pines: {
    "Ana":      "1234",
    "Fernanda": "5678",
    "Claudia":  "9012",
  },
  hojaMaestra:     "📋 Todas las Reservas",
  hojaAseos:       "🧹 Todos los Aseos",
  hojaPropiedades: "⚙️ Propiedades",
  meses: ["Enero","Febrero","Marzo","Abril","Mayo","Junio",
          "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"],
};

// ============================================================
// UTILIDADES DE FECHA
// ============================================================

function fechaToStr(val) {
  if (!val) return "";
  if (Object.prototype.toString.call(val) === "[object Date]") {
    var d = new Date(val);
    if (isNaN(d.getTime())) return "";
    return String(d.getDate()).padStart(2,"0") + "/" +
           String(d.getMonth()+1).padStart(2,"0") + "/" + d.getFullYear();
  }
  var s = String(val).trim();
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s;
  return s;
}
com/calendar/ical/1458239945601966285.ics?t=892a1efa00024704bdbc476f41a2578e",""],
    ["#0001","Trendy Provenza Studio",100000,"Clave apto: 147258369# | Dirección: Cra. 35 #10b-119","https://www.airbnb.com/calendar/ical/1242776299677839065.ics?t=66878d766a5a4918a6ac290bfc7dbc8f",""],
    ["#0078","Ayamonte 403",90000,"Llaves en porteria | Dirección: Cra 32d #7A-13 Apto 403","https://www.airbnb.com/calendar/ical/1645931515024951567.ics?t=8c2339a74fa644f4a29d62b60444c764",""],
  ];
  hoja.getRange(2,1,props.length,6).setValues(props);
  for (let i=0;i<props.length;i++) {
    hoja.getRange(i+2,1,1,6).setBackground(i%2===0?"#f8f9fa":"#ffffff")
      .setFontFamily("Arial").setFontSize(10);
  }
  hoja.getRange(2,3,props.length,1).setNumberFormat("$#,##0");
  SpreadsheetApp.getActiveSpreadsheet().toast("✅ Hoja Propiedades creada.", "Propiedades", 6);
  return hoja;
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("🏠 Airbnb Manager")
    .addItem("🔄 Sincronizar Airbnb", "sincronizarCalendarios")
    .addItem("📅 Sincronizar Google Calendar", "sincronizarGoogleCalendar")
    .addItem("📨 Reenviar invitación (fila seleccionada)", "reenviarInvitacionSeleccionada")
    .addSeparator()
    .addItem("➕ Agregar Aseo Manual", "agregarAseoManual")
    .addSeparator()
    .addItem("🧹 Crear/verificar hoja Todos los Aseos", "crearHojaAseos")
    .addItem("🏠 Recrear hoja Propiedades", "crearHojaPropiedades")
    .addSeparator()
    .addItem("🧪 Test fechas", "testFechas")
    .addSeparator()
    .addItem("⚙️ Crear triggers automáticos", "crearTriggersAutomaticos")
    .addToUi();
}

function doGet(e) {
  return HtmlService.createHtmlOutputFromFile("Index")
    .setTitle("Mis Aseos")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function loginAseadora(nombre, pin) {
  if (!nombre || !pin) return false;
  nombre = String(nombre).trim().toLowerCase();
  pin    = String(pin).trim();
  const usuario = Object.keys(CONFIG.pines).find(n => n.toLowerCase() === nombre);
  if (!usuario) return false;
  return CONFIG.pines[usuario] === pin;
}

function getDatosAseadora(nombre) {
  const ss   = SpreadsheetApp.getActiveSpreadsheet();
  const hoja = ss.getSheetByName(CONFIG.hojaAseos);
  const proximos  = [];
  const historial = [];
  if (hoja && hoja.getLastRow() >= 2) {
    const datos = hoja.getRange(2, 1, hoja.getLastRow()-1, 13).getValues();
    const disp  = hoja.getRange(2, 4, hoja.getLastRow()-1, 2).getDisplayValues();
    const hoy   = new Date(); hoy.setHours(0,0,0,0);
    for (let i = 0; i < datos.length; i++) {
      const r = datos[i];
      if (String(r[6]) !== nombre) continue;
      const checkinStr  = disp[i][0] || fechaToStr(r[3]);
      const checkoutStr = disp[i][1] || fechaToStr(r[4]);
      const estado      = String(r[7] || "");
      const precio      = Number(r[8]) || 0;
      const accesoRaw   = String(r[10] || "");
      const checkout    = fechaADate(checkoutStr);
      if (!checkout) continue;
      if (checkout >= hoy) {
        if (estado !== "Cancelado") {
          proximos.push({ codigo: String(r[0]), idProp: String(r[1]).trim(), propiedad: String(r[2]).trim(), checkin: checkinStr, checkout: checkoutStr, noches: Number(r[5]) || 0, estado, precio, notas: String(r[9] || ""), accesos: accesoRaw ? accesoRaw.split("|").map(a => a.trim()).filter(Boolean) : [] });
        }
      } else {
        historial.push({ codigo: String(r[0]), idProp: String(r[1]).trim(), propiedad: String(r[2]).trim(), checkin: checkinStr, checkout: checkoutStr, noches: Number(r[5]) || 0, estado, precio, fechaCompletado: String(r[12] || "") });
      }
    }
  }
  proximos.sort((a, b) => { const da = fechaADate(a.checkout), db = fechaADate(b.checkout); if (!da || !db) return 0; return da - db; });
  historial.sort((a, b) => { const da = fechaADate(a.checkout), db = fechaADate(b.checkout); if (!da || !db) return 0; return db - da; });
  return { proximos, historial };
}

function finalizarAseo(codigo, nombre) {
  const ss   = SpreadsheetApp.getActiveSpreadsheet();
  const hoja = ss.getSheetByName(CONFIG.hojaAseos);
  if (!hoja || hoja.getLastRow() < 2) return { ok: false, msg: "Hoja no encontrada" };
  const hoy   = new Date(); hoy.setHours(0,0,0,0);
  const datos = hoja.getRange(2, 1, hoja.getLastRow()-1, 13).getValues();
  const disp  = hoja.getRange(2, 4, hoja.getLastRow()-1, 2).getDisplayValues();
  for (let i = 0; i < datos.length; i++) {
    if (String(datos[i][0]) !== String(codigo)) continue;
    if (String(datos[i][6]) !== String(nombre))  return { ok: false, msg: "No autorizado" };
    const checkoutStr = disp[i][1] || fechaToStr(datos[i][4]);
    const checkout    = fechaADate(checkoutStr);
    if (!checkout)      return { ok: false, msg: "Fecha inválida" };
    if (checkout > hoy) return { ok: false, msg: "No puedes completar aseos futuros" };
    const fila  = i + 2;
    const ahora = Utilities.formatDate(new Date(), "America/Bogota", "dd/MM/yyyy HH:mm");
    hoja.getRange(fila, 8).setValue("Completado");
    hoja.getRange(fila, 13).setValue(ahora);
    hoja.getRange(fila, 1, 1, 13).setBackground("#e8f5e9").setFontFamily("Arial").setFontSize(10);
    const master = ss.getSheetByName(CONFIG.hojaMaestra);
    if (master && master.getLastRow() >= 2) {
      const mc = master.getRange(2, 1, master.getLastRow()-1, 1).getValues();
      for (let j = 0; j < mc.length; j++) {
        if (String(mc[j][0]) === String(codigo)) { master.getRange(j+2, 7).setValue("Finalizado"); master.getRange(j+2, 1, 1, 13).setBackground("#e8f5e9"); break; }
      }
    }
    return { ok: true };
  }
  return { ok: false, msg: "Aseo no encontrado" };
}function autoCompletarAseosPasados() {
  const ss   = SpreadsheetApp.getActiveSpreadsheet();
  const hoja = ss.getSheetByName(CONFIG.hojaAseos);
  if (!hoja || hoja.getLastRow() < 2) return;
  const hoy   = new Date(); hoy.setHours(0,0,0,0);
  const datos = hoja.getRange(2, 1, hoja.getLastRow()-1, 13).getValues();
  const disp  = hoja.getRange(2, 4, hoja.getLastRow()-1, 2).getDisplayValues();
  const ahora = Utilities.formatDate(new Date(), "America/Bogota", "dd/MM/yyyy HH:mm");
  let count = 0;
  for (let i = 0; i < datos.length; i++) {
    const estado = String(datos[i][7]);
    if (estado === "Completado" || estado === "Cancelado") continue;
    if (!String(datos[i][6])) continue;
    const checkoutStr = disp[i][1] || fechaToStr(datos[i][4]);
    const checkout    = fechaADate(checkoutStr);
    if (!checkout || checkout >= hoy) continue;
    const fila   = i + 2;
    const codigo = String(datos[i][0]);
    hoja.getRange(fila, 8).setValue("Completado");
    hoja.getRange(fila, 13).setValue(ahora + " (auto)");
    hoja.getRange(fila, 1, 1, 13).setBackground("#e8f5e9");
    const master = ss.getSheetByName(CONFIG.hojaMaestra);
    if (master && master.getLastRow() >= 2) {
      const mc = master.getRange(2, 1, master.getLastRow()-1, 1).getValues();
      for (let j = 0; j < mc.length; j++) {
        if (String(mc[j][0]) === codigo) { master.getRange(j+2, 7).setValue("Finalizado"); master.getRange(j+2, 1, 1, 13).setBackground("#e8f5e9"); break; }
      }
    }
    count++;
  }
  Logger.log("autoCompletarAseosPasados: " + count + " aseos marcados.");
}

function crearHojaAseos() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let   h  = ss.getSheetByName(CONFIG.hojaAseos);
  if (h) { SpreadsheetApp.getActiveSpreadsheet().toast("La hoja ya existe.", CONFIG.hojaAseos, 4); return h; }
  h = ss.insertSheet(CONFIG.hojaAseos);
  const enc = ["Código Reserva","ID Propiedad","Propiedad","Check-in","Check-out","Noches","Aseadora","Estado","Precio Aseo","Notas","Acceso","Cal Event ID","Completado"];
  h.getRange(1,1,1,enc.length).setValues([enc]).setBackground("#1a1a2e").setFontColor("#ffffff").setFontWeight("bold").setFontSize(11).setFontFamily("Arial");
  [160,80,240,100,100,55,130,110,120,180,280,1,140].forEach((w,i)=>h.setColumnWidth(i+1,w));
  h.hideColumns(12);
  h.setFrozenRows(1);
  const nombres = CONFIG.empleadas.map(e => e.nombre);
  h.getRange("G2:G2000").setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(["", ...nombres], true).setAllowInvalid(false).build());
  h.getRange("H2:H2000").setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(["Pendiente","Completado","Cancelado"], true).setAllowInvalid(false).build());
  SpreadsheetApp.getActiveSpreadsheet().toast("✅ Hoja creada.", CONFIG.hojaAseos, 4);
  return h;
}

function sincronizarHojaAseos() {
  const ss     = SpreadsheetApp.getActiveSpreadsheet();
  const master = ss.getSheetByName(CONFIG.hojaMaestra);
  if (!master || master.getLastRow() < 2) return;
  let hoja = ss.getSheetByName(CONFIG.hojaAseos);
  if (!hoja) hoja = crearHojaAseos();
  const existentes = {};
  if (hoja.getLastRow() > 1) {
    const exDatos = hoja.getRange(2, 1, hoja.getLastRow()-1, 13).getValues();
    for (let i = 0; i < exDatos.length; i++) { const cod = String(exDatos[i][0]); if (cod) existentes[cod] = { row: i+2, estado: String(exDatos[i][7]) }; }
  }
  const mDatos = master.getRange(2, 1, master.getLastRow()-1, 13).getValues();
  const mDisp  = master.getRange(2, 4, master.getLastRow()-1, 2).getDisplayValues();
  const nuevas = [];
  for (let i = 0; i < mDatos.length; i++) {
    const r   = mDatos[i];
    const cod = String(r[0]);
    if (!cod) continue;
    const checkinStr   = mDisp[i][0] || fechaToStr(r[3]);
    const checkoutStr  = mDisp[i][1] || fechaToStr(r[4]);
    const estadoMaster = String(r[6] || "");
    if (existentes[cod]) {
      const estadoActual = existentes[cod].estado;
      if (estadoActual === "Completado") continue;
      let nuevoEstado = estadoActual || "Pendiente";
      if (estadoMaster === "Cancelada")  nuevoEstado = "Cancelado";
      if (estadoMaster === "Finalizado") nuevoEstado = "Completado";
      const fila = existentes[cod].row;
      hoja.getRange(fila, 3).setValue(String(r[2] || ""));
      hoja.getRange(fila, 4).setValue(checkinStr).setNumberFormat("@");
      hoja.getRange(fila, 5).setValue(checkoutStr).setNumberFormat("@");
      hoja.getRange(fila, 6).setValue(r[5] || 0);
      hoja.getRange(fila, 7).setValue(String(r[7] || ""));
      hoja.getRange(fila, 8).setValue(nuevoEstado);
      hoja.getRange(fila, 9).setValue(Number(r[8]) || 0);
      hoja.getRange(fila, 10).setValue(String(r[9] || ""));
      hoja.getRange(fila, 11).setValue(String(r[10] || ""));
      const bg = nuevoEstado === "Completado" ? "#e8f5e9" : nuevoEstado === "Cancelado" ? "#fff3f3" : "#ffffff";
      hoja.getRange(fila, 1, 1, 13).setBackground(bg);
      if (nuevoEstado === "Completado") { const existingTs = hoja.getRange(fila, 13).getValue(); if (!existingTs) { hoja.getRange(fila, 13).setValue(Utilities.formatDate(new Date(), "America/Bogota", "dd/MM/yyyy HH:mm")); } }
    } else {
      const estado = estadoMaster === "Cancelada" ? "Cancelado" : estadoMaster === "Finalizado" ? "Completado" : "Pendiente";
      const ts = estado === "Completado" ? Utilities.formatDate(new Date(), "America/Bogota", "dd/MM/yyyy HH:mm") : "";
      nuevas.push([cod, r[1], r[2], checkinStr, checkoutStr, r[5], r[7]||"", estado, r[8]||0, r[9]||"", r[10]||"", r[11]||"", ts]);
    }
  }
  if (nuevas.length > 0) {
    const fi = hoja.getLastRow() + 1;
    hoja.getRange(fi, 1, nuevas.length, 13).setValues(nuevas);
    hoja.getRange(fi, 4, nuevas.length, 2).setNumberFormat("@");
    hoja.getRange(fi, 9, nuevas.length, 1).setNumberFormat("$#,##0");
    for (let i = 0; i < nuevas.length; i++) { const bg = nuevas[i][7] === "Completado" ? "#e8f5e9" : nuevas[i][7] === "Cancelado" ? "#fff3f3" : "#f8f9fa"; hoja.getRange(fi+i, 1, 1, 13).setBackground(bg).setFontFamily("Arial").setFontSize(10); }
  }
}function sincronizarCalendarios() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let hoja = ss.getSheetByName(CONFIG.hojaMaestra);
  if (!hoja) hoja = ss.insertSheet(CONFIG.hojaMaestra);
  const guardado    = leerDatosGuardados(hoja);
  const propiedades = getPropiedades();
  const manuales = [];
  if (hoja.getLastRow() > 1) {
    const filas = hoja.getRange(2,1,hoja.getLastRow()-1,13).getValues();
    for (const f of filas) if (String(f[0]).startsWith("MANUAL-")) manuales.push([...f]);
  }
  limpiarDatos(hoja);
  configurarEncabezados(hoja);
  aplicarDropdowns(hoja);
  let reservas = [];
  for (const prop of propiedades) { if (!prop.icalUrl) continue; reservas = reservas.concat(obtenerReservasDeICal(prop)); }
  reservas.sort((a, b) => fechaADate(a.checkout) - fechaADate(b.checkout));
  escribirReservas(hoja, reservas, guardado);
  if (manuales.length > 0) { const fi = hoja.getLastRow() + 1; hoja.getRange(fi, 1, manuales.length, 13).setValues(manuales); for (let i = 0; i < manuales.length; i++) hoja.getRange(fi+i, 1, 1, 13).setBackground("#fff9e6").setFontFamily("Arial").setFontSize(10); }
  sincronizarHojaAseos();
  SpreadsheetApp.getActiveSpreadsheet().toast("✅ " + reservas.length + " reservas sincronizadas", "Airbnb Sync", 5);
}

function obtenerReservasDeICal(prop) {
  try {
    const r = UrlFetchApp.fetch(prop.icalUrl, { muteHttpExceptions: true });
    if (r.getResponseCode() !== 200) return [];
    return parsearICal(r.getContentText(), prop);
  } catch(e) { Logger.log("Error iCal " + prop.nombre + ": " + e.message); return []; }
}

function parsearICal(texto, prop) {
  const limpio  = texto.replace(/\r\n[ \t]/g, "");
  const eventos = limpio.split("BEGIN:VEVENT");
  const out     = [];
  for (let i = 1; i < eventos.length; i++) {
    const ev  = eventos[i];
    const sum = extraer(ev, "SUMMARY") || "";
    if (sum.includes("Not available")) continue;
    const start = extraer(ev, "DTSTART");
    const end   = extraer(ev, "DTEND");
    if (!start || !end) continue;
    const startClean = start.replace(/[^0-9]/g,"").substring(0,8);
    const endClean   = end.replace(/[^0-9]/g,"").substring(0,8);
    if (startClean.length < 8 || endClean.length < 8) continue;
    const fi = new Date(parseInt(startClean.substring(0,4)), parseInt(startClean.substring(4,6))-1, parseInt(startClean.substring(6,8)));
    const fo = new Date(parseInt(endClean.substring(0,4)),   parseInt(endClean.substring(4,6))-1,   parseInt(endClean.substring(6,8)));
    if (isNaN(fi.getTime()) || isNaN(fo.getTime())) continue;
    if (fo <= fi) continue;
    const desc = extraer(ev, "DESCRIPTION") || "";
    const hm   = desc.match(/reservations\/details\/(HM[A-Z0-9]+)/);
    const uid  = extraer(ev, "UID") || "";
    const cod  = hm ? hm[1] : uid.split("@")[0].substring(0, 20);
    out.push({ codigo: cod, id: prop.id, propiedad: prop.nombre, checkin: formatearFecha(fi), checkout: formatearFecha(fo), noches: Math.round((fo - fi) / 86400000), estado: "Confirmada", precio: prop.precioAseoInterno || 0, acceso: prop.acceso || "", empleadaAuto: prop.empleadaAuto || "" });
  }
  return out;
}

function extraer(txt, campo) {
  const m = txt.match(new RegExp(campo + "[^:]*:([^\\n\\r]+)"));
  return m ? m[1].trim() : "";
}

function leerDatosGuardados(hoja) {
  const g = {};
  if (hoja.getLastRow() < 2) return g;
  const datos = hoja.getRange(2, 1, hoja.getLastRow()-1, 13).getValues();
  const disp  = hoja.getRange(2, 4, hoja.getLastRow()-1, 2).getDisplayValues();
  for (let i = 0; i < datos.length; i++) {
    const f = datos[i]; const c = String(f[0]); if (!c) continue;
    g[c] = { empleada: String(f[7] || ""), estado: String(f[6] || ""), notas: String(f[9] || ""), acceso: String(f[10] || ""), eventId: String(f[11] || ""), checkin: disp[i][0] || fechaToStr(f[3]), checkout: disp[i][1] || fechaToStr(f[4]) };
  }
  return g;
}

function configurarEncabezados(hoja) {
  const enc = ["Código Reserva","ID Propiedad","Propiedad","Check-in","Check-out","Noches","Estado","Empleada Asignada","Precio Aseo","Notas","Acceso","Cal Event ID","Notas Admin"];
  hoja.getRange(1,1,1,enc.length).setValues([enc]).setBackground("#1a1a2e").setFontColor("#ffffff").setFontWeight("bold").setFontSize(11).setFontFamily("Arial");
  [160,80,240,100,100,55,110,130,120,180,280,1,220].forEach((w,i)=>hoja.setColumnWidth(i+1,w));
  hoja.hideColumns(12);
  hoja.setFrozenRows(1);
}

function limpiarDatos(hoja) {
  try { const last = hoja.getLastRow(); const frozen = hoja.getFrozenRows(); const first = frozen + 1; if (last >= first) hoja.deleteRows(first, last - frozen); } catch(e) { Logger.log("limpiarDatos: " + e.message); }
}

function escribirReservas(hoja, reservas, guardado) {
  if (!reservas.length) return;
  const filas = reservas.map(r => { const g = guardado[r.codigo] || {}; let emp = g.empleada || ""; if (!emp && r.empleadaAuto) emp = r.empleadaAuto; const estado = g.estado === "Finalizado" ? "Finalizado" : (g.estado || r.estado); return [r.codigo, r.id, r.propiedad, r.checkin, r.checkout, r.noches, estado, emp, r.precio, g.notas||"", g.acceso||r.acceso||"", g.eventId||"", ""]; });
  hoja.getRange(2, 1, filas.length, 13).setValues(filas);
  hoja.getRange(2, 4, filas.length, 2).setNumberFormat("@");
  for (let i = 0; i < filas.length; i++) { const bg = filas[i][6] === "Finalizado" ? "#e8f5e9" : i%2===0 ? "#f8f9fa" : "#ffffff"; hoja.getRange(i+2, 1, 1, 13).setBackground(bg).setFontFamily("Arial").setFontSize(10); }
  hoja.getRange(2, 9, filas.length, 1).setNumberFormat("$#,##0");
}

function aplicarDropdowns(hoja) {
  const nombres = CONFIG.empleadas.map(e => e.nombre);
  hoja.getRange("H2:H2000").setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(nombres, true).setAllowInvalid(false).build());
  hoja.getRange("G2:G2000").setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(["Confirmada","Cancelada","Pendiente","Finalizado"], true).setAllowInvalid(false).build());
}function sincronizarGoogleCalendar() {
  const ss   = SpreadsheetApp.getActiveSpreadsheet();
  const hoja = ss.getSheetByName(CONFIG.hojaMaestra);
  if (!hoja || hoja.getLastRow() < 2) return;
  const datos = hoja.getRange(2, 1, hoja.getLastRow()-1, 13).getValues();
  const disp  = hoja.getRange(2, 4, hoja.getLastRow()-1, 2).getDisplayValues();
  const cal   = CalendarApp.getDefaultCalendar();
  let creados = 0, actualizados = 0;
  for (let i = 0; i < datos.length; i++) {
    const r = datos[i]; const fila = i + 2;
    const codigo  = String(r[0]);
    const empNom  = String(r[7] || "");
    const estado  = String(r[6] || "");
    const eventId = String(r[11] || "");
    if (!codigo || !empNom) continue;
    if (estado === "Cancelada" || estado === "Finalizado") { if (eventId) { try { cal.getEventById(eventId).deleteEvent(); } catch(e) {} hoja.getRange(fila, 12).setValue(""); } continue; }
    const emp = CONFIG.empleadas.find(e => e.nombre === empNom);
    if (!emp || !emp.email) continue;
    const checkoutStr = disp[i][1] || fechaToStr(r[4]);
    const fecha = fechaADate(checkoutStr);
    if (!fecha) continue;
    const checkinStr = disp[i][0] || fechaToStr(r[3]);
    const inicio = new Date(fecha); inicio.setHours(11,0,0,0);
    const fin    = new Date(fecha); fin.setHours(15,0,0,0);
    const titulo = "🧹 Limpieza " + nombreDia(fecha) + " - " + r[2];
    const desc   = ["Código: " + codigo, "Check-in: " + checkinStr + "  →  Check-out: " + checkoutStr, "Noches: " + r[5], "Precio: $" + Number(r[8]).toLocaleString("es-CO"), r[9] ? "Notas: " + r[9] : "", r[10] ? "Acceso: " + r[10] : ""].filter(Boolean).join("\n");
    if (eventId) { try { const ev = cal.getEventById(eventId); if (ev) { ev.setTitle(titulo); ev.setTime(inicio, fin); ev.setDescription(desc); const inv = ev.getGuestList().map(g => g.getEmail().toLowerCase()); if (!inv.includes(emp.email.toLowerCase())) ev.addGuest(emp.email); actualizados++; continue; } } catch(e) {} }
    const nEv = cal.createEvent(titulo, inicio, fin, { guests: emp.email, sendInvites: true, description: desc });
    hoja.getRange(fila, 12).setValue(nEv.getId());
    creados++;
  }
  SpreadsheetApp.getActiveSpreadsheet().toast("📅 Calendario: " + creados + " creados, " + actualizados + " actualizados", "Google Calendar Sync", 5);
}

function reenviarInvitacionSeleccionada() {
  const hoja    = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.hojaMaestra);
  const fila    = hoja.getActiveRange().getRow(); if (fila < 2) return;
  const d       = hoja.getRange(fila, 1, 1, 13).getValues()[0];
  const dispD   = hoja.getRange(fila, 4, 1, 2).getDisplayValues()[0];
  const empNom  = String(d[7] || "");
  const checkoutStr = dispD[1] || fechaToStr(d[4]);
  const fecha   = fechaADate(checkoutStr);
  const prop    = String(d[2] || "");
  const eventId = String(d[11] || "");
  const emp     = CONFIG.empleadas.find(e => e.nombre === empNom);
  if (!emp || !fecha || !emp.email) return;
  const cal = CalendarApp.getDefaultCalendar();
  if (eventId) { try { const ev = cal.getEventById(eventId); if (ev) { ev.removeGuest(emp.email); ev.addGuest(emp.email); SpreadsheetApp.getActiveSpreadsheet().toast("📨 Reenviada a " + emp.nombre, "OK", 4); return; } } catch(e) {} }
  const ini = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate(), 0, 0);
  const fin = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate(), 23, 59);
  for (const ev of cal.getEvents(ini, fin)) { if (ev.getTitle().includes(prop)) { ev.removeGuest(emp.email); ev.addGuest(emp.email); SpreadsheetApp.getActiveSpreadsheet().toast("📨 Reenviada a " + emp.nombre, "OK", 4); return; } }
  SpreadsheetApp.getActiveSpreadsheet().toast("⚠️ No se encontró el evento", "Error", 4);
}

function importarAseosPasados() {
  const ss   = SpreadsheetApp.getActiveSpreadsheet();
  let   hoja = ss.getSheetByName(CONFIG.hojaAseos);
  if (!hoja) hoja = crearHojaAseos();
  const existentes = new Set();
  if (hoja.getLastRow() > 1) { hoja.getRange(2, 1, hoja.getLastRow()-1, 1).getValues().forEach(r => { if (r[0]) existentes.add(String(r[0])); }); }
  const aseos = [
    ["HMW3S24TCP", "#0092", "2H Apto Moderno en Laureles | Estadio y Metro", "30/04/2026", "03/05/2026", 3, "", "Completado", 90000, "", "Clave edificio: 662233# | Clave apto: 0052# | Dirección: Cra 68 # 48-25 edificio Monte Ignacio apto 502", "", "(importado)"],
    ["HMXHNJAXZM", "#0094", "Suite Moderna en Laureles | 02", "30/04/2026", "03/05/2026", 3, "", "Completado", 60000, "", "Clave edificio: 475869# | Clave apto: 556699# | Dirección: Crr 78B # 49A-14 suite 2", "", "(importado)"],
    ["HM3E42Q5HT", "#0091", "New Industrial Loft in Laureles | Stadium & Metro", "30/04/2026", "06/05/2026", 6, "", "Completado", 90000, "", "Clave edificio: 662233# | Clave apto: 5501# | Dirección: Crr 68 # 48-25 edificio monte Ignacio apto 501", "", "(importado)"],
    ["HM2RPH3KHH", "#0002", "Luxury 3 Bedroom Apartment in Provenza", "30/04/2026", "04/05/2026", 4, "", "Completado", 130000, "", "Clave apto: Actualizar | Dirección: Cl. 13 #34-31, apto 1001", "", "(importado)"]
  ];
  const nuevos = aseos.filter(a => !existentes.has(a[0]));
  if (!nuevos.length) { SpreadsheetApp.getActiveSpreadsheet().toast("Ya estaban todos importados.", "Importar", 4); return; }
  const fi = hoja.getLastRow() + 1;
  hoja.getRange(fi, 1, nuevos.length, 13).setValues(nuevos);
  hoja.getRange(fi, 4, nuevos.length, 2).setNumberFormat("@");
  hoja.getRange(fi, 9, nuevos.length, 1).setNumberFormat("$#,##0");
  for (let i = 0; i < nuevos.length; i++) { hoja.getRange(fi+i, 1, 1, 13).setBackground("#e8f5e9").setFontFamily("Arial").setFontSize(10); }
  SpreadsheetApp.getActiveSpreadsheet().toast("✅ " + nuevos.length + " aseos importados.", "Importar", 6);
}function agregarAseoManual() {
  const propiedades = getPropiedades();
  const empleadas   = CONFIG.empleadas.map(e => e.nombre);
  const propsOpts = propiedades.map(p => '<option value="' + p.id + '|' + p.nombre.replace(/"/g,'') + '|' + p.precioAseoInterno + '|' + p.acceso.replace(/"/g,'') + '">' + p.id + ' — ' + p.nombre + '</option>').join('');
  const empOpts = ['', ...empleadas].map(e => '<option value="' + e + '">' + (e || 'Sin asignar') + '</option>').join('');
  const html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>' +
    'body{font-family:Arial,sans-serif;font-size:14px;padding:16px;margin:0}' +
    'label{display:block;margin-top:12px;font-weight:700;font-size:11px;color:#555;text-transform:uppercase;letter-spacing:.5px}' +
    'select,input{width:100%;padding:9px;margin-top:4px;border:1.5px solid #ccc;border-radius:6px;font-size:14px;box-sizing:border-box}' +
    '.row2{display:flex;gap:8px}.row2>div{flex:1}' +
    '.btn{background:#1e3a5f;color:#fff;padding:13px;border:none;border-radius:7px;width:100%;font-size:15px;font-weight:700;cursor:pointer;margin-top:18px}' +
    '.btn:hover{background:#152a47}.err{color:#c00;font-size:13px;margin-top:8px;display:none}' +
    '</style></head><body>' +
    '<label>Propiedad</label>' +
    '<select id="prop" onchange="onProp()"><option value="">Selecciona propiedad...</option>' + propsOpts + '</select>' +
    '<label>Fecha del aseo (check-out)</label>' +
    '<input type="date" id="checkout">' +
    '<div class="row2"><div><label>Noches</label><input type="number" id="noches" value="1" min="1"></div>' +
    '<div><label>Precio ($COP)</label><input type="number" id="precio" value="0" min="0"></div></div>' +
    '<label>Aseadora</label><select id="aseadora">' + empOpts + '</select>' +
    '<label>Notas (opcional)</label><input type="text" id="notas" placeholder="Instrucciones especiales...">' +
    '<button class="btn" onclick="guardar()">✅ Agregar Aseo</button>' +
    '<div class="err" id="err">Completa Propiedad y Fecha.</div>' +
    '<script>function onProp(){var p=document.getElementById("prop").value.split("|");if(p.length>=3)document.getElementById("precio").value=p[2];}' +
    'function guardar(){var prop=document.getElementById("prop").value;var co=document.getElementById("checkout").value;' +
    'if(!prop||!co){document.getElementById("err").style.display="block";return;}' +
    'document.getElementById("err").style.display="none";' +
    'var parts=prop.split("|");' +
    'google.script.run.withSuccessHandler(function(m){alert(m);google.script.host.close();})' +
    '.withFailureHandler(function(e){alert("Error: "+e.message);})' +
    '.guardarAseoManual({idProp:parts[0],propiedad:parts[1],precio:parseInt(document.getElementById("precio").value)||0,' +
    'acceso:parts[3]||"",checkout:co,noches:parseInt(document.getElementById("noches").value)||1,' +
    'aseadora:document.getElementById("aseadora").value,notas:document.getElementById("notas").value});' +
    '}<\/script></body></html>';
  SpreadsheetApp.getUi().showModalDialog(
    HtmlService.createHtmlOutput(html).setWidth(420).setHeight(510),
    '➕ Agregar Aseo Manual'
  );
}

function guardarAseoManual(data) {
  const ss   = SpreadsheetApp.getActiveSpreadsheet();
  let   hoja = ss.getSheetByName(CONFIG.hojaAseos);
  if (!hoja) hoja = crearHojaAseos();
  const existentes = hoja.getLastRow() > 1 ? hoja.getRange(2, 1, hoja.getLastRow()-1, 1).getValues().flat().map(String) : [];
  const manuales = existentes.filter(c => c.startsWith('MANUAL-'));
  const codigo   = 'MANUAL-' + String(manuales.length + 1).padStart(3, '0');
  const p  = data.checkout.split('-');
  const checkoutStr = p[2] + '/' + p[1] + '/' + p[0];
  const coDate = new Date(parseInt(p[0]), parseInt(p[1])-1, parseInt(p[2]));
  const ciDate = new Date(coDate.getTime() - data.noches * 86400000);
  const checkinStr = String(ciDate.getDate()).padStart(2,'0') + '/' + String(ciDate.getMonth()+1).padStart(2,'0') + '/' + ciDate.getFullYear();
  const fila = [codigo, data.idProp, data.propiedad, checkinStr, checkoutStr, data.noches, data.aseadora || '', 'Pendiente', data.precio, data.notas || '', data.acceso || '', '', ''];
  const fi = hoja.getLastRow() + 1;
  hoja.getRange(fi, 1, 1, 13).setValues([fila]);
  hoja.getRange(fi, 4, 1, 2).setNumberFormat('@');
  hoja.getRange(fi, 9, 1, 1).setNumberFormat('$#,##0');
  hoja.getRange(fi, 1, 1, 13).setBackground('#fff9e6').setFontFamily('Arial').setFontSize(10);
  SpreadsheetApp.getActiveSpreadsheet().toast('✅ Aseo manual agregado: ' + codigo, 'Listo', 5);
  return '✅ Aseo manual agregado con código ' + codigo;
}

function crearTriggersAutomaticos() {
  for (const t of ScriptApp.getProjectTriggers()) ScriptApp.deleteTrigger(t);
  ScriptApp.newTrigger("sincronizarCalendarios").timeBased().everyHours(6).create();
  ScriptApp.newTrigger("sincronizarGoogleCalendar").timeBased().everyHours(2).create();
  ScriptApp.newTrigger("autoCompletarAseosPasados").timeBased().atHour(22).everyDays(1).create();
  SpreadsheetApp.getActiveSpreadsheet().toast("✅ Triggers creados (Airbnb c/6h, Calendar c/2h, Auto-completar 10PM)", "Triggers", 6);
}