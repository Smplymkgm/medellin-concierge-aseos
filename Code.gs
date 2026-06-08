var SPREADSHEET_ID = "1iKbcU8lcr9g5IWxryOzCs73K6TiHsmT2iSPUp6O5s5Q";
function getSS() { return SpreadsheetApp.openById(SPREADSHEET_ID); }

// ============================================================
// CONFIGURACIÓN
// ============================================================

var CONFIG = {
  hojaMaestra:    "Todas las Reservas",
  hojaAseos:       "Todos los Aseos",
  hojaPropiedades: "Propiedades",
  hojaPersonal:    "Personal",
  hojaVideos:      "Videos Aseos",
  carpetaRaiz:     "Medellin Concierge - Videos Aseos",
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

function fechaADate(val) {
  if (!val) return null;
  if (Object.prototype.toString.call(val) === "[object Date]") {
    var d = new Date(val); d.setHours(0,0,0,0); return d;
  }
  var s = String(val).trim();
  var p = s.split("/");
  if (p.length !== 3) return null;
  var d = new Date(parseInt(p[2]), parseInt(p[1])-1, parseInt(p[0]));
  d.setHours(0,0,0,0); return d;
}

function formatearFecha(fecha) {
  return Utilities.formatDate(fecha, "America/Bogota", "dd/MM/yyyy");
}

function nombreDia(fecha) {
  return ["domingo","lunes","martes","miercoles","jueves","viernes","sabado"][fecha.getDay()];
}

function hoyStr() {
  return formatearFecha(new Date());
}

// ============================================================
// RESPONSE HELPER
// ============================================================

function respond(ok, data, error) {
  var payload = { ok: ok };
  if (data !== null && data !== undefined) payload.data = data;
  if (error) payload.error = String(error);
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
// ROUTER — doPost
// ============================================================

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var action = body.action;

    if (action === "login")               return handleLogin(body);
    if (action === "getAseos")            return handleGetAseos(body);
    if (action === "completarAseo")       return handleCompletarAseo(body);
    if (action === "completar")           return handleCompletarAseo(body); // alias usado por la app
    if (action === "getAllAseos")          return handleGetAllAseos(body);
    if (action === "asignarAseo")         return handleAsignarAseo(body);
    if (action === "moverAseo")           return handleMoverAseo(body);
    if (action === "getPropiedades")      return handleGetPropiedades(body);
    if (action === "agregarPropiedad")    return handleAgregarPropiedad(body);
    if (action === "actualizarPropiedad") return handleActualizarPropiedad(body);
    if (action === "eliminarPropiedad")   return handleEliminarPropiedad(body);
    if (action === "getPersonal")         return handleGetPersonal(body);
    if (action === "actualizarPersonal")  return handleActualizarPersonal(body);
    if (action === "getUploadUrl")        return handleGetUploadUrl(body);
    if (action === "registrarVideo")      return handleRegistrarVideo(body);
    if (action === "agregarAseo")         return handleAgregarAseo(body);
    if (action === "getHistorial")        return handleGetHistorial(body);
    if (action === "runSelfTest")         return respond(true, runSelfTest());

    // Endpoints debug/inspect/run* eliminados en la auditoría de
    // producción. Las funciones administrativas se ejecutan vía el menú
    // del spreadsheet (require sesión Google del owner) y no son
    // alcanzables anónimamente. Mantener doPost minimal reduce superficie
    // de ataque.
    if (action === 'getDatos') {
      var n2 = body.nombre || '';
      var r2 = body.rol || 'aseadora';
      var p2 = getPersonal().map(function(u) { return { nombre: u.nombre, rol: u.nombre.toLowerCase()==='admin'?'admin':'aseadora', pin: u.pin, email: u.email, tel: u.telefono||'', cedula: u.cedula||'', banco: u.banco||'', tipoCuenta: u.tipoCuenta||'', numeroCuenta: u.numeroCuenta||'', nombreCompleto: u.nombreCompleto||'' }; });
      var pr2 = getPropiedades().map(function(p) { return { id: p.id, nombre: p.nombre, precio: p.precioAseo, acceso: p.acceso, accesoEstructurado: p.accesoEstructurado || null, icalUrls: p.icalUrls || [], empleadaAuto: p.empleadaAuto || '' }; });
      var a2 = r2==='admin' ? getAllAseos() : getAseosPorAseadora(n2);
      return respond(true, { personal: p2, propiedades: pr2, aseos: a2 });
    }

    return respond(false, null, "Accion desconocida: " + action);
  } catch(err) {
    Logger.log("doPost error: " + err.message + "\n" + err.stack);
    return respond(false, null, err.message);
  }
}

// doGet kept for health-check
function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, version: "2.1", fecha: hoyStr() }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
// AUTH
// ============================================================

function handleLogin(body) {
  var nombre = String(body.nombre || "").trim();
  var pin    = String(body.pin    || "").trim();
  if (!nombre || !pin) return respond(false, null, "Nombre y PIN requeridos");

  var personal = getPersonal();
  var usuario  = null;
  for (var i = 0; i < personal.length; i++) {
    if (personal[i].nombre.toLowerCase() === nombre.toLowerCase()) {
      usuario = personal[i]; break;
    }
  }
  if (!usuario) return respond(false, null, "Usuario no encontrado");
  if (usuario.pin !== pin) return respond(false, null, "PIN incorrecto");

  var rol = nombre.toLowerCase() === "admin" ? "admin" : "aseadora";
  return respond(true, { rol: rol, nombre: usuario.nombre });
}

// ============================================================
// LEER PERSONAL
// ============================================================

function getPersonal() {
  var ss   = getSS();
  var hoja = ss.getSheetByName(CONFIG.hojaPersonal);
  if (!hoja || hoja.getLastRow() < 2) return [];
  // Cols A-G base + H-K facturación + L nombre completo
  var lastCol = Math.max(hoja.getLastColumn(), 12);
  var datos = hoja.getRange(2, 1, hoja.getLastRow()-1, lastCol).getValues();
  var result = [];
  for (var i = 0; i < datos.length; i++) {
    var r = datos[i];
    var activa = r[0] === true || r[0] === "TRUE" || r[0] === "true";
    var nombre = String(r[1] || "").trim();
    if (!activa || !nombre) continue;
    result.push({
      nombre:     nombre,
      pin:        String(r[2] || "").trim(),
      email:      String(r[3] || "").trim(),
      formulario: String(r[4] || "").trim(),
      carpeta:    String(r[5] || "").trim(),
      telefono:   String(r[6] || "").trim(),
      cedula:      String(r[7]  || "").trim(),
      banco:       String(r[8]  || "").trim(),
      tipoCuenta:  String(r[9]  || "").trim(),
      numeroCuenta:String(r[10] || "").trim(),
      nombreCompleto: String(r[11] || "").trim(),
    });
  }
  return result;
}

// ============================================================
// ASEADORA — getAseos
// ============================================================

function handleGetAseos(body) {
  var nombre = String(body.nombre || "").trim();
  if (!nombre) return respond(false, null, "Nombre requerido");

  var ss   = getSS();
  var hoja = ss.getSheetByName(CONFIG.hojaAseos);
  var proximos  = [];
  var historial = [];

  if (hoja && hoja.getLastRow() >= 2) {
    var datos = hoja.getRange(2, 1, hoja.getLastRow()-1, 13).getValues();
    var disp  = hoja.getRange(2, 4, hoja.getLastRow()-1, 2).getDisplayValues();
    var hoy   = new Date(); hoy.setHours(0,0,0,0);

    for (var i = 0; i < datos.length; i++) {
      var r = datos[i];
      if (String(r[6]).trim() !== nombre) continue;

      var checkinStr  = disp[i][0] || fechaToStr(r[3]);
      var checkoutStr = disp[i][1] || fechaToStr(r[4]);
      var estado      = String(r[7] || "");
      var precio      = Number(r[8]) || 0;
      var accesoRaw   = String(r[10] || "");
      var checkout    = fechaADate(checkoutStr);

      if (!checkout) continue;

      var aseo = {
        codigo:    String(r[0]),
        idProp:    String(r[1]).trim(),
        propiedad: String(r[2]).trim(),
        checkin:   checkinStr,
        checkout:  checkoutStr,
        noches:    Number(r[5]) || 0,
        estado:    estado,
        precio:    precio,
        notas:     String(r[9]  || ""),
        accesos:   accesoRaw ? accesoRaw.split("|").map(function(a){return a.trim();}).filter(Boolean) : [],
      };

      if (estado === "Completado") {
        aseo.fechaCompletado = String(r[12] || "");
        historial.push(aseo);
      } else if (checkout >= hoy) {
        if (estado !== "Cancelado") proximos.push(aseo);
      } else {
        aseo.fechaCompletado = String(r[12] || "");
        historial.push(aseo);
      }
    }
  }

  proximos.sort(function(a,b){
    var da = fechaADate(a.checkout), db = fechaADate(b.checkout);
    return da && db ? da - db : 0;
  });
  historial.sort(function(a,b){
    var da = fechaADate(a.checkout), db = fechaADate(b.checkout);
    return da && db ? db - da : 0;
  });

  var totalGanado = 0;
  for (var j = 0; j < historial.length; j++) {
    if (historial[j].estado === "Completado") totalGanado += historial[j].precio;
  }

  return respond(true, { proximos: proximos, historial: historial, totalGanado: totalGanado });
}

// ============================================================
// ASEADORA — completarAseo (guarda form completo en cols 14-20)
// ============================================================
// Layout extendido:
//  1 Codigo | 2 IdProp | 3 Propiedad | 4 Checkin | 5 Checkout | 6 Noches
//  7 Aseadora | 8 Estado | 9 Precio | 10 Notas | 11 Acceso | 12 CalId | 13 Completado
//  14 Entrada | 15 Salida | 16 Revision (json) | 17 Reposicion (json)
//  18 Funcionamiento (json) | 19 Reporte | 20 Video

// Schema explícito de columnas del formulario en hoja "Todos los Aseos":
// orden importa. Cada ítem del form = una columna propia.
var FORM_COLUMNS = (function() {
  var cols = [];
  // Tiempos
  cols.push({ key: "entrada",        label: "Entrada",        width: 70 });
  cols.push({ key: "salida",         label: "Salida",         width: 70 });
  // Revisión (6 áreas)
  cols.push({ key: "rev_habitaciones", label: "Aseo: Habitaciones", width: 110, group: "revision",     id: "habitaciones" });
  cols.push({ key: "rev_cocina",       label: "Aseo: Cocina",       width: 100, group: "revision",     id: "cocina" });
  cols.push({ key: "rev_sala",         label: "Aseo: Sala",         width: 100, group: "revision",     id: "sala" });
  cols.push({ key: "rev_banos",        label: "Aseo: Baños",        width: 100, group: "revision",     id: "banos" });
  cols.push({ key: "rev_balcon",       label: "Aseo: Balcón",       width: 100, group: "revision",     id: "balcon" });
  cols.push({ key: "rev_util",         label: "Aseo: Cuarto útil",  width: 110, group: "revision",     id: "util" });
  // Reposición (5)
  cols.push({ key: "rep_jabon",        label: "Repos: Jabón",       width: 100, group: "reposicion",   id: "jabon" });
  cols.push({ key: "rep_papelBano",    label: "Repos: Papel baño",  width: 110, group: "reposicion",   id: "papelBano" });
  cols.push({ key: "rep_papelCocina",  label: "Repos: Papel cocina",width: 120, group: "reposicion",   id: "papelCocina" });
  cols.push({ key: "rep_panitos",      label: "Repos: Pañitos",     width: 100, group: "reposicion",   id: "panitos" });
  cols.push({ key: "rep_bolsas",       label: "Repos: Bolsas",      width: 100, group: "reposicion",   id: "bolsas" });
  // Funcionamiento (9)
  cols.push({ key: "fun_interruptores",label: "Func: Interruptores",width: 130, group: "funcionamiento", id: "interruptores" });
  cols.push({ key: "fun_puertas",      label: "Func: Puertas",      width: 110, group: "funcionamiento", id: "puertas" });
  cols.push({ key: "fun_aires",        label: "Func: Aires",        width: 110, group: "funcionamiento", id: "aires" });
  cols.push({ key: "fun_ventanas",     label: "Func: Ventanas",     width: 110, group: "funcionamiento", id: "ventanas" });
  cols.push({ key: "fun_mesas",        label: "Func: Mesas",        width: 110, group: "funcionamiento", id: "mesas" });
  cols.push({ key: "fun_sofas",        label: "Func: Sofás",        width: 110, group: "funcionamiento", id: "sofas" });
  cols.push({ key: "fun_camas",        label: "Func: Camas",        width: 110, group: "funcionamiento", id: "camas" });
  cols.push({ key: "fun_tvs",          label: "Func: TVs",          width: 100, group: "funcionamiento", id: "tvs" });
  cols.push({ key: "fun_lavadora",     label: "Func: Lavadora",     width: 110, group: "funcionamiento", id: "lavadora" });
  // Texto libre y video
  cols.push({ key: "reporte",          label: "Reporte",            width: 240 });
  cols.push({ key: "video",            label: "Video",              width: 260 });
  return cols;
})();
var FORM_FIRST_COL = 14;
var FORM_LAST_COL  = FORM_FIRST_COL + FORM_COLUMNS.length - 1;

function ensureAseosFormColumns(hoja) {
  var lastCol = hoja.getLastColumn();
  // Si ya tiene las columnas y el primer header coincide, asumir OK
  var existingHeaders = lastCol >= FORM_FIRST_COL
    ? hoja.getRange(1, FORM_FIRST_COL, 1, Math.min(lastCol - FORM_FIRST_COL + 1, FORM_COLUMNS.length)).getValues()[0]
    : [];
  var alreadyOk = existingHeaders[0] === FORM_COLUMNS[0].label && lastCol >= FORM_LAST_COL;
  if (alreadyOk) return;

  // Escribir todos los headers de FORM_COLUMNS desde col 14
  var labels = FORM_COLUMNS.map(function(c){ return c.label; });
  hoja.getRange(1, FORM_FIRST_COL, 1, labels.length).setValues([labels])
    .setBackground("#1a1a2e").setFontColor("#ffffff")
    .setFontWeight("bold").setFontSize(11).setFontFamily("Arial");
  for (var i = 0; i < FORM_COLUMNS.length; i++) {
    hoja.setColumnWidth(FORM_FIRST_COL + i, FORM_COLUMNS[i].width);
  }
}

// Convierte 'ok'/'review'/'na'/bool en el ícono que va a la celda
function valToIcon(v) {
  if (v === undefined || v === null || v === "") return "";
  if (v === "ok" || v === true)  return "✓";
  if (v === "review" || v === false) return "⚠";
  if (v === "na") return "—";
  return String(v);
}

// Helper para convertir un URL en hyperlink clickeable de Sheets
function buildHyperlink(url, label) {
  if (!url) return "";
  var u = String(url).trim();
  if (u.indexOf("http") !== 0) return u; // no es URL, lo dejamos as-is
  var safeLabel = String(label || "Ver video").replace(/"/g, '""');
  var safeUrl   = u.replace(/"/g, '""');
  return '=HYPERLINK("' + safeUrl + '","' + safeLabel + '")';
}

function buildFormRow(body) {
  var rev = body.revision || {};
  var rep = body.reposicion || {};
  var fun = body.funcionamiento || {};
  var videoUrl = String(body.videoLink || body.video || "").trim();
  var videoCell = buildHyperlink(videoUrl, "Ver video");
  return FORM_COLUMNS.map(function(c) {
    if (c.key === "entrada")  return String(body.entrada || "").trim();
    if (c.key === "salida")   return String(body.salida  || "").trim();
    if (c.key === "reporte")  return String(body.reporte || "").trim();
    if (c.key === "video")    return videoCell;
    if (c.group === "revision")       return valToIcon(rev[c.id]);
    if (c.group === "reposicion")     return valToIcon(rep[c.id]);
    if (c.group === "funcionamiento") return valToIcon(fun[c.id]);
    return "";
  });
}

// Labels para renderizar legible en el spreadsheet (espejo de data.jsx)
var LABELS_REVISION = {
  habitaciones: "Habitaciones",
  cocina:       "Cocina / Comedor",
  sala:         "Sala / Sala de estar",
  banos:        "Baños",
  balcon:       "Balcón / Terraza",
  util:         "Cuarto útil",
};
var LABELS_REPOSICION = {
  jabon:       "Jabón y shampoo",
  papelBano:   "Papel de baño",
  papelCocina: "Papel de cocina",
  panitos:     "Pañitos de cocina",
  bolsas:      "Bolsas en contenedores",
};
var LABELS_FUNCIONA = {
  interruptores: "Interruptores/bombillos",
  puertas:       "Puertas",
  aires:         "Aires acondicionados",
  ventanas:      "Ventanas",
  mesas:         "Mesas/barras",
  sofas:         "Sofás/sillas",
  camas:         "Camas",
  tvs:           "Televisores",
  lavadora:      "Lavadora/secadora",
};

function fmtCheckObj(obj, labels) {
  if (!obj) return "";
  var lines = [];
  for (var key in labels) {
    if (!labels.hasOwnProperty(key)) continue;
    var val = obj[key];
    if (val === undefined || val === null || val === "") continue;
    var icon;
    if (val === "ok" || val === true) icon = "✓";
    else if (val === "review" || val === false) icon = "⚠";
    else if (val === "na") icon = "—";
    else icon = "•";
    lines.push(icon + " " + labels[key]);
  }
  return lines.join("\n");
}

function handleCompletarAseo(body) {
  var codigo    = String(body.codigo    || "").trim();
  var nombre    = String(body.nombre    || "").trim();
  var notas     = String(body.notas     || "").trim();
  var videoLink = String(body.videoLink || body.video || "").trim();
  var entrada   = String(body.entrada   || "").trim();
  var salida    = String(body.salida    || "").trim();
  // Versión legible para humanos en la hoja (multi-línea con ✓/⚠/—).
  // El JSON crudo va en la nota de la celda por si necesitas la estructura
  // exacta más adelante.
  var revision       = fmtCheckObj(body.revision,       LABELS_REVISION);
  var reposicion     = fmtCheckObj(body.reposicion,     LABELS_REPOSICION);
  var funcionamiento = fmtCheckObj(body.funcionamiento, LABELS_FUNCIONA);
  var revisionJson       = body.revision       ? JSON.stringify(body.revision)       : "";
  var reposicionJson     = body.reposicion     ? JSON.stringify(body.reposicion)     : "";
  var funcionamientoJson = body.funcionamiento ? JSON.stringify(body.funcionamiento) : "";
  var reporte   = String(body.reporte   || "").trim();

  if (!codigo || !nombre) return respond(false, null, "Codigo y nombre requeridos");

  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch(e) { return respond(false, null, "Sistema ocupado, intenta de nuevo"); }

  try {
    var ss   = getSS();
    var hoja = ss.getSheetByName(CONFIG.hojaAseos);
    if (!hoja || hoja.getLastRow() < 2) return respond(false, null, "Hoja no encontrada");

    ensureAseosFormColumns(hoja);

    var hoy   = new Date(); hoy.setHours(0,0,0,0);
    var datos = hoja.getRange(2, 1, hoja.getLastRow()-1, 13).getValues();
    var disp  = hoja.getRange(2, 4, hoja.getLastRow()-1, 2).getDisplayValues();

    for (var i = 0; i < datos.length; i++) {
      if (String(datos[i][0]) !== codigo) continue;
      if (String(datos[i][6]).trim() !== nombre) return respond(false, null, "No autorizado");

      var checkoutStr = disp[i][1] || fechaToStr(datos[i][4]);
      var checkout    = fechaADate(checkoutStr);
      if (!checkout)      return respond(false, null, "Fecha invalida");
      if (checkout > hoy) return respond(false, null, "No puedes completar aseos futuros");

      var fila  = i + 2;
      var ahora = Utilities.formatDate(new Date(), "America/Bogota", "dd/MM/yyyy HH:mm");

      // Batch write: cols 8 (Estado) y 13 (Completado) en una sola op para las
      // celdas que son adyacentes al rango formulario. Para minimizar llamadas
      // a Sheets API hacemos updates por celda relevante.
      hoja.getRange(fila, 8).setValue("Completado");
      hoja.getRange(fila, 13).setValue(ahora);
      if (notas) hoja.getRange(fila, 10).setValue(notas);

      // Batch write a TODAS las columnas del form (una celda por ítem)
      var rowValues = buildFormRow(body);
      hoja.getRange(fila, FORM_FIRST_COL, 1, rowValues.length).setValues([rowValues])
        .setHorizontalAlignment("center")
        .setVerticalAlignment("middle");
      // Excepción: reporte y video alineados a la izquierda
      var reporteCol = FORM_FIRST_COL + FORM_COLUMNS.length - 2;
      hoja.getRange(fila, reporteCol, 1, 2).setHorizontalAlignment("left").setWrap(true);

      hoja.getRange(fila, 1, 1, FORM_LAST_COL).setBackground("#e8f5e9").setFontFamily("Arial").setFontSize(10);

      // Sync al master
      var master = ss.getSheetByName(CONFIG.hojaMaestra);
      if (master && master.getLastRow() >= 2) {
        var mc = master.getRange(2, 1, master.getLastRow()-1, 1).getValues();
        for (var j = 0; j < mc.length; j++) {
          if (String(mc[j][0]) === codigo) {
            master.getRange(j+2, 7).setValue("Finalizado");
            master.getRange(j+2, 1, 1, 13).setBackground("#e8f5e9");
            break;
          }
        }
      }

      if (videoLink) {
        registrarVideoEnHoja({
          codigo:    codigo,
          propiedad: String(datos[i][2]),
          aseadora:  nombre,
          checkout:  checkoutStr,
          videoLink: videoLink,
          notas:     notas,
        });
      }

      return respond(true, null);
    }
    return respond(false, null, "Aseo no encontrado");
  } finally {
    try { lock.releaseLock(); } catch(e) {}
  }
}

// ============================================================
// ADMIN — getAllAseos
// ============================================================

function handleGetAllAseos(body) {
  var filtroAseadora = String(body.filtroAseadora || "").trim().toLowerCase();
  var fechaInicio    = String(body.fechaInicio    || "").trim();
  var fechaFin       = String(body.fechaFin       || "").trim();

  var ss   = getSS();
  var hoja = ss.getSheetByName(CONFIG.hojaAseos);
  if (!hoja || hoja.getLastRow() < 2) return respond(true, []);

  var datos = hoja.getRange(2, 1, hoja.getLastRow()-1, 13).getValues();
  var disp  = hoja.getRange(2, 4, hoja.getLastRow()-1, 2).getDisplayValues();
  var dInicio = fechaInicio ? fechaADate(fechaInicio) : null;
  var dFin    = fechaFin    ? fechaADate(fechaFin)    : null;

  var result = [];
  for (var i = 0; i < datos.length; i++) {
    var r = datos[i];
    if (!String(r[0])) continue;

    var aseadora    = String(r[6] || "").trim();
    var checkinStr  = disp[i][0] || fechaToStr(r[3]);
    var checkoutStr = disp[i][1] || fechaToStr(r[4]);
    var checkout    = fechaADate(checkoutStr);

    if (filtroAseadora && aseadora.toLowerCase() !== filtroAseadora) continue;
    if (dInicio && checkout && checkout < dInicio) continue;
    if (dFin    && checkout && checkout > dFin)    continue;

    result.push({
      codigo:          String(r[0]),
      idProp:          String(r[1]).trim(),
      propiedad:       String(r[2]).trim(),
      checkin:         checkinStr,
      checkout:        checkoutStr,
      noches:          Number(r[5]) || 0,
      aseadora:        aseadora,
      estado:          String(r[7] || ""),
      precio:          Number(r[8]) || 0,
      notas:           String(r[9]  || ""),
      acceso:          String(r[10] || ""),
      fechaCompletado: String(r[12] || ""),
    });
  }

  result.sort(function(a,b){
    var da = fechaADate(a.checkout), db = fechaADate(b.checkout);
    return da && db ? da - db : 0;
  });

  return respond(true, result);
}

// ============================================================
// ADMIN — getHistorial (filtros por mes/rango/aseadora/propiedad)
// ============================================================

function handleGetHistorial(body) {
  var nombre   = String(body.nombre   || "").trim();         // si se setea, solo esa aseadora
  var propId   = String(body.propId   || "").trim();
  var year     = body.year   != null ? Number(body.year)   : null;
  var month    = body.month  != null ? Number(body.month)  : null;  // 0-11
  var desdeStr = String(body.desde  || "").trim();           // dd/MM/yyyy o yyyy-MM-dd
  var hastaStr = String(body.hasta  || "").trim();

  function parseDate(s) {
    if (!s) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      var p = s.split("-");
      return new Date(parseInt(p[0]), parseInt(p[1]) - 1, parseInt(p[2]));
    }
    return fechaADate(s);
  }
  var desde = parseDate(desdeStr);
  var hasta = parseDate(hastaStr);

  var ss   = getSS();
  var hoja = ss.getSheetByName(CONFIG.hojaAseos);
  if (!hoja || hoja.getLastRow() < 2) {
    return respond(true, { items: [], total: 0, count: 0, porAseadora: {} });
  }

  var datos = hoja.getRange(2, 1, hoja.getLastRow()-1, 13).getValues();
  var disp  = hoja.getRange(2, 4, hoja.getLastRow()-1, 2).getDisplayValues();

  var items = [];
  var total = 0;
  var porAseadora = {};

  for (var i = 0; i < datos.length; i++) {
    var r = datos[i];
    if (String(r[7] || "") !== "Completado") continue;

    var aseadora = String(r[6] || "").trim();
    if (nombre && aseadora.toLowerCase() !== nombre.toLowerCase()) continue;
    if (propId && String(r[1]).trim() !== propId) continue;

    var checkoutStr = disp[i][1] || fechaToStr(r[4]);
    var completadoStr = String(r[12] || "").split(" ")[0];
    var dt = fechaADate(completadoStr) || fechaADate(checkoutStr);
    if (!dt) continue;

    if (year != null && dt.getFullYear() !== year) continue;
    if (month != null && dt.getMonth() !== month) continue;
    if (desde && dt < desde) continue;
    if (hasta) {
      var hastaEnd = new Date(hasta.getTime()); hastaEnd.setHours(23,59,59,999);
      if (dt > hastaEnd) continue;
    }

    var precio = Number(r[8]) || 0;
    total += precio;
    porAseadora[aseadora] = (porAseadora[aseadora] || 0) + precio;
    items.push({
      codigo:    String(r[0]),
      idProp:    String(r[1]).trim(),
      propiedad: String(r[2]).trim(),
      checkin:   disp[i][0] || fechaToStr(r[3]),
      checkout:  checkoutStr,
      aseadora:  aseadora,
      precio:    precio,
      fechaCompletado: String(r[12] || ""),
    });
  }

  items.sort(function(a, b) {
    var da = fechaADate(a.fechaCompletado.split(" ")[0]) || fechaADate(a.checkout);
    var db = fechaADate(b.fechaCompletado.split(" ")[0]) || fechaADate(b.checkout);
    return da && db ? db - da : 0;
  });

  return respond(true, { items: items, total: total, count: items.length, porAseadora: porAseadora });
}

// ============================================================
// ADMIN — asignarAseo
// ============================================================

function handleAsignarAseo(body) {
  var codigo   = String(body.codigo   || "").trim();
  var aseadora = String(body.aseadora || "").trim();
  if (!codigo) return respond(false, null, "Codigo requerido");

  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch(e) { return respond(false, null, "Sistema ocupado"); }
  try {
    var ss   = getSS();
    var hoja = ss.getSheetByName(CONFIG.hojaAseos);
    if (!hoja || hoja.getLastRow() < 2) return respond(false, null, "Hoja no encontrada");

    var datos = hoja.getRange(2, 1, hoja.getLastRow()-1, 13).getValues();
    var disp  = hoja.getRange(2, 4, hoja.getLastRow()-1, 2).getDisplayValues();
    var aseoInfo = null;

    var rowSnapshot = null;
    var aseadoraAnterior = "";
    for (var i = 0; i < datos.length; i++) {
      if (String(datos[i][0]) !== codigo) continue;
      var fila = i + 2;
      aseadoraAnterior = String(datos[i][6] || "").trim();
      hoja.getRange(fila, 7).setValue(aseadora);

      var checkoutStr = disp[i][1] || fechaToStr(datos[i][4]);
      aseoInfo = {
        codigo:    codigo,
        propiedad: String(datos[i][2]),
        checkout:  checkoutStr,
      };
      rowSnapshot = datos[i];
      break;
    }

    if (!aseoInfo) return respond(false, null, "Aseo no encontrado");

    var master = ss.getSheetByName(CONFIG.hojaMaestra);
    if (master && master.getLastRow() >= 2) {
      var mc = master.getRange(2, 1, master.getLastRow()-1, 1).getValues();
      for (var j = 0; j < mc.length; j++) {
        if (String(mc[j][0]) === codigo) {
          master.getRange(j+2, 8).setValue(aseadora);
          break;
        }
      }
    }

    // Solo notificar si la aseadora realmente cambió (evita emails duplicados
    // cuando el admin guarda el mismo valor o el frontend reintenta la llamada)
    var aseadoraCambio = aseadora && aseadora !== aseadoraAnterior;
    if (aseadoraCambio) {
      notificarHubspot(aseoInfo, aseadora);
      try { notificarAsignacionEmail(aseoInfo, aseadora, rowSnapshot); } catch(e) { Logger.log("Email asignación: " + e.message); }
    }

    return respond(true, null);
  } finally {
    try { lock.releaseLock(); } catch(e) {}
  }
}

// ============================================================
// NOTIFICACIONES POR EMAIL
// ============================================================
// Cuando se asigna un aseo, la aseadora recibe un email con los detalles.
// La cuenta del owner del script (executeAs USER_DEPLOYING) envía. Quota
// de Gmail: 100 emails/día en cuenta personal, 1500/día en Workspace.

function notificarAsignacionEmail(aseo, aseadora, row) {
  if (!aseo || !aseadora) return;
  var personal = getPersonal();
  var emp = null;
  for (var i = 0; i < personal.length; i++) {
    if (personal[i].nombre.toLowerCase() === String(aseadora).toLowerCase()) {
      emp = personal[i]; break;
    }
  }
  if (!emp || !emp.email) {
    Logger.log("Sin email para " + aseadora + " — notificación saltada");
    return;
  }

  var acceso = row && row[10] ? String(row[10]) : "";
  var notas  = row && row[9]  ? String(row[9])  : "";

  var subject = "Te asignaron un aseo: " + (aseo.propiedad || aseo.codigo);
  var body = "Hola " + aseadora + ",\n\n" +
             "Te asignaron un aseo nuevo.\n\n" +
             "Propiedad: " + (aseo.propiedad || "—") + "\n" +
             "Código: " + (aseo.codigo || "—") + "\n" +
             "Fecha del aseo: " + (aseo.checkout || "—") + "\n" +
             (notas ? "Notas: " + notas + "\n" : "") +
             (acceso ? "Acceso: " + acceso + "\n" : "") +
             "\nAbre la app para ver más detalles:\n" +
             "https://smplymkgm.github.io/medellin-concierge-aseos/Index.html\n\n" +
             "— Medellín Concierge";

  MailApp.sendEmail({
    to: emp.email,
    subject: subject,
    body: body,
    name: "Medellín Concierge",
  });
  Logger.log("Email asignación enviado a " + emp.email + " (" + aseo.codigo + ")");
}

function notificarAdminAsignacionesPendientes() {
  var ss = getSS();
  var hoja = ss.getSheetByName(CONFIG.hojaAseos);
  if (!hoja || hoja.getLastRow() < 2) return;

  var hoy = new Date(); hoy.setHours(0,0,0,0);
  var datos = hoja.getRange(2, 1, hoja.getLastRow() - 1, 13).getValues();
  var disp  = hoja.getRange(2, 4, hoja.getLastRow() - 1, 2).getDisplayValues();

  var pendientes = [];
  for (var i = 0; i < datos.length; i++) {
    var r = datos[i];
    var asignada = String(r[6] || "").trim();
    var estado   = String(r[7] || "");
    if (asignada) continue;
    if (estado === "Completado" || estado === "Cancelado") continue;
    var checkoutStr = disp[i][1] || fechaToStr(r[4]);
    var checkout    = fechaADate(checkoutStr);
    if (!checkout) continue;
    if (!sameDayDate(checkout, hoy)) continue;
    pendientes.push({
      codigo: String(r[0]),
      propiedad: String(r[2]),
      checkout: checkoutStr,
    });
  }
  if (!pendientes.length) {
    Logger.log("notificarAdminAsignacionesPendientes: 0 pendientes hoy");
    return;
  }

  // Buscar email(s) de admin en Personal
  var personal = getPersonal();
  var adminEmails = [];
  for (var j = 0; j < personal.length; j++) {
    if (personal[j].nombre.toLowerCase() === "admin" && personal[j].email) {
      adminEmails.push(personal[j].email);
    }
  }
  if (!adminEmails.length) {
    Logger.log("Sin email de Admin en hoja Personal — saltado");
    return;
  }

  var subject = "[Medellín Concierge] " + pendientes.length + " aseo(s) sin asignar hoy";
  var body = "Tienes " + pendientes.length + " aseo(s) sin aseadora asignada para hoy:\n\n";
  for (var k = 0; k < pendientes.length; k++) {
    body += "• " + pendientes[k].propiedad + "  (" + pendientes[k].codigo + ", " + pendientes[k].checkout + ")\n";
  }
  body += "\nAbre la app para asignarlos:\n" +
          "https://smplymkgm.github.io/medellin-concierge-aseos/Index.html\n";

  MailApp.sendEmail({
    to: adminEmails.join(","),
    subject: subject,
    body: body,
    name: "Medellín Concierge",
  });
  Logger.log("Email admin enviado: " + pendientes.length + " pendientes");
}

function sameDayDate(a, b) {
  return a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// ============================================================
// ADMIN — moverAseo
// ============================================================

function handleMoverAseo(body) {
  var codigo     = String(body.codigo     || "").trim();
  var nuevaFecha = String(body.nuevaFecha || "").trim();

  if (!codigo || !nuevaFecha) return respond(false, null, "Codigo y nuevaFecha requeridos");
  if (!fechaADate(nuevaFecha)) return respond(false, null, "Fecha invalida (usar dd/MM/yyyy)");

  var ss   = getSS();
  var hoja = ss.getSheetByName(CONFIG.hojaAseos);
  if (!hoja || hoja.getLastRow() < 2) return respond(false, null, "Hoja no encontrada");

  var datos = hoja.getRange(2, 1, hoja.getLastRow()-1, 13).getValues();
  var encontrado = false;

  for (var i = 0; i < datos.length; i++) {
    if (String(datos[i][0]) !== codigo) continue;
    var fila = i + 2;
    hoja.getRange(fila, 5).setValue(nuevaFecha).setNumberFormat("@");
    encontrado = true;
    break;
  }

  if (!encontrado) return respond(false, null, "Aseo no encontrado");

  var master = ss.getSheetByName(CONFIG.hojaMaestra);
  if (master && master.getLastRow() >= 2) {
    var mc = master.getRange(2, 1, master.getLastRow()-1, 1).getValues();
    for (var j = 0; j < mc.length; j++) {
      if (String(mc[j][0]) === codigo) {
        master.getRange(j+2, 5).setValue(nuevaFecha).setNumberFormat("@");
        break;
      }
    }
  }

  return respond(true, null);
}

// ============================================================
// AGREGAR ASEO MANUAL
// ============================================================

function handleAgregarAseo(body) {
  var propiedad  = String(body.propiedad  || "").trim();
  var idProp     = String(body.idProp     || "").trim();
  var checkout   = String(body.checkout   || "").trim();
  var aseadora   = String(body.aseadora   || "").trim();
  var precio     = Number(body.precio)    || 0;
  var notas      = String(body.notas      || "").trim();
  var acceso     = String(body.acceso     || "").trim();

  if (!propiedad || !checkout) return respond(false, null, "Propiedad y fecha requeridas");
  if (!fechaADate(checkout))   return respond(false, null, "Fecha invalida (usar dd/MM/yyyy)");

  // Si vino sin idProp pero sí con propiedad, intentar inferir desde el
  // catálogo
  if (!idProp && propiedad) {
    var props = getPropiedades();
    for (var i = 0; i < props.length; i++) {
      if (props[i].nombre === propiedad) { idProp = props[i].id; break; }
    }
  }
  // Si no vino acceso, tomar el de la propiedad
  if (!acceso && idProp) {
    var ps = getPropiedades();
    for (var j = 0; j < ps.length; j++) {
      if (ps[j].id === idProp) { acceso = ps[j].acceso || ""; break; }
    }
  }

  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch(e) { return respond(false, null, "Sistema ocupado"); }
  try {
    var ss   = getSS();
    var hoja = ss.getSheetByName(CONFIG.hojaAseos);
    if (!hoja) return respond(false, null, "Hoja Aseos no encontrada");

    // Código único basado en timestamp + 2 chars random — sin colisión
    // ni dependencia del lastRow (que cambia con cada borrado/insert).
    var ts  = Date.now().toString(36).toUpperCase();
    var rnd = Math.floor(Math.random() * 1296).toString(36).toUpperCase().padStart(2, "0");
    var codigo = "MAN-" + ts + rnd;

    var fila = [
      codigo, idProp, propiedad,
      checkout, checkout, 0,
      aseadora, "Pendiente", precio,
      notas, acceso, "", ""
    ];
    hoja.appendRow(fila);

    var newRow = hoja.getLastRow();
    hoja.getRange(newRow, 4, 1, 2).setNumberFormat("@");      // fechas como texto
    hoja.getRange(newRow, 9, 1, 1).setNumberFormat("$#,##0"); // precio
    // Tinte amarillento para que se distinga visualmente de los aseos
    // que vinieron del iCal
    hoja.getRange(newRow, 1, 1, 13).setBackground("#fff9e6").setFontFamily("Arial").setFontSize(10);

    return respond(true, {
      codigo:    codigo,
      idProp:    idProp,
      propiedad: propiedad,
      checkin:   checkout,
      checkout:  checkout,
      noches:    0,
      asignada:  aseadora,
      estado:    "Pendiente",
      precio:    precio,
      notas:     notas,
      acceso:    acceso,
    });
  } finally {
    try { lock.releaseLock(); } catch(e) {}
  }
}

// ============================================================
// PROPIEDADES
// ============================================================

function getPropiedades() {
  var ss   = getSS();
  var hoja = ss.getSheetByName(CONFIG.hojaPropiedades);
  if (!hoja || hoja.getLastRow() < 2) return [];
  var lastCol = Math.max(hoja.getLastColumn(), 9);
  var datos = hoja.getRange(2, 1, hoja.getLastRow()-1, lastCol).getValues();
  var props = [];
  for (var i = 0; i < datos.length; i++) {
    var r = datos[i];
    var id  = String(r[0]).trim();
    var nom = String(r[1]).trim();
    var urlRaw = String(r[4] || "").trim();
    // Col E puede tener varios iCal separados por salto de línea, coma o ";"
    var urls = urlRaw.split(/[\n,;]+/).map(function(u){ return u.trim(); })
                     .filter(function(u){ return u.length > 0; });
    var url = urls[0] || "";
    if (!id || !nom) continue;
    // Col I (índice 8) = Activa (boolean). Vacío/TRUE = activa.
    // FALSE = archivada → no se devuelve.
    var activaRaw = r[8];
    var activa = !(activaRaw === false || activaRaw === "FALSE" || activaRaw === "false");
    if (!activa) continue;
    var accesoStructRaw = String(r[7] || "").trim();
    var accesoStruct = null;
    if (accesoStructRaw && accesoStructRaw.charAt(0) === "{") {
      try { accesoStruct = JSON.parse(accesoStructRaw); } catch(e) {}
    }
    props.push({
      id:                  id,
      nombre:              nom,
      precioAseo:          Number(r[2]) || 0,
      acceso:              String(r[3] || "").trim(),
      icalUrl:             url,
      icalUrls:            urls,
      empleadaAuto:        String(r[5] || "").trim(),
      folderId:            String(r[6] || "").trim(),
      accesoEstructurado:  accesoStruct,
    });
  }
  return props;
}

function handleGetPropiedades(body) {
  return respond(true, getPropiedades());
}

function handleAgregarPropiedad(body) {
  var datos = body.datos || {};
  var nombre    = String(datos.nombre    || "").trim();
  var acceso    = String(datos.acceso    || "").trim();
  // iCal: array (varias plataformas) o string legacy. Opcional: propiedades
  // de Booking u otras plataformas se manejan con reservas manuales.
  var icalLista = datos.icalUrls !== undefined
    ? (datos.icalUrls || []).map(function(u){ return String(u || "").trim(); }).filter(function(u){ return u.length > 0; })
    : (String(datos.icalUrl || "").trim() ? [String(datos.icalUrl).trim()] : []);
  var icalUrl   = icalLista.join("\n");
  var precioAseo = Number(datos.precioAseo) || 0;
  var empleadaAuto = String(datos.empleadaAuto || "").trim();

  if (!nombre) return respond(false, null, "Nombre requerido");

  var ss   = getSS();
  var hoja = ss.getSheetByName(CONFIG.hojaPropiedades);
  if (!hoja) return respond(false, null, "Hoja Propiedades no encontrada");

  var existentes = [];
  if (hoja.getLastRow() > 1) {
    existentes = hoja.getRange(2, 1, hoja.getLastRow()-1, 1).getValues().flat().map(String);
  }
  var nums = existentes.map(function(id){ return parseInt(id.replace("#","")) || 0; });
  var maxNum = nums.length ? Math.max.apply(null, nums) : 0;
  var nuevoId = "#" + String(maxNum + 1).padStart(4, "0");

  var folderId = "";
  try { folderId = crearCarpetaPropiedad(nombre); } catch(e) { Logger.log("Drive: " + e.message); }

  var nuevaFila = [nuevoId, nombre, precioAseo, acceso, icalUrl, empleadaAuto, folderId];
  var fi = hoja.getLastRow() + 1;
  hoja.getRange(fi, 1, 1, 7).setValues([nuevaFila]);
  hoja.getRange(fi, 3, 1, 1).setNumberFormat("$#,##0");
  hoja.getRange(fi, 1, 1, 7)
    .setBackground(fi % 2 === 0 ? "#f8f9fa" : "#ffffff")
    .setFontFamily("Arial").setFontSize(10);

  return respond(true, { id: nuevoId });
}

function handleEliminarPropiedad(body) {
  var id = String(body.id || "").trim();
  if (!id) return respond(false, null, "ID requerido");

  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch(e) { return respond(false, null, "Sistema ocupado"); }
  try {
    var ss = getSS();
    var hoja = ss.getSheetByName(CONFIG.hojaPropiedades);
    if (!hoja || hoja.getLastRow() < 2) return respond(false, null, "Hoja Propiedades no encontrada");

    // Asegurar col I "Activa"
    if (hoja.getLastColumn() < 9) {
      hoja.getRange(1, 9).setValue("Activa")
        .setBackground("#1a1a2e").setFontColor("#ffffff").setFontWeight("bold");
      hoja.setColumnWidth(9, 70);
      // Marcar todas las existentes como activas (TRUE) por default
      if (hoja.getLastRow() > 1) {
        var n = hoja.getLastRow() - 1;
        var trueArr = [];
        for (var k = 0; k < n; k++) trueArr.push([true]);
        hoja.getRange(2, 9, n, 1).setValues(trueArr);
      }
      hoja.getRange("I2:I500").setDataValidation(
        SpreadsheetApp.newDataValidation().requireCheckbox().build()
      );
    }

    var ids = hoja.getRange(2, 1, hoja.getLastRow() - 1, 1).getValues();
    for (var i = 0; i < ids.length; i++) {
      if (String(ids[i][0]).trim() === id) {
        hoja.getRange(i + 2, 9).setValue(false);
        hoja.getRange(i + 2, 1, 1, 9).setBackground("#fef0f0").setFontStyle("italic");
        return respond(true, { archivado: id });
      }
    }
    return respond(false, null, "Propiedad no encontrada: " + id);
  } finally {
    try { lock.releaseLock(); } catch(e) {}
  }
}

function handleActualizarPropiedad(body) {
  var id    = String(body.id || "").trim();
  var datos = body.datos || {};
  if (!id) return respond(false, null, "ID requerido");

  var ss   = getSS();
  var hoja = ss.getSheetByName(CONFIG.hojaPropiedades);
  if (!hoja || hoja.getLastRow() < 2) return respond(false, null, "Hoja no encontrada");

  // Asegurar columna H "Acceso estructurado"
  if (hoja.getLastColumn() < 8) {
    hoja.getRange(1, 8).setValue("Acceso Estructurado (JSON)")
      .setBackground("#1a1a2e").setFontColor("#ffffff").setFontWeight("bold");
    hoja.setColumnWidth(8, 280);
  }

  var existentes = hoja.getRange(2, 1, hoja.getLastRow()-1, 8).getValues();
  for (var i = 0; i < existentes.length; i++) {
    if (String(existentes[i][0]).trim() !== id) continue;
    var fila = i + 2;
    if (datos.nombre               !== undefined) hoja.getRange(fila, 2).setValue(datos.nombre);
    if (datos.precioAseo           !== undefined) hoja.getRange(fila, 3).setValue(Number(datos.precioAseo));
    if (datos.acceso               !== undefined) hoja.getRange(fila, 4).setValue(datos.acceso);
    // iCal: acepta icalUrls (array, varias plataformas) o icalUrl (string legacy)
    if (datos.icalUrls             !== undefined) {
      var lista = (datos.icalUrls || []).map(function(u){ return String(u || "").trim(); })
                    .filter(function(u){ return u.length > 0; });
      hoja.getRange(fila, 5).setValue(lista.join("\n"));
    } else if (datos.icalUrl       !== undefined) {
      hoja.getRange(fila, 5).setValue(datos.icalUrl);
    }
    if (datos.empleadaAuto         !== undefined) hoja.getRange(fila, 6).setValue(datos.empleadaAuto);
    if (datos.accesoEstructurado   !== undefined) {
      var val = datos.accesoEstructurado;
      if (val && typeof val === "object") val = JSON.stringify(val);
      hoja.getRange(fila, 8).setValue(String(val || ""));
    }
    return respond(true, null);
  }
  return respond(false, null, "Propiedad no encontrada: " + id);
}

// ============================================================
// PERSONAL
// ============================================================

function handleGetPersonal(body) {
  var personal = getPersonal();
  var ss   = getSS();
  var hoja = ss.getSheetByName(CONFIG.hojaAseos);
  var ganancias = {};

  if (hoja && hoja.getLastRow() >= 2) {
    var datos = hoja.getRange(2, 1, hoja.getLastRow()-1, 9).getValues();
    for (var i = 0; i < datos.length; i++) {
      var nombre = String(datos[i][6] || "").trim();
      var estado = String(datos[i][7] || "");
      var precio = Number(datos[i][8]) || 0;
      if (!nombre) continue;
      if (!ganancias[nombre]) ganancias[nombre] = 0;
      if (estado === "Completado") ganancias[nombre] += precio;
    }
  }

  var result = personal.map(function(p) {
    return {
      nombre:     p.nombre,
      email:      p.email,
      formulario: p.formulario,
      carpeta:    p.carpeta,
      telefono:   p.telefono,
      gananciaTotal: ganancias[p.nombre] || 0,
    };
  });
  return respond(true, result);
}

function handleActualizarPersonal(body) {
  var nombre = String(body.nombre || "").trim();
  var datos  = body.datos || {};
  if (!nombre) return respond(false, null, "Nombre requerido");

  var ss   = getSS();
  var hoja = ss.getSheetByName(CONFIG.hojaPersonal);
  if (!hoja || hoja.getLastRow() < 2) return respond(false, null, "Hoja no encontrada");

  // Asegurar encabezados de facturación (cols H-L) una sola vez
  if (hoja.getLastColumn() < 12) {
    hoja.getRange(1, 8, 1, 5)
      .setValues([["Cédula", "Banco", "Tipo Cuenta", "Número Cuenta", "Nombre Completo"]])
      .setBackground("#1a1a2e").setFontColor("#ffffff").setFontWeight("bold");
  }

  var existentes = hoja.getRange(2, 1, hoja.getLastRow()-1, 7).getValues();
  for (var i = 0; i < existentes.length; i++) {
    if (String(existentes[i][1]).trim().toLowerCase() !== nombre.toLowerCase()) continue;
    var fila = i + 2;
    if (datos.pin       !== undefined) hoja.getRange(fila, 3).setValue(String(datos.pin)).setNumberFormat("@");
    if (datos.email     !== undefined) hoja.getRange(fila, 4).setValue(datos.email);
    if (datos.carpeta   !== undefined) hoja.getRange(fila, 6).setValue(datos.carpeta);
    if (datos.telefono  !== undefined) hoja.getRange(fila, 7).setValue(datos.telefono);
    if (datos.formulario !== undefined) hoja.getRange(fila, 5).setValue(datos.formulario);
    // Datos de facturación (cuenta de cobro)
    if (datos.cedula       !== undefined) hoja.getRange(fila, 8).setValue(String(datos.cedula)).setNumberFormat("@");
    if (datos.banco        !== undefined) hoja.getRange(fila, 9).setValue(datos.banco);
    if (datos.tipoCuenta   !== undefined) hoja.getRange(fila, 10).setValue(datos.tipoCuenta);
    if (datos.numeroCuenta !== undefined) hoja.getRange(fila, 11).setValue(String(datos.numeroCuenta)).setNumberFormat("@");
    if (datos.nombreCompleto !== undefined) hoja.getRange(fila, 12).setValue(datos.nombreCompleto);
    return respond(true, null);
  }
  return respond(false, null, "Empleada no encontrada: " + nombre);
}

// ============================================================
// VIDEOS — getUploadUrl
// ============================================================

function handleGetUploadUrl(body) {
  var codigo    = String(body.codigo    || "").trim();
  var propiedad = String(body.propiedad || "").trim();
  var filename  = String(body.filename  || "video.mp4").trim();

  var props    = getPropiedades();
  var folderId = "";
  for (var i = 0; i < props.length; i++) {
    if (props[i].nombre === propiedad || props[i].id === propiedad) {
      folderId = props[i].folderId; break;
    }
  }

  if (!folderId) {
    try {
      folderId = crearCarpetaPropiedad(propiedad);
      actualizarFolderIdPropiedad(propiedad, folderId);
    } catch(e) {
      return respond(false, null, "No se pudo crear carpeta Drive: " + e.message);
    }
  } else {
    // Si el folder existe pero su nombre no coincide con el nombre actual
    // de la propiedad (caso: el admin renombró la propiedad después de
    // crear el folder), renombrar el folder para que matchee.
    try {
      var folder = DriveApp.getFolderById(folderId);
      if (folder.getName() !== propiedad) folder.setName(propiedad);
    } catch(e) { Logger.log("Folder rename skipped: " + e.message); }
  }

  try {
    var token = ScriptApp.getOAuthToken();
    var fecha = hoyStr().replace(/\//g, "-");
    var ext = (filename.match(/\.([a-zA-Z0-9]+)$/) || [, "mp4"])[1];
    var safeAseadora = String(body.aseadora || "").replace(/[^A-Za-z0-9]/g, "");
    var baseNombre = fecha + "_" + codigo + (safeAseadora ? "_" + safeAseadora : "") + "_video";
    var nombreArchivo = baseNombre + "." + ext;

    // Si ya existe un archivo con ese nombre en la carpeta, suffix -2, -3…
    try {
      var fld = DriveApp.getFolderById(folderId);
      var n = 1;
      while (fld.getFilesByName(nombreArchivo).hasNext()) {
        n++;
        nombreArchivo = baseNombre + "-" + n + "." + ext;
        if (n > 50) break; // safety
      }
    } catch(e) {}

    var metadata = { name: nombreArchivo, parents: [folderId] };

    var response = UrlFetchApp.fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable",
      {
        method: "post",
        headers: {
          "Authorization": "Bearer " + token,
          "Content-Type": "application/json; charset=UTF-8",
          "X-Upload-Content-Type": "video/mp4",
        },
        payload: JSON.stringify(metadata),
        muteHttpExceptions: true,
      }
    );

    var uploadUrl = response.getHeaders()["Location"] || response.getHeaders()["location"];
    if (!uploadUrl) {
      return respond(false, null, "No se obtuvo URL de upload (respuesta: " + response.getContentText() + ")");
    }

    return respond(true, { uploadUrl: uploadUrl, folderId: folderId, filename: nombreArchivo });
  } catch(e) {
    return respond(false, null, e.message);
  }
}

// ============================================================
// VIDEOS — registrarVideo (despues del upload)
// ============================================================

// Actualiza la celda Video (col 37) en hoja Aseos para el aseo con
// ese código, dejándola como =HYPERLINK clickeable. Idempotente.
function actualizarVideoEnAseo(codigo, videoLink) {
  if (!codigo || !videoLink) return false;
  var hoja = getSS().getSheetByName(CONFIG.hojaAseos);
  if (!hoja || hoja.getLastRow() < 2 || hoja.getLastColumn() < 37) return false;
  var codigos = hoja.getRange(2, 1, hoja.getLastRow() - 1, 1).getValues();
  for (var i = 0; i < codigos.length; i++) {
    if (String(codigos[i][0]) === codigo) {
      hoja.getRange(i + 2, 37).setValue(buildHyperlink(videoLink, "Ver video"));
      return true;
    }
  }
  return false;
}

function handleRegistrarVideo(body) {
  var codigo    = String(body.codigo    || "").trim();
  var propiedad = String(body.propiedad || "").trim();
  var aseadora  = String(body.aseadora  || "").trim();
  var checkout  = String(body.checkout  || "").trim();
  var fileId    = String(body.fileId    || "").trim();
  var filename  = String(body.filename  || "").trim();
  var notas     = String(body.notas     || "").trim();

  // Si el frontend no obtuvo fileId (caso Safari + CORS), buscamos el
  // archivo por filename dentro de la carpeta de la propiedad. Esto
  // recupera el link cuando el response del upload fue bloqueado.
  if (!fileId && filename && propiedad) {
    try {
      var props = getPropiedades();
      var folderId = "";
      for (var i = 0; i < props.length; i++) {
        if (props[i].nombre === propiedad || props[i].id === propiedad) {
          folderId = props[i].folderId; break;
        }
      }
      if (folderId) {
        var folder = DriveApp.getFolderById(folderId);
        var files = folder.getFilesByName(filename);
        if (files.hasNext()) fileId = files.next().getId();
      }
    } catch(e) { Logger.log("findByName: " + e.message); }
  }

  // Asegurar que el archivo quede compartido con anyone-with-link
  if (fileId) {
    try { compartirAnyoneViewer(DriveApp.getFileById(fileId)); } catch(e) {}
  }

  var videoLink = fileId
    ? "https://drive.google.com/file/d/" + fileId + "/view"
    : (String(body.videoLink || "").trim() || filename);

  registrarVideoEnHoja({ codigo: codigo, propiedad: propiedad, aseadora: aseadora, checkout: checkout, videoLink: videoLink, notas: notas });

  // También parchea col 37 de "Todos los Aseos" para que el video del
  // aseo principal quede como HYPERLINK clickeable. Esto cubre el caso
  // Safari + CORS donde completarAseo no tenía el fileId al momento de
  // escribir.
  try { actualizarVideoEnAseo(codigo, videoLink); } catch(e) { Logger.log("actualizarVideoEnAseo: " + e.message); }

  return respond(true, { fileId: fileId, link: videoLink });
}

function registrarVideoEnHoja(data) {
  var ss   = getSS();
  var hoja = ss.getSheetByName(CONFIG.hojaVideos);
  if (!hoja) {
    hoja = ss.insertSheet(CONFIG.hojaVideos);
    var enc = ["Codigo Aseo","Propiedad","Aseadora","Checkout","Link Video","Notas","Registrado"];
    hoja.getRange(1,1,1,enc.length).setValues([enc])
      .setBackground("#1a1a2e").setFontColor("#ffffff").setFontWeight("bold").setFontFamily("Arial");
    hoja.setFrozenRows(1);
  }
  var ahora = Utilities.formatDate(new Date(), "America/Bogota", "dd/MM/yyyy HH:mm");
  var linkCell = buildHyperlink(data.videoLink, "Ver video · " + (data.codigo || ""));
  hoja.appendRow([data.codigo, data.propiedad, data.aseadora, data.checkout, linkCell, data.notas, ahora]);
}

// ============================================================
// HUBSPOT
// ============================================================

function notificarHubspot(aseo, aseadora) {
  var apiKey = PropertiesService.getScriptProperties().getProperty("HUBSPOT_API_KEY");
  if (!apiKey) return;
  var payload = {
    properties: {
      subject: "Aseo asignado: " + aseo.propiedad,
      hs_note_body: "Aseadora: " + aseadora + " | Checkout: " + aseo.checkout + " | Codigo: " + aseo.codigo,
    }
  };
  try {
    UrlFetchApp.fetch("https://api.hubapi.com/crm/v3/objects/notes", {
      method: "post",
      headers: {
        Authorization: "Bearer " + apiKey,
        "Content-Type": "application/json",
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    });
  } catch(e) {
    Logger.log("HubSpot error: " + e.message);
  }
}

// ============================================================
// DRIVE — helpers
// ============================================================

// Compartir un folder/file con cualquier persona que tenga el link
// (modo viewer). Idempotente: si ya está compartido así, no hace nada.
function compartirAnyoneViewer(item) {
  try {
    item.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch(e) {
    Logger.log("compartirAnyoneViewer fallo en " + (item.getName ? item.getName() : "?") + ": " + e.message);
  }
}

function getCarpetaRaiz() {
  var folders = DriveApp.getFoldersByName(CONFIG.carpetaRaiz);
  if (folders.hasNext()) {
    var f = folders.next();
    compartirAnyoneViewer(f); // best-effort, idempotente
    return f;
  }
  var nuevo = DriveApp.createFolder(CONFIG.carpetaRaiz);
  compartirAnyoneViewer(nuevo);
  return nuevo;
}

function crearCarpetaPropiedad(nombrePropiedad) {
  var raiz = getCarpetaRaiz();
  var existing = raiz.getFoldersByName(nombrePropiedad);
  if (existing.hasNext()) {
    var ef = existing.next();
    compartirAnyoneViewer(ef);
    return ef.getId();
  }
  var nf = raiz.createFolder(nombrePropiedad);
  compartirAnyoneViewer(nf);
  return nf.getId();
}

function actualizarFolderIdPropiedad(nombrePropiedad, folderId) {
  var ss   = getSS();
  var hoja = ss.getSheetByName(CONFIG.hojaPropiedades);
  if (!hoja || hoja.getLastRow() < 2) return;
  var datos = hoja.getRange(2, 1, hoja.getLastRow()-1, 2).getValues();
  for (var i = 0; i < datos.length; i++) {
    if (String(datos[i][1]).trim() === nombrePropiedad) {
      hoja.getRange(i+2, 7).setValue(folderId);
      return;
    }
  }
}

// ============================================================
// FORMULARIO — respuestas del Google Form
// ============================================================

// ============================================================
// AUTO-COMPLETAR ASEOS PASADOS (trigger 10PM)
// ============================================================

function autoCompletarAseosPasados() {
  var ss   = getSS();
  var hoja = ss.getSheetByName(CONFIG.hojaAseos);
  if (!hoja || hoja.getLastRow() < 2) return;

  var hoy   = new Date(); hoy.setHours(0,0,0,0);
  var datos = hoja.getRange(2, 1, hoja.getLastRow()-1, 13).getValues();
  var disp  = hoja.getRange(2, 4, hoja.getLastRow()-1, 2).getDisplayValues();
  var ahora = Utilities.formatDate(new Date(), "America/Bogota", "dd/MM/yyyy HH:mm");

  var count = 0;
  for (var i = 0; i < datos.length; i++) {
    var estado = String(datos[i][7]);
    if (estado === "Completado" || estado === "Cancelado") continue;
    if (!String(datos[i][6])) continue;

    var checkoutStr = disp[i][1] || fechaToStr(datos[i][4]);
    var checkout    = fechaADate(checkoutStr);
    if (!checkout || checkout >= hoy) continue;

    var fila   = i + 2;
    var codigo = String(datos[i][0]);
    hoja.getRange(fila, 8).setValue("Completado");
    hoja.getRange(fila, 13).setValue(ahora + " (auto)");
    hoja.getRange(fila, 1, 1, 13).setBackground("#e8f5e9");

    var master = ss.getSheetByName(CONFIG.hojaMaestra);
    if (master && master.getLastRow() >= 2) {
      var mc = master.getRange(2, 1, master.getLastRow()-1, 1).getValues();
      for (var j = 0; j < mc.length; j++) {
        if (String(mc[j][0]) === codigo) {
          master.getRange(j+2, 7).setValue("Finalizado");
          master.getRange(j+2, 1, 1, 13).setBackground("#e8f5e9");
          break;
        }
      }
    }
    count++;
  }
  Logger.log("autoCompletarAseosPasados: " + count + " aseos marcados.");
}

// ============================================================
// onEdit — normalizar estado + aplicar color de fila en Todos los Aseos
// ============================================================
// Trigger simple: se activa cuando el owner edita manualmente col H (Estado).
// 1. Normaliza "Cancelada" → "Cancelado" (el master sheet usa femenino).
// 2. Aplica background según estado para que la fila cambie de color.
function onEdit(e) {
  if (!e) return;
  var sheet = e.range.getSheet();
  if (sheet.getName() !== CONFIG.hojaAseos) return;
  var col = e.range.getColumn();
  var row = e.range.getRow();
  if (row < 2 || col !== 8) return; // col 8 = Estado
  var val = String(e.value || "").trim();
  // Normalizar femenino → masculino
  if (val === "Cancelada") {
    e.range.setValue("Cancelado");
    val = "Cancelado";
  }
  var lastCol = Math.max(sheet.getLastColumn(), 13);
  var bg = val === "Cancelado"  ? "#fff3f3"
         : val === "Completado" ? "#e8f5e9"
         : "#ffffff";
  sheet.getRange(row, 1, 1, lastCol).setBackground(bg);
}

// One-shot: normaliza todas las filas de Todos los Aseos que tengan "Cancelada"
// y aplica background. Correr desde menú → Setup (avanzado).
function normalizarEstadosCancelados() {
  var ss   = getSS();
  var hoja = ss.getSheetByName(CONFIG.hojaAseos);
  if (!hoja || hoja.getLastRow() < 2) return;
  var lr   = hoja.getLastRow() - 1;
  var vals = hoja.getRange(2, 8, lr, 1).getValues();
  var fixed = 0;
  for (var i = 0; i < vals.length; i++) {
    var v = String(vals[i][0] || "").trim();
    if (v === "Cancelada") {
      hoja.getRange(i + 2, 8).setValue("Cancelado");
      hoja.getRange(i + 2, 1, 1, Math.max(hoja.getLastColumn(), 13)).setBackground("#fff3f3");
      fixed++;
    } else if (v === "Cancelado") {
      // Ya correcto — solo aplicar color si falta
      hoja.getRange(i + 2, 1, 1, Math.max(hoja.getLastColumn(), 13)).setBackground("#fff3f3");
      fixed++;
    }
  }
  ss.toast(fixed + " filas normalizadas/coloreadas", "Cancelados", 4);
}

// ============================================================
// MENU
// ============================================================

function onOpen() {
  var ui = SpreadsheetApp.getUi();

  // Submenú de setup/migraciones one-shot. Ya corrieron casi todas;
  // se queda accesible pero fuera del flujo diario.
  var setupMenu = ui.createMenu("Setup (avanzado)")
    .addItem("Crear triggers automáticos",                   "crearTriggersAutomaticos")
    .addItem("Agregar Admin a Personal",                     "agregarAdmin")
    .addItem("Limpiar hojas duplicadas con emojis",          "limpiarHojasDuplicadas")
    .addSeparator()
    .addItem("Migrar form viejo (JSON → columnas)",          "migrarFormJsonAColumnas")
    .addItem("Convertir links de video a HYPERLINK",         "convertirVideosAHyperlink")
    .addItem("Recuperar links de videos huérfanos",          "recuperarLinksVideos")
    .addItem("Normalizar estados Cancelado + color rojo",    "normalizarEstadosCancelados")
    .addItem("Eliminar aseos duplicados",                    "eliminarAseosDuplicados")
    .addItem("Actualizar precios de propiedades",            "actualizarPreciosPropiedades");

  ui.createMenu("Medellin Concierge")
    .addItem("Sincronizar Airbnb",                           "sincronizarCalendarios")
    .addItem("Sincronizar Google Calendar",                  "sincronizarGoogleCalendar")
    .addSeparator()
    .addItem("Ordenar hoja Aseos por fecha",                 "ordenarHojaAseosPorFecha")
    .addItem("Activar/refrescar filtro por mes",             "crearFiltroAseos")
    .addItem("Resincronizar precios de aseos",               "resincronizarPreciosAseos")
    .addSeparator()
    .addItem("Compartir todos los videos en Drive",          "compartirTodosLosVideos")
    .addSeparator()
    .addItem("Self-test (diagnóstico)",                      "runSelfTest")
    .addSubMenu(setupMenu)
    .addToUi();
}

// ============================================================
// ORDENAR HOJA ASEOS por fecha de Check-out
// ============================================================
// Las fechas viven como texto dd/MM/yyyy (col 5). Sort nativo de Sheets
// las ordenaría alfabéticamente (mal). Esta función las convierte a
// orden cronológico real y reescribe la hoja en orden.

function ordenarHojaAseosPorFecha() {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(15000); } catch(e) {
    SpreadsheetApp.getActiveSpreadsheet().toast("Otro proceso en ejecución, intenta de nuevo", "Ordenar", 5);
    return;
  }
  try {
    var ss = getSS();
    var hoja = ss.getSheetByName(CONFIG.hojaAseos);
    if (!hoja || hoja.getLastRow() < 2) {
      ss.toast("Hoja Aseos vacía o no existe", "Ordenar", 4);
      return;
    }
    var lastCol = Math.max(hoja.getLastColumn(), 13);
    var datos = hoja.getRange(2, 1, hoja.getLastRow() - 1, lastCol).getValues();
    var disp  = hoja.getRange(2, 4, hoja.getLastRow() - 1, 2).getDisplayValues();

    // Construir array con clave de ordenamiento = checkout como Date
    var indexed = datos.map(function(row, i) {
      var checkoutStr = disp[i][1] || fechaToStr(row[4]);
      var d = fechaADate(checkoutStr);
      return {
        row: row,
        ts: d ? d.getTime() : 0,    // 0 = al inicio para los sin fecha
      };
    });

    indexed.sort(function(a, b) { return a.ts - b.ts; });
    var sorted = indexed.map(function(x) { return x.row; });

    // Reescritura en un solo setValues — preserva formatos de columna
    hoja.getRange(2, 1, sorted.length, lastCol).setValues(sorted);
    hoja.getRange(2, 4, sorted.length, 2).setNumberFormat("@");
    hoja.getRange(2, 9, sorted.length, 1).setNumberFormat("$#,##0");

    ss.toast("Ordenado " + sorted.length + " filas por Check-out", "Ordenar", 5);
  } finally {
    try { lock.releaseLock(); } catch(e) {}
  }
}

// ============================================================
// FILTRO en hoja Aseos — permite filtrar por mes desde el UI de Sheets
// ============================================================
// Crea una columna oculta "Mes" calculada con la fórmula del checkout,
// luego activa createFilter() sobre toda la tabla incluida esa columna.
// El usuario puede clickear el embudo de "Mes" y elegir uno o varios.

function crearFiltroAseos() {
  var ss = getSS();
  var hoja = ss.getSheetByName(CONFIG.hojaAseos);
  if (!hoja || hoja.getLastRow() < 2) {
    ss.toast("Hoja Aseos vacía o no existe", "Filtro", 4);
    return;
  }

  // Asegurar que las cols del form existan (puede que alguien corra esto
  // antes de que se haya completado un aseo)
  ensureAseosFormColumns(hoja);

  // Limpieza: si una corrida vieja dejó la columna "Mes (Check-out)"
  // en medio del esquema (cuando el form solo ocupaba hasta col 20),
  // borrarla antes de crear la nueva al final.
  var lastCol = hoja.getLastColumn();
  var headersAll = hoja.getRange(1, 1, 1, lastCol).getValues()[0];
  for (var c = lastCol; c >= 1; c--) {
    var h = String(headersAll[c - 1]);
    if (/^Mes \(Check-out\)/i.test(h)) hoja.deleteColumn(c);
  }
  // Quitar filtro anterior si existe
  var existing = hoja.getFilter();
  if (existing) existing.remove();

  lastCol = hoja.getLastColumn();
  var lastRow = hoja.getLastRow();

  // Columna "Mes (Check-out)" al final, con fórmula que parsea dd/MM/yyyy
  var mesColIdx = lastCol + 1;
  hoja.getRange(1, mesColIdx).setValue("Mes (Check-out)")
    .setBackground("#1a1a2e").setFontColor("#ffffff")
    .setFontWeight("bold").setFontSize(11).setFontFamily("Arial");

  // Fórmula por celda: extrae yyyy-mm y agrega nombre del mes
  // Ejemplo entrada: 03/06/2026  →  salida: 2026-06 Junio
  var formulas = [];
  var fechas = hoja.getRange(2, 5, lastRow - 1, 1).getDisplayValues();
  for (var i = 0; i < fechas.length; i++) {
    var f = String(fechas[i][0]).trim();
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(f)) {
      var p = f.split("/");
      var mesIdx = parseInt(p[1]) - 1;
      var mesNom = (mesIdx >= 0 && mesIdx <= 11) ? CONFIG.meses[mesIdx] : "";
      formulas.push([p[2] + "-" + p[1] + " " + mesNom]);
    } else {
      formulas.push([""]);
    }
  }
  hoja.getRange(2, mesColIdx, formulas.length, 1).setValues(formulas);
  hoja.setColumnWidth(mesColIdx, 140);

  // Crear filtro nuevo cubriendo cabecera + datos + columna Mes
  var range = hoja.getRange(1, 1, lastRow, mesColIdx);
  range.createFilter();

  ss.toast("Filtro activado · click en el embudo de 'Mes' para filtrar", "Filtro", 6);
}

// ============================================================
// LIMPIAR HOJAS DUPLICADAS CON EMOJIS/PREFIJOS CORRUPTOS
// ============================================================
// Si existe una hoja "📋 Todas las Reservas" (o variante corrupta tipo
// "üìã Todas las Reservas") Y existe la versión limpia "Todas las Reservas",
// elimina la prefijada. Si NO existe la versión limpia, renombra la prefijada
// para quitarle los caracteres no-ASCII del inicio.

function limpiarHojasDuplicadas() {
  var ss = getSS();
  var sheets = ss.getSheets();
  var byCleanName = {};

  // Indexar nombres limpios existentes
  for (var i = 0; i < sheets.length; i++) {
    var nm = sheets[i].getName();
    var clean = nm.replace(/^[^A-Za-z0-9]+/, "").trim();
    if (nm === clean) byCleanName[clean] = sheets[i];
  }

  var eliminadas = 0;
  var renombradas = 0;
  var skipped = [];

  for (var j = 0; j < sheets.length; j++) {
    var sh = sheets[j];
    var name = sh.getName();
    var cleanName = name.replace(/^[^A-Za-z0-9]+/, "").trim();
    if (name === cleanName) continue; // ya está limpio

    if (byCleanName[cleanName] && byCleanName[cleanName].getSheetId() !== sh.getSheetId()) {
      // Existe versión limpia — eliminar la prefijada
      try {
        ss.deleteSheet(sh);
        eliminadas++;
        Logger.log("Eliminada (duplicada): " + name);
      } catch(e) {
        skipped.push(name + " (no se pudo eliminar: " + e.message + ")");
      }
    } else {
      // No hay versión limpia — renombrar
      try {
        sh.setName(cleanName);
        renombradas++;
        Logger.log("Renombrada: " + name + " -> " + cleanName);
      } catch(e) {
        skipped.push(name + " (no se pudo renombrar: " + e.message + ")");
      }
    }
  }

  var msg = "Listo. " + eliminadas + " eliminadas, " + renombradas + " renombradas.";
  if (skipped.length) msg += " Skipped: " + skipped.join(", ");
  ss.toast(msg, "Limpieza", 8);
  Logger.log(msg);
}

// ============================================================
// SETUP — agregar Admin a hoja Personal (correr UNA vez)
// ============================================================

function agregarAdmin() {
  var ss   = getSS();
  var hoja = ss.getSheetByName(CONFIG.hojaPersonal);
  if (!hoja) { Logger.log("Hoja Personal no existe"); return; }

  if (hoja.getLastRow() > 1) {
    var nombres = hoja.getRange(2, 2, hoja.getLastRow()-1, 1).getValues().flat().map(String);
    if (nombres.some(function(n){ return n.toLowerCase() === "admin"; })) {
      getSS().toast("Admin ya existe en Personal.", "Setup", 4);
      return;
    }
  }

  var fi = hoja.getLastRow() + 1;
  hoja.getRange(fi, 1, 1, 7).setValues([[true, "Admin", "2025", "michaelmgm1249@gmail.com", "", "", ""]]);
  hoja.getRange(fi, 3, 1, 1).setNumberFormat("@");
  hoja.getRange(fi, 1, 1, 7).setBackground("#fff9e6").setFontFamily("Arial").setFontSize(10);
  getSS().toast("Admin agregado a Personal (PIN: 2025).", "Setup", 5);
}

function crearTriggersAutomaticos() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var t = 0; t < triggers.length; t++) ScriptApp.deleteTrigger(triggers[t]);
  ScriptApp.newTrigger("sincronizarCalendarios").timeBased().everyHours(6).create();
  ScriptApp.newTrigger("sincronizarGoogleCalendar").timeBased().everyHours(2).create();
  ScriptApp.newTrigger("autoCompletarAseosPasados").timeBased().atHour(22).everyDays(1).create();
  ScriptApp.newTrigger("notificarAdminAsignacionesPendientes").timeBased().atHour(7).everyDays(1).create();
  ScriptApp.newTrigger("recuperarLinksVideos").timeBased().atHour(3).everyDays(1).create();
  getSS().toast("Triggers creados (Airbnb 6h · Calendar 2h · Auto-completar 10PM · Admin pendientes 7AM · Video links 3AM)", "Triggers", 6);
}


// ============================================================
// API — getAllAseos + getAseosPorAseadora
// ============================================================

function getAllAseos() {
  var ss = getSS();
  var hoja = ss.getSheetByName(CONFIG.hojaAseos);
  if (!hoja || hoja.getLastRow() < 2) return [];
  var lastRow = hoja.getLastRow();
  // Leer hasta col 15 (Salida) si existen, para devolver formFilled
  var lastCol = hoja.getLastColumn();
  var maxCol = Math.min(lastCol, 15);
  var datos = hoja.getRange(2, 1, lastRow - 1, maxCol).getValues();
  var disp  = hoja.getRange(2, 4, lastRow - 1, 2).getDisplayValues();
  var seen   = {};
  var result = [];
  for (var i = 0; i < datos.length; i++) {
    var r = datos[i];
    var cod = String(r[0]).trim();
    if (!cod) continue;
    // Excluir cancelados — no tienen utilidad operativa en la app
    var estado = String(r[7] || "").trim();
    if (estado === "Cancelado") continue;
    // Deduplicar por código. Si hay colisión, gana la fila "más completa":
    // Completado > tiene formulario > Pendiente.
    var entrada = maxCol >= 14 ? String(r[13] || "").trim() : "";
    var salida  = maxCol >= 15 ? String(r[14] || "").trim() : "";
    var obj = {
      codigo:    cod,
      idProp:    String(r[1]).trim(),
      propiedad: String(r[2]).trim(),
      checkin:   disp[i][0] || fechaToStr(r[3]),
      checkout:  disp[i][1] || fechaToStr(r[4]),
      noches:    Number(r[5]) || 0,
      asignada:  String(r[6] || ""),
      estado:    estado,
      precio:    Number(r[8]) || 0,
      notas:     String(r[9] || ""),
      acceso:    String(r[10] || ""),
      entrada:   entrada,
      salida:    salida,
      formFilled: !!(entrada || salida),
    };
    // Dedup por IDENTIDAD DEL ASEO = propiedad + día de salida (checkout).
    // Una propiedad solo se asea una vez por día de checkout. Esto colapsa
    // los duplicados aunque el iCal les haya dado códigos distintos (que es
    // la causa real de la multiplicación). Gana la fila más completa:
    // Completado > con formulario > manual > asignada.
    var dedupKey = (obj.idProp || obj.propiedad) + "|" + obj.checkout;
    if (seen[dedupKey] !== undefined) {
      var prev = result[seen[dedupKey]];
      if (_scoreAseo(obj) >= _scoreAseo(prev)) result[seen[dedupKey]] = obj;
    } else {
      seen[dedupKey] = result.length;
      result.push(obj);
    }
  }
  return result;
}

// Puntaje para decidir qué fila duplicada conservar (mayor = mejor)
function _scoreAseo(a) {
  var s = 0;
  if (a.estado === "Completado") s += 100;
  if (a.formFilled)              s += 10;
  // Preferir reservas manuales (Booking/otras plataformas) sobre fantasmas iCal
  if (String(a.codigo || "").indexOf("MAN") === 0) s += 5;
  if (a.asignada)                s += 1;
  // Desempate fino: a igualdad, gana el de mayor precio (el correcto del
  // catálogo; los fantasmas suelen traer precios viejos/menores).
  s += (Number(a.precio) || 0) / 1e9;
  return s;
}

function getAseosPorAseadora(nombre) {
  return getAllAseos().filter(function(a) { return a.asignada === nombre; });
}

// ============================================================
// ELIMINAR ASEOS DUPLICADOS de la hoja "Todos los Aseos"
// Borra duplicados verdaderos: misma propiedad + mismo día de salida
// (checkout). Una propiedad solo se asea una vez por día de checkout, así
// que filas con esa misma identidad son el mismo aseo multiplicado por
// códigos iCal inestables. Conserva la fila más completa:
// Completado > con formulario > manual (Booking) > asignada.
// One-shot, seguro.
// ============================================================

function eliminarAseosDuplicados() {
  var ss   = getSS();
  var hoja = ss.getSheetByName(CONFIG.hojaAseos);
  var ui   = SpreadsheetApp.getUi();
  if (!hoja || hoja.getLastRow() < 2) {
    ui.alert("Hoja Aseos vacía.");
    return;
  }

  var lastRow = hoja.getLastRow();
  var lastCol = hoja.getLastColumn();
  var maxCol  = Math.min(lastCol, 15);
  var datos   = hoja.getRange(2, 1, lastRow - 1, maxCol).getValues();
  var disp    = hoja.getRange(2, 4, lastRow - 1, 2).getDisplayValues(); // checkin/checkout

  // Clave de duplicado: propiedad + día de salida (checkout).
  var mejorPorKey = {};   // key -> { fila, score }
  var aBorrar     = {};   // fila -> true (set, evita borrar dos veces)

  function score(r) {
    var s = 0;
    if (String(r[7] || "").trim() === "Completado") s += 100;
    var entrada = maxCol >= 14 ? String(r[13] || "").trim() : "";
    var salida  = maxCol >= 15 ? String(r[14] || "").trim() : "";
    if (entrada || salida) s += 10;
    if (String(r[0] || "").trim().indexOf("MAN") === 0) s += 5; // manual (Booking)
    if (String(r[6] || "").trim()) s += 1;
    s += (Number(r[8]) || 0) / 1e9; // desempate: gana mayor precio
    return s;
  }

  function procesar(key, fila, sc) {
    if (mejorPorKey[key] === undefined) {
      mejorPorKey[key] = { fila: fila, score: sc };
    } else {
      // Hay duplicado: conservar el de mayor score, marcar el otro para borrar
      if (sc > mejorPorKey[key].score) {
        aBorrar[mejorPorKey[key].fila] = true;
        mejorPorKey[key] = { fila: fila, score: sc };
      } else {
        aBorrar[fila] = true;
      }
    }
  }

  for (var i = 0; i < datos.length; i++) {
    var r   = datos[i];
    var cod = String(r[0]).trim();
    var fila = i + 2;
    if (!cod) continue;
    var idProp    = String(r[1] || "").trim();
    var propiedad = String(r[2] || "").trim();
    var checkout  = disp[i][1] || fechaToStr(r[4]);
    var sc  = score(r);
    // Identidad del aseo: propiedad + día de salida (checkout)
    procesar((idProp || propiedad) + "|" + checkout, fila, sc);
  }

  var filas = Object.keys(aBorrar).map(Number);
  if (filas.length === 0) {
    ui.alert("✅ No se encontraron aseos duplicados.");
    return;
  }

  // Borrar de abajo hacia arriba para no desplazar índices
  filas.sort(function(a, b) { return b - a; });
  for (var k = 0; k < filas.length; k++) {
    hoja.deleteRow(filas[k]);
  }

  ui.alert("✅ " + filas.length + " fila(s) duplicada(s) eliminada(s).\n\n" +
           "Se conservó la versión más completa de cada aseo (completado / con formulario).");
}

// ============================================================
// ACTUALIZAR PRECIOS DE PROPIEDADES (one-shot idempotente)
// ============================================================

function actualizarPreciosPropiedades() {
  var PRECIOS = {
    "#0001": 90000,
    "#0002": 130000,
    "#0010": 90000,
    "#0065": 80000,
    "#0066": 90000,
    "#0078": 90000,
    "#0082": 120000,
    "#0083": 90000,
    "#0084": 90000,
    "#0085": 70000,
    "#0086": 90000,
    "#0087": 100000,
    "#0088": 60000,
    "#0089": 150000,
    "#0091": 70000,
    "#0092": 90000,
    "#0093": 60000,
    "#0094": 60000,
    "#0095": 60000,
    "#0096": 50000,
    "#0097": 50000,
    "#0101": 120000,
    "#0104": 90000,
    "#0106": 100000,
  };

  var ss    = getSS();
  var hoja  = ss.getSheetByName(CONFIG.hojaPropiedades);
  if (!hoja || hoja.getLastRow() < 2) {
    SpreadsheetApp.getUi().alert("No se encontró la hoja Propiedades.");
    return;
  }

  var lastRow = hoja.getLastRow();
  var ids     = hoja.getRange(2, 1, lastRow - 1, 1).getValues();   // col A = ID
  var precios = hoja.getRange(2, 3, lastRow - 1, 1).getValues();   // col C = Precio Aseo

  var actualizados = 0;
  var noEncontrados = [];

  for (var i = 0; i < ids.length; i++) {
    var id = String(ids[i][0]).trim();
    if (!id) continue;
    if (PRECIOS[id] !== undefined) {
      if (Number(precios[i][0]) !== PRECIOS[id]) {
        hoja.getRange(i + 2, 3).setValue(PRECIOS[id]);
        actualizados++;
      }
    } else {
      noEncontrados.push(id);
    }
  }

  var msg = "✅ " + actualizados + " precio(s) actualizado(s).";
  if (noEncontrados.length > 0) {
    msg += "\n\n⚠️ Estas propiedades no tienen precio asignado en la lista:\n" + noEncontrados.join(", ");
  }
  SpreadsheetApp.getUi().alert(msg);
}

// ============================================================
// SETUP helpers (correr UNA VEZ para poblar datos)
// ============================================================

// (Helpers de setup one-shot eliminados en la auditoría de producción:
//  setupInicial, debugSheets, llenarTodo, fixSheetNames, getSpreadsheetId.
//  Ya cumplieron su rol cuando se montó el spreadsheet. Si en el futuro
//  hace falta repoblar, ver historial git commit b521d9a o anteriores.)

// ============================================================
// MIGRACIÓN: convertir filas con JSON o multi-línea (cols 16/17/18
// del esquema viejo) al esquema nuevo de 1 columna por ítem.
// One-shot, idempotente: si una fila ya tiene la nueva forma, la salta.
// ============================================================

function migrarFormJsonAColumnas() {
  var ss = getSS();
  var hoja = ss.getSheetByName(CONFIG.hojaAseos);
  if (!hoja || hoja.getLastRow() < 2) {
    ss.toast("Hoja Aseos vacía", "Migración", 4);
    return;
  }

  ensureAseosFormColumns(hoja);

  var lastRow = hoja.getLastRow();
  // Tomar las viejas cols 16/17/18 (revision/reposicion/funcionamiento)
  // + 19 (reporte) + 20 (video). Si la fila no tiene esos datos, skip.
  var bloqueViejo = hoja.getRange(2, 14, lastRow - 1, 7).getValues();
  // Leer fórmulas de col 20 (video antiguo) para preservar HYPERLINKs.
  // getValues() en una celda con =HYPERLINK(...) devuelve el label ("Ver video"),
  // no la URL — getFormulas() devuelve la fórmula completa.
  var videoFmlsViejo = hoja.getRange(2, 20, lastRow - 1, 1).getFormulas();
  var notasRevision      = hoja.getRange(2, 16, lastRow - 1, 1).getNotes();
  var notasReposicion    = hoja.getRange(2, 17, lastRow - 1, 1).getNotes();
  var notasFuncionamiento= hoja.getRange(2, 18, lastRow - 1, 1).getNotes();

  var migradas = 0;
  var omitidas = 0;

  for (var i = 0; i < bloqueViejo.length; i++) {
    var fila = i + 2;
    var oldEntrada = bloqueViejo[i][0];
    var oldSalida  = bloqueViejo[i][1];
    var oldRev     = bloqueViejo[i][2];
    var oldRep     = bloqueViejo[i][3];
    var oldFun     = bloqueViejo[i][4];
    var oldReporte = bloqueViejo[i][5];
    // Extraer URL del HYPERLINK si la celda tenía fórmula; si no, usar el valor plano.
    var _videoFml  = videoFmlsViejo[i][0] || "";
    var _urlMatch  = _videoFml.match(/=HYPERLINK\("([^"]+)"/);
    var oldVideo   = _urlMatch ? _urlMatch[1] : String(bloqueViejo[i][6] || "");

    // Si está vacío, nada que migrar
    if (!oldEntrada && !oldSalida && !oldRev && !oldRep && !oldFun) {
      omitidas++;
      continue;
    }

    // Si la fila ya tiene contenido en una col >20 (esquema nuevo), skip
    var test = hoja.getRange(fila, 22, 1, 1).getValue();
    if (test) { omitidas++; continue; }

    function parsear(raw, note) {
      // Preferir el JSON guardado en la nota
      if (note) { try { return JSON.parse(note); } catch(e) {} }
      // Si el valor de la celda parece JSON
      if (typeof raw === "string" && raw.trim().indexOf("{") === 0) {
        try { return JSON.parse(raw); } catch(e) {}
      }
      // Si es multi-línea con íconos, intentar reconstruir
      if (typeof raw === "string" && raw.indexOf("\n") >= 0) {
        var out = {};
        raw.split("\n").forEach(function(line) {
          var m = line.match(/^([✓⚠—•])\s+(.+)$/);
          if (!m) return;
          var status = m[1] === "✓" ? "ok" : m[1] === "⚠" ? "review" : m[1] === "—" ? "na" : "";
          // mapear el label a un id conocido — match laxo
          var labelMatch = m[2].toLowerCase();
          var maps = [LABELS_REVISION, LABELS_REPOSICION, LABELS_FUNCIONA];
          for (var mi = 0; mi < maps.length; mi++) {
            for (var k in maps[mi]) {
              if (maps[mi][k].toLowerCase() === labelMatch) { out[k] = status; }
            }
          }
        });
        return out;
      }
      return null;
    }

    var revObj = parsear(oldRev, notasRevision[i][0]);
    var repObj = parsear(oldRep, notasReposicion[i][0]);
    var funObj = parsear(oldFun, notasFuncionamiento[i][0]);

    // Construir body sintético para reusar buildFormRow
    var bodySint = {
      entrada: oldEntrada,
      salida:  oldSalida,
      revision: revObj,
      reposicion: repObj,
      funcionamiento: funObj,
      reporte: oldReporte,
      videoLink: oldVideo,
    };
    var rowValues = buildFormRow(bodySint);

    hoja.getRange(fila, FORM_FIRST_COL, 1, rowValues.length).setValues([rowValues])
      .setHorizontalAlignment("center")
      .setVerticalAlignment("middle");
    var reporteCol = FORM_FIRST_COL + FORM_COLUMNS.length - 2;
    hoja.getRange(fila, reporteCol, 1, 2).setHorizontalAlignment("left").setWrap(true);

    migradas++;
  }

  ss.toast(migradas + " migradas · " + omitidas + " sin cambios", "Migración", 6);
  Logger.log("Migración form: " + migradas + " filas migradas, " + omitidas + " omitidas");
}

// ============================================================
// RESINCRONIZAR PRECIOS DE ASEOS
// ============================================================
// Para cada aseo en "Todos los Aseos" cuyo precio (col I) sea 0,
// busca el precio actual de la propiedad correspondiente y lo asigna.
// No toca aseos con precio > 0 (preserva ajustes manuales) ni
// Cancelados.

function resincronizarPreciosAseos() {
  var ss = getSS();
  var hoja = ss.getSheetByName(CONFIG.hojaAseos);
  if (!hoja || hoja.getLastRow() < 2) return;

  // Mapa idProp → precio
  var props = getPropiedades();
  var precioMap = {};
  for (var i = 0; i < props.length; i++) precioMap[props[i].id] = props[i].precioAseo || 0;

  var lr = hoja.getLastRow();
  var datos = hoja.getRange(2, 1, lr - 1, 9).getValues();
  var updates = [];
  for (var r = 0; r < datos.length; r++) {
    var row = datos[r];
    var idProp = String(row[1] || "").trim();
    var estado = String(row[7] || "");
    var precio = Number(row[8]) || 0;
    if (estado === "Cancelado") continue;
    if (precio > 0) continue;
    var nuevo = precioMap[idProp];
    if (!nuevo) continue;
    hoja.getRange(r + 2, 9).setValue(nuevo);
    updates.push(String(row[0]) + " → " + nuevo);
  }

  ss.toast(updates.length + " aseos actualizados", "Precios", 6);
  Logger.log("resincronizarPreciosAseos: " + updates.join(", "));
}

// ============================================================
// COMPARTIR TODOS LOS VIDEOS — one-shot
// ============================================================
// Recorre la carpeta raíz "Medellin Concierge - Videos Aseos" + todas
// sus subcarpetas + todos los archivos adentro, y aplica
// anyone-with-link viewer. Idempotente. Útil para los videos ya
// subidos antes de activar esto.

function compartirTodosLosVideos() {
  var raiz = getCarpetaRaiz();
  compartirAnyoneViewer(raiz);

  var subs = raiz.getFolders();
  var nFolders = 0, nFiles = 0, errs = 0;
  while (subs.hasNext()) {
    var sf = subs.next();
    try { compartirAnyoneViewer(sf); nFolders++; } catch(e) { errs++; }
    var files = sf.getFiles();
    while (files.hasNext()) {
      try { compartirAnyoneViewer(files.next()); nFiles++; }
      catch(e) { errs++; }
    }
  }
  getSS().toast(nFolders + " carpetas · " + nFiles + " archivos compartidos" + (errs ? " · " + errs + " errores" : ""), "Compartir", 6);
  Logger.log("compartirTodosLosVideos: folders=" + nFolders + " files=" + nFiles + " errs=" + errs);
}

// ============================================================
// RECUPERAR LINKS DE VIDEOS — para filenames sin URL (caso Safari CORS)
// ============================================================
// Para cada celda con un filename suelto (no URL), busca el archivo en
// Drive (toda la jerarquía de Medellin Concierge - Videos Aseos), y
// reescribe la celda como HYPERLINK al fileId real.

function recuperarLinksVideos() {
  var ss = getSS();
  var raiz = getCarpetaRaiz();

  // 1. Construir dos mapas: por filename exacto Y por código de aseo
  // (extraído del filename renombrado tipo "2026-06-03_HM5H3SSPDN_Ana_video.mov")
  var mapName = {};
  var mapCode = {};
  var subs = raiz.getFolders();
  var foldersWalked = 0;
  while (subs.hasNext()) {
    foldersWalked++;
    var sf = subs.next();
    var files = sf.getFiles();
    while (files.hasNext()) {
      var f = files.next();
      var name = f.getName();
      var entry = { id: f.getId(), date: f.getLastUpdated().getTime(), name: name };
      try { compartirAnyoneViewer(f); } catch(e) {}

      // Por nombre exacto
      if (!mapName[name] || mapName[name].date < entry.date) mapName[name] = entry;

      // Por código: extraer HM[A-Z0-9]+ o MAN-?\d+ del nombre
      var m = name.match(/(HM[A-Z0-9]{6,}|MAN-?\d+)/);
      if (m) {
        var cod = m[1];
        if (!mapCode[cod] || mapCode[cod].date < entry.date) mapCode[cod] = entry;
      }
    }
  }
  Logger.log("Map Drive: byName=" + Object.keys(mapName).length + " byCode=" + Object.keys(mapCode).length + " folders=" + foldersWalked);

  function resolveEntry(codigo, currentVal) {
    if (mapName[currentVal]) return mapName[currentVal];
    if (codigo && mapCode[codigo]) return mapCode[codigo];
    return null;
  }

  var stats = { aseos: 0, videos: 0, notFound: 0 };

  // 2. Patch Aseos col 37
  var ha = ss.getSheetByName(CONFIG.hojaAseos);
  if (ha && ha.getLastRow() >= 2 && ha.getLastColumn() >= 37) {
    var lr = ha.getLastRow();
    var vals = ha.getRange(2, 37, lr - 1, 1).getValues();
    var fms  = ha.getRange(2, 37, lr - 1, 1).getFormulas();
    var codAseos = ha.getRange(2, 1, lr - 1, 1).getValues();
    var ups = [];
    var any = false;
    for (var i = 0; i < vals.length; i++) {
      var cur = String(vals[i][0] || "").trim();
      var hasF = !!fms[i][0];
      if (hasF) {
        ups.push([fms[i][0]]);  // preservar la fórmula tal cual, no el valor mostrado
        continue;
      }
      if (!cur || cur.indexOf("http") === 0) {
        ups.push([vals[i][0]]);
        continue;
      }
      var codigoRow = String(codAseos[i][0] || "");
      var match = resolveEntry(codigoRow, cur);
      if (match) {
        var url = "https://drive.google.com/file/d/" + match.id + "/view";
        ups.push([buildHyperlink(url, "Ver video")]);
        any = true;
        stats.aseos++;
      } else {
        ups.push([vals[i][0]]);
        stats.notFound++;
      }
    }
    if (any) ha.getRange(2, 37, lr - 1, 1).setValues(ups);
  }

  // 3. Patch Videos Aseos col 5
  var hv = ss.getSheetByName(CONFIG.hojaVideos);
  if (hv && hv.getLastRow() >= 2) {
    var lr2 = hv.getLastRow();
    var vals2 = hv.getRange(2, 5, lr2 - 1, 1).getValues();
    var fms2  = hv.getRange(2, 5, lr2 - 1, 1).getFormulas();
    var codigos2 = hv.getRange(2, 1, lr2 - 1, 1).getValues();
    var ups2 = [];
    var any2 = false;
    for (var j = 0; j < vals2.length; j++) {
      var cur2 = String(vals2[j][0] || "").trim();
      var hasF2 = !!fms2[j][0];
      if (hasF2) {
        ups2.push([fms2[j][0]]);  // preservar la fórmula tal cual
        continue;
      }
      if (!cur2 || cur2.indexOf("http") === 0) {
        ups2.push([vals2[j][0]]);
        continue;
      }
      var codV = String(codigos2[j][0] || "");
      var match2 = resolveEntry(codV, cur2);
      if (match2) {
        var url2 = "https://drive.google.com/file/d/" + match2.id + "/view";
        ups2.push([buildHyperlink(url2, "Ver video · " + codV)]);
        any2 = true;
        stats.videos++;
      } else {
        ups2.push([vals2[j][0]]);
      }
    }
    if (any2) hv.getRange(2, 5, lr2 - 1, 1).setValues(ups2);
  }

  ss.toast("Aseos: " + stats.aseos + " · Videos: " + stats.videos + " · Sin match: " + stats.notFound, "Recuperar links", 8);
  Logger.log("recuperarLinksVideos: " + JSON.stringify(stats));
  return stats;
}

// ============================================================
// CONVERTIR LINKS DE VIDEO YA EXISTENTES A HYPERLINK
// ============================================================
// One-shot: recorre col 37 de "Todos los Aseos" y la col 5 de
// "Videos Aseos" y reemplaza los URLs de Drive en texto plano por
// fórmulas =HYPERLINK("url","Ver video") clickeables.

function convertirVideosAHyperlink() {
  var ss = getSS();
  var resumen = { aseos: 0, videosSheet: 0 };

  // 1. Todos los Aseos col 37 (Video)
  var hojaAseos = ss.getSheetByName(CONFIG.hojaAseos);
  if (hojaAseos && hojaAseos.getLastRow() >= 2 && hojaAseos.getLastColumn() >= 37) {
    var lastRow = hojaAseos.getLastRow();
    var values  = hojaAseos.getRange(2, 37, lastRow - 1, 1).getValues();
    var formulas = hojaAseos.getRange(2, 37, lastRow - 1, 1).getFormulas();
    var updates = [];
    var any = false;
    for (var i = 0; i < values.length; i++) {
      var current = String(values[i][0] || "").trim();
      var hasFormula = !!String(formulas[i][0] || "").trim();
      if (hasFormula || !current || current.indexOf("http") !== 0) {
        updates.push([values[i][0]]);
        continue;
      }
      updates.push([buildHyperlink(current, "Ver video")]);
      any = true;
      resumen.aseos++;
    }
    if (any) {
      hojaAseos.getRange(2, 37, lastRow - 1, 1).setValues(updates);
    }
  }

  // 2. Hoja Videos Aseos col 5 (Link Video)
  var hojaVideos = ss.getSheetByName(CONFIG.hojaVideos);
  if (hojaVideos && hojaVideos.getLastRow() >= 2) {
    var lr = hojaVideos.getLastRow();
    var vals = hojaVideos.getRange(2, 5, lr - 1, 1).getValues();
    var fms  = hojaVideos.getRange(2, 5, lr - 1, 1).getFormulas();
    var codigos = hojaVideos.getRange(2, 1, lr - 1, 1).getValues();
    var ups = [];
    var anyV = false;
    for (var j = 0; j < vals.length; j++) {
      var cur = String(vals[j][0] || "").trim();
      var hasF = !!String(fms[j][0] || "").trim();
      if (hasF || !cur || cur.indexOf("http") !== 0) { ups.push([vals[j][0]]); continue; }
      var cod = String(codigos[j][0] || "");
      ups.push([buildHyperlink(cur, "Ver video · " + cod)]);
      anyV = true;
      resumen.videosSheet++;
    }
    if (anyV) hojaVideos.getRange(2, 5, lr - 1, 1).setValues(ups);
  }

  ss.toast("Convertidos: " + resumen.aseos + " en Aseos, " + resumen.videosSheet + " en Videos", "Hyperlinks", 6);
  Logger.log("convertirVideosAHyperlink: " + JSON.stringify(resumen));
}

// ============================================================
// LISTAR VIDEOS REGISTRADOS (debug rápido)
// ============================================================
// Devuelve el contenido de la hoja "Videos Aseos" + el folderId de la
// carpeta raíz de Drive donde se suben los videos.

// ============================================================
// SELF-TEST — diagnóstico end-to-end. Correr desde menú o vía
// doPost({action:"runSelfTest"}). No modifica datos.
// ============================================================

function runSelfTest() {
  var results = [];
  function check(name, fn) {
    try {
      var msg = fn();
      results.push({ name: name, ok: true, info: msg || "" });
    } catch(e) {
      results.push({ name: name, ok: false, info: e.message });
    }
  }

  check("Spreadsheet accesible", function() {
    var ss = getSS();
    return ss.getName();
  });

  check("Hoja Personal", function() {
    var hoja = getSS().getSheetByName(CONFIG.hojaPersonal);
    if (!hoja) throw new Error("no existe");
    return "rows=" + hoja.getLastRow();
  });

  check("Hoja Propiedades", function() {
    var hoja = getSS().getSheetByName(CONFIG.hojaPropiedades);
    if (!hoja) throw new Error("no existe");
    return "rows=" + hoja.getLastRow();
  });

  check("Hoja Aseos", function() {
    var hoja = getSS().getSheetByName(CONFIG.hojaAseos);
    if (!hoja) throw new Error("no existe");
    var cols = hoja.getLastColumn();
    // Cols 14-20 se crean lazy al primer completarAseo via
    // ensureAseosFormColumns(). No es error si aún no existen.
    var formInfo = cols >= 20 ? "form OK" : "form cols se crearán al 1er completar";
    return "rows=" + hoja.getLastRow() + " cols=" + cols + " (" + formInfo + ")";
  });

  check("Hoja Maestra", function() {
    var hoja = getSS().getSheetByName(CONFIG.hojaMaestra);
    if (!hoja) throw new Error("no existe");
    return "rows=" + hoja.getLastRow();
  });

  check("getPersonal devuelve usuarios", function() {
    var p = getPersonal();
    if (!p.length) throw new Error("vacío");
    var hasAdmin = p.some(function(u){ return u.nombre.toLowerCase() === "admin"; });
    return "n=" + p.length + (hasAdmin ? " (Admin OK)" : " (sin Admin!)");
  });

  check("getPropiedades devuelve catálogo", function() {
    var props = getPropiedades();
    if (!props.length) throw new Error("vacío");
    var conIcal = props.filter(function(p){ return p.icalUrl; }).length;
    return "n=" + props.length + " conIcal=" + conIcal;
  });

  check("getAllAseos devuelve datos", function() {
    var a = getAllAseos();
    return "n=" + a.length;
  });

  check("Hojas con nombre limpio (sin emojis corruptos)", function() {
    var sheets = getSS().getSheets();
    var corruptas = sheets.filter(function(s){
      return /^[^A-Za-z0-9]/.test(s.getName());
    });
    if (corruptas.length) {
      // Sugerencia accionable, no exception fatal
      throw new Error("encontradas " + corruptas.length + ": " +
        corruptas.map(function(s){return s.getName();}).join(", ") +
        ". Corre: Menú → Limpiar hojas duplicadas con emojis");
    }
    return "n=" + sheets.length + " (todas limpias)";
  });

  check("Triggers programados existen", function() {
    var t = ScriptApp.getProjectTriggers();
    var names = t.map(function(x){ return x.getHandlerFunction(); });
    var requeridos = ["sincronizarCalendarios", "sincronizarGoogleCalendar", "autoCompletarAseosPasados"];
    var faltan = requeridos.filter(function(r){ return names.indexOf(r) === -1; });
    if (faltan.length) throw new Error("faltan triggers: " + faltan.join(", "));
    return "n=" + t.length;
  });

  var passed = results.filter(function(r){ return r.ok; }).length;
  var failed = results.filter(function(r){ return !r.ok; }).length;

  var msg = "Self-test: " + passed + " OK, " + failed + " FAIL\n";
  results.forEach(function(r){
    msg += (r.ok ? "  ✓ " : "  ✗ ") + r.name + (r.info ? " — " + r.info : "") + "\n";
  });
  Logger.log(msg);

  try {
    getSS().toast(passed + " OK, " + failed + " FAIL", "Self-test", 8);
  } catch(e) {}

  return { ok: failed === 0, passed: passed, failed: failed, results: results };
}
