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

function getMesAnio(fechaStr) {
  var p = String(fechaStr).split("/");
  if (p.length !== 3) return "Sin fecha";
  var mesIdx = parseInt(p[1]) - 1;
  if (mesIdx < 0 || mesIdx > 11) return "Sin fecha";
  return CONFIG.meses[mesIdx] + " " + p[2];
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
    if (action === "getPersonal")         return handleGetPersonal(body);
    if (action === "actualizarPersonal")  return handleActualizarPersonal(body);
    if (action === "getUploadUrl")        return handleGetUploadUrl(body);
    if (action === "registrarVideo")      return handleRegistrarVideo(body);
    if (action === "agregarAseo")         return handleAgregarAseo(body);
    if (action === "getFormRespuestas")   return handleGetFormRespuestas(body);
    if (action === "getHistorial")        return handleGetHistorial(body);
    if (action === "runSelfTest")         return respond(true, runSelfTest());

    if (action === "debug") {
      var ss2 = getSS();
      var sheets2 = ss2 ? ss2.getSheets().map(function(h){return h.getName();}) : [];
      var h2 = ss2 ? ss2.getSheetByName(CONFIG.hojaPersonal) : null;
      var rows2 = h2 ? h2.getLastRow() : -1;
      var row0 = (h2 && rows2 > 1) ? h2.getRange(2,1,1,4).getValues()[0] : [];
      return respond(true, {sheets: sheets2, personalRows: rows2, row0: row0, ssId: ss2 ? ss2.getId() : 'null'});
    }
    if (action === 'getDatos') {
      var n2 = body.nombre || '';
      var r2 = body.rol || 'aseadora';
      var p2 = getPersonal().map(function(u) { return { nombre: u.nombre, rol: u.nombre.toLowerCase()==='admin'?'admin':'aseadora', pin: u.pin, email: u.email, tel: u.telefono||'' }; });
      var pr2 = getPropiedades().map(function(p) { return { id: p.id, nombre: p.nombre, precio: p.precioAseo, acceso: p.acceso }; });
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
  var datos = hoja.getRange(2, 1, hoja.getLastRow()-1, 7).getValues();
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

function ensureAseosFormColumns(hoja) {
  var lastCol = hoja.getLastColumn();
  if (lastCol >= 20) return;
  var headers = ["Entrada","Salida","Revision","Reposicion","Funcionamiento","Reporte","Video"];
  hoja.getRange(1, lastCol + 1, 1, headers.length - (lastCol - 13))
    .setValues([headers.slice(lastCol - 13)])
    .setBackground("#1a1a2e").setFontColor("#ffffff").setFontWeight("bold");
}

function handleCompletarAseo(body) {
  var codigo    = String(body.codigo    || "").trim();
  var nombre    = String(body.nombre    || "").trim();
  var notas     = String(body.notas     || "").trim();
  var videoLink = String(body.videoLink || body.video || "").trim();
  var entrada   = String(body.entrada   || "").trim();
  var salida    = String(body.salida    || "").trim();
  var revision       = body.revision       ? JSON.stringify(body.revision)       : "";
  var reposicion     = body.reposicion     ? JSON.stringify(body.reposicion)     : "";
  var funcionamiento = body.funcionamiento ? JSON.stringify(body.funcionamiento) : "";
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

      // Batch write para columnas del form (14-20) en un solo setValues
      hoja.getRange(fila, 14, 1, 7).setValues([[entrada, salida, revision, reposicion, funcionamiento, reporte, videoLink]]);

      hoja.getRange(fila, 1, 1, 20).setBackground("#e8f5e9").setFontFamily("Arial").setFontSize(10);

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

    for (var i = 0; i < datos.length; i++) {
      if (String(datos[i][0]) !== codigo) continue;
      var fila = i + 2;
      hoja.getRange(fila, 7).setValue(aseadora);

      var checkoutStr = disp[i][1] || fechaToStr(datos[i][4]);
      aseoInfo = {
        codigo:    codigo,
        propiedad: String(datos[i][2]),
        checkout:  checkoutStr,
      };
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

    if (aseadora) notificarHubspot(aseoInfo, aseadora);

    return respond(true, null);
  } finally {
    try { lock.releaseLock(); } catch(e) {}
  }
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

  var ss   = getSS();
  var hoja = ss.getSheetByName(CONFIG.hojaAseos);
  if (!hoja) return respond(false, null, "Hoja Aseos no encontrada");

  var lastRow = hoja.getLastRow();
  var codigo = "MAN" + String(lastRow).padStart(4, "0");

  var fila = [
    codigo, idProp, propiedad,
    checkout, checkout, 0,
    "Pendiente", aseadora, precio,
    notas, acceso, "", ""
  ];
  hoja.appendRow(fila);

  var newRow = hoja.getLastRow();
  hoja.getRange(newRow, 1, 1, 11).setNumberFormat("@");
  hoja.getRange(newRow, 9).setNumberFormat("0");

  return respond(true, { codigo: codigo });
}

// ============================================================
// PROPIEDADES
// ============================================================

function getPropiedades() {
  var ss   = getSS();
  var hoja = ss.getSheetByName(CONFIG.hojaPropiedades);
  if (!hoja || hoja.getLastRow() < 2) return [];
  var lastCol = Math.max(hoja.getLastColumn(), 7);
  var datos = hoja.getRange(2, 1, hoja.getLastRow()-1, lastCol).getValues();
  var props = [];
  for (var i = 0; i < datos.length; i++) {
    var r = datos[i];
    var id  = String(r[0]).trim();
    var nom = String(r[1]).trim();
    var url = String(r[4] || "").trim();
    if (!id || !nom) continue;
    props.push({
      id:            id,
      nombre:        nom,
      precioAseo:    Number(r[2]) || 0,
      acceso:        String(r[3] || "").trim(),
      icalUrl:       url,
      empleadaAuto:  String(r[5] || "").trim(),
      folderId:      String(r[6] || "").trim(),
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
  var icalUrl   = String(datos.icalUrl   || "").trim();
  var precioAseo = Number(datos.precioAseo) || 0;
  var empleadaAuto = String(datos.empleadaAuto || "").trim();

  if (!nombre || !icalUrl) return respond(false, null, "Nombre e iCal URL requeridos");

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

function handleActualizarPropiedad(body) {
  var id    = String(body.id || "").trim();
  var datos = body.datos || {};
  if (!id) return respond(false, null, "ID requerido");

  var ss   = getSS();
  var hoja = ss.getSheetByName(CONFIG.hojaPropiedades);
  if (!hoja || hoja.getLastRow() < 2) return respond(false, null, "Hoja no encontrada");

  var existentes = hoja.getRange(2, 1, hoja.getLastRow()-1, 7).getValues();
  for (var i = 0; i < existentes.length; i++) {
    if (String(existentes[i][0]).trim() !== id) continue;
    var fila = i + 2;
    if (datos.nombre      !== undefined) hoja.getRange(fila, 2).setValue(datos.nombre);
    if (datos.precioAseo  !== undefined) hoja.getRange(fila, 3).setValue(Number(datos.precioAseo));
    if (datos.acceso      !== undefined) hoja.getRange(fila, 4).setValue(datos.acceso);
    if (datos.icalUrl     !== undefined) hoja.getRange(fila, 5).setValue(datos.icalUrl);
    if (datos.empleadaAuto !== undefined) hoja.getRange(fila, 6).setValue(datos.empleadaAuto);
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

  var existentes = hoja.getRange(2, 1, hoja.getLastRow()-1, 7).getValues();
  for (var i = 0; i < existentes.length; i++) {
    if (String(existentes[i][1]).trim().toLowerCase() !== nombre.toLowerCase()) continue;
    var fila = i + 2;
    if (datos.pin       !== undefined) hoja.getRange(fila, 3).setValue(String(datos.pin)).setNumberFormat("@");
    if (datos.email     !== undefined) hoja.getRange(fila, 4).setValue(datos.email);
    if (datos.carpeta   !== undefined) hoja.getRange(fila, 6).setValue(datos.carpeta);
    if (datos.telefono  !== undefined) hoja.getRange(fila, 7).setValue(datos.telefono);
    if (datos.formulario !== undefined) hoja.getRange(fila, 5).setValue(datos.formulario);
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
  }

  try {
    var token = ScriptApp.getOAuthToken();
    var fecha = hoyStr().replace(/\//g, "-");
    var nombreArchivo = fecha + "_" + codigo + "_" + filename;
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

function handleRegistrarVideo(body) {
  var codigo    = String(body.codigo    || "").trim();
  var propiedad = String(body.propiedad || "").trim();
  var aseadora  = String(body.aseadora  || "").trim();
  var checkout  = String(body.checkout  || "").trim();
  var fileId    = String(body.fileId    || "").trim();
  var notas     = String(body.notas     || "").trim();

  var videoLink = fileId
    ? "https://drive.google.com/file/d/" + fileId + "/view"
    : String(body.videoLink || "").trim();

  registrarVideoEnHoja({ codigo: codigo, propiedad: propiedad, aseadora: aseadora, checkout: checkout, videoLink: videoLink, notas: notas });
  return respond(true, null);
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
  hoja.appendRow([data.codigo, data.propiedad, data.aseadora, data.checkout, data.videoLink, data.notas, ahora]);
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

function getCarpetaRaiz() {
  var folders = DriveApp.getFoldersByName(CONFIG.carpetaRaiz);
  if (folders.hasNext()) return folders.next();
  return DriveApp.createFolder(CONFIG.carpetaRaiz);
}

function crearCarpetaPropiedad(nombrePropiedad) {
  var raiz = getCarpetaRaiz();
  var existing = raiz.getFoldersByName(nombrePropiedad);
  if (existing.hasNext()) return existing.next().getId();
  return raiz.createFolder(nombrePropiedad).getId();
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

function handleGetFormRespuestas(body) {
  var SHEET_ID = "1Ol1gUq3lVVptZYdhjhSM0u08L99rQxeIB8mpO2Tzr2I";
  try {
    var ss   = SpreadsheetApp.openById(SHEET_ID);
    var hoja = ss.getSheets()[0];
    if (!hoja || hoja.getLastRow() < 2) return respond(true, { headers: [], rows: [] });

    var lastCol = hoja.getLastColumn();
    var lastRow = hoja.getLastRow();
    var headers = hoja.getRange(1, 1, 1, lastCol).getValues()[0].map(String);
    var datos   = hoja.getRange(2, 1, lastRow - 1, lastCol).getDisplayValues();

    var rows = [];
    for (var i = 0; i < datos.length; i++) {
      var row = [];
      for (var j = 0; j < lastCol; j++) {
        row.push(String(datos[i][j] || ""));
      }
      rows.push(row);
    }

    rows.reverse();
    return respond(true, { headers: headers, rows: rows });
  } catch(err) {
    return respond(false, null, "No se pudo leer el formulario: " + err.message);
  }
}

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
// MENU
// ============================================================

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("Medellin Concierge")
    .addItem("Sincronizar Airbnb",            "sincronizarCalendarios")
    .addItem("Sincronizar Google Calendar",   "sincronizarGoogleCalendar")
    .addSeparator()
    .addItem("Crear triggers automaticos",    "crearTriggersAutomaticos")
    .addItem("Agregar Admin a Personal",      "agregarAdmin")
    .addSeparator()
    .addItem("Limpiar hojas duplicadas con emojis", "limpiarHojasDuplicadas")
    .addSeparator()
    .addItem("Self-test (diagnóstico)",             "runSelfTest")
    .addToUi();
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
  getSS().toast("Triggers creados (Airbnb c/6h, Calendar c/2h, Auto-completar 10PM)", "Triggers", 6);
}


// ============================================================
// API — getAllAseos + getAseosPorAseadora
// ============================================================

function getAllAseos() {
  var ss = getSS();
  var hoja = ss.getSheetByName(CONFIG.hojaAseos);
  if (!hoja || hoja.getLastRow() < 2) return [];
  var datos = hoja.getRange(2, 1, hoja.getLastRow()-1, 13).getValues();
  var disp  = hoja.getRange(2, 4, hoja.getLastRow()-1, 2).getDisplayValues();
  var result = [];
  for (var i = 0; i < datos.length; i++) {
    var r = datos[i];
    var cod = String(r[0]);
    if (!cod) continue;
    result.push({
      codigo:    cod,
      idProp:    String(r[1]).trim(),
      propiedad: String(r[2]).trim(),
      checkin:   disp[i][0] || fechaToStr(r[3]),
      checkout:  disp[i][1] || fechaToStr(r[4]),
      noches:    Number(r[5]) || 0,
      asignada:  String(r[6] || ""),
      estado:    String(r[7] || ""),
      precio:    Number(r[8]) || 0,
      notas:     String(r[9] || ""),
      acceso:    String(r[10] || ""),
    });
  }
  return result;
}

function getAseosPorAseadora(nombre) {
  return getAllAseos().filter(function(a) { return a.asignada === nombre; });
}

// ============================================================
// SETUP helpers (correr UNA VEZ para poblar datos)
// ============================================================

function setupInicial() {
  llenarTodo();
}

function debugSheets() {
  var ss = getSS();
  var sheets = ss.getSheets();
  var names = sheets.map(function(s) { return s.getName() + '(' + s.getLastRow() + ')'; });
  Logger.log(names.join(', '));
}

function llenarTodo() {
  var ss = getSS();
  var hoja = ss.getSheetByName("Personal");
  if (hoja && hoja.getLastRow() < 2) {
    var datos = [
      [true, "Ana", "1234", "ayarsakarina@gmail.com", "", "", ""],
      [true, "Fernanda", "5678", "", "", "", ""],
      [true, "Claudia", "9012", "Cpatriciamonterrozalopez@gmail.com", "", "", ""],
      [true, "Admin", "2025", "", "", "", ""]
    ];
    hoja.getRange(2, 1, datos.length, 7).setValues(datos);
    Logger.log("Personal: " + datos.length + " rows");
  } else { Logger.log("Personal: " + (hoja ? "already has data" : "not found")); }
  var master = ss.getSheetByName("Todas las Reservas");
  var aseos = ss.getSheetByName("Todos los Aseos");
  if (master && aseos && aseos.getLastRow() < 2 && master.getLastRow() > 1) {
    var mData = master.getRange(2, 1, master.getLastRow()-1, 11).getValues();
    var mDisp = master.getRange(2, 4, master.getLastRow()-1, 2).getDisplayValues();
    var filas = [];
    for (var i = 0; i < mData.length; i++) {
      var r = mData[i];
      if (!r[0]) continue;
      filas.push([String(r[0]),String(r[1]),String(r[2]),mDisp[i][0],mDisp[i][1],Number(r[5])||0,String(r[7]||""),"Pendiente",Number(r[8])||0,String(r[9]||""),String(r[10]||""),"",""]);
    }
    if (filas.length > 0) aseos.getRange(2, 1, filas.length, 13).setValues(filas);
    Logger.log("Aseos: " + filas.length + " rows");
  } else { Logger.log("Aseos: " + (aseos ? "already has data or no master" : "not found")); }
}

function fixSheetNames() {
  var ss = getSS();
  var sheets = ss.getSheets();
  var renames = [
    ["Todas las Reservas", "Todas las Reservas"],
    ["Todos los Aseos", "Todos los Aseos"],
    ["Propiedades", "Propiedades"],
    ["Personal", "Personal"],
    ["Videos Aseos", "Videos Aseos"]
  ];
  for (var i = 0; i < sheets.length; i++) {
    var name = sheets[i].getName();
    for (var j = 0; j < renames.length; j++) {
      if (name.indexOf(renames[j][0]) !== -1 && name !== renames[j][1]) {
        Logger.log("Renaming: " + name + " -> " + renames[j][1]);
        try { sheets[i].setName(renames[j][1]); } catch(e) { Logger.log("Error: " + e.message); }
        break;
      }
    }
  }
  Logger.log("Done renaming");
}

function getSpreadsheetId() { Logger.log(getSS().getId()); }

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
