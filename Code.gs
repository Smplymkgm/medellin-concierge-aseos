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
  return ["domingo","lunes","martes","miércoles","jueves","viernes","sábado"][fecha.getDay()];
}

// ============================================================
// TEST DE FECHAS
// ============================================================

function testFechas() {
  Logger.log("=== TEST FECHAS ===");
  var d1 = new Date(2026, 4, 2);
  var r1 = fechaToStr(d1);
  Logger.log("Test 1 - Date(2026,4,2) → " + r1 + " | " + (r1 === "02/05/2026" ? "✅ OK" : "❌ FALLO"));
  var r2 = fechaToStr("02/05/2026");
  Logger.log("Test 2 - '02/05/2026' → " + r2 + " | " + (r2 === "02/05/2026" ? "✅ OK" : "❌ FALLO"));
  var d3 = fechaADate("02/05/2026");
  Logger.log("Test 3 - fechaADate OK: " + (d3 && d3.getDate()===2 && d3.getMonth()===4 ? "✅" : "❌"));
  Logger.log("=== FIN TESTS ===");
}

// ============================================================
// PROPIEDADES
// ============================================================

function getPropiedades() {
  const ss   = SpreadsheetApp.getActiveSpreadsheet();
  let   hoja = ss.getSheetByName(CONFIG.hojaPropiedades);
  if (!hoja) hoja = crearHojaPropiedades();
  if (hoja.getLastRow() < 2) return [];
  const datos = hoja.getRange(2, 1, hoja.getLastRow()-1, 6).getValues();
  const props = [];
  for (const r of datos) {
    const id  = String(r[0]).trim();
    const nom = String(r[1]).trim();
    const url = String(r[4]).trim();
    if (!id || !nom || !url) continue;
    props.push({
      id, nombre: nom,
      precioAseoInterno: Number(r[2]) || 0,
      acceso:       String(r[3] || "").trim(),
      icalUrl:      url,
      empleadaAuto: String(r[5] || "").trim(),
    });
  }
  return props;
}

function crearHojaPropiedades() {
  const ss  = SpreadsheetApp.getActiveSpreadsheet();
  const ex  = ss.getSheetByName(CONFIG.hojaPropiedades);
  if (ex) ss.deleteSheet(ex);
  const hoja = ss.insertSheet(CONFIG.hojaPropiedades);
  const enc = ["ID","Nombre Propiedad","Precio Aseo","Acceso (claves y dirección)","iCal URL","Empleada Auto"];
  hoja.getRange(1,1,1,enc.length).setValues([enc])
    .setBackground("#1a1a2e").setFontColor("#ffffff")
    .setFontWeight("bold").setFontSize(11).setFontFamily("Arial");
  [80,260,110,420,420,130].forEach((w,i)=>hoja.setColumnWidth(i+1,w));
  hoja.setFrozenRows(1);
  hoja.getRange("F2:F500").setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList(["", ...CONFIG.empleadas.map(e=>e.nombre)], true)
      .setAllowInvalid(false).build()
  );
  const props = [
    ["#0065","Cozy, Convenient and Affordable Loft In Laureles",80000,"Clave edificio: 111222 | Clave apto: 664433# | Dirección: calle 42 # 73-96 apto 301A","https://www.airbnb.com/calendar/ical/1059844517249923111.ics?t=0a8e9eb6a7cf4d93ba3b53c98b9b9109",""],
    ["#0002","Luxury 3 Bedroom Apartment in Provenza",130000,"Clave apto: Actualizar | Dirección: Cl. 13 #34-31, apto 1001","https://www.airbnb.com/calendar/ical/1110818240758059750.ics?t=de70843dd2b64418bb1a0bf0e2f4b982",""],
    ["#0091","New Industrial Loft in Laureles | Stadium & Metro",70000,"Clave edificio: 662233# | Clave apto: 5501# | Dirección: Crr 68 # 48-25 edificio monte Ignacio apto 501","https://www.airbnb.com/calendar/ical/1067594374376114880.ics?t=3d2dc20bf0d54d5eb0dcf62476ba6279",""],
    ["#0089","Ayamonte 306",150000,"Clave puerta exterior: 3589 | Clave apto 306A: 555222 | Clave apto 306B: 475869 | Dirección: Cra. 32d #7A 13, Apto 306","https://www.airbnb.com/calendar/ical/1576419134141027115.ics?t=853c7ce3086343778b19be3b818bb604",""],
    ["#0087","Ayamonte 306 2BR",100000,"Clave puerta exterior: 3589 | Clave apto 306A: 555222 | Dirección: Cra. 32d #7A 13, Apto 306","https://www.airbnb.com/calendar/ical/1569669692558214891.ics?t=85dd1b98ba4c4e27b61feb394f107df2",""],
    ["#0088","Ayamonte 306 Loft",60000,"Clave puerta exterior: 3589 | Clave apto 306B: 475869 | Dirección: Cra. 32d #7A 13, Apto 306","https://www.airbnb.com/calendar/ical/1568369073998107926.ics?t=2a78bb5a0a454a36b7105ff7ccd5fb28",""],
    ["#0100","Bosques de La Concha 9914",10000,"Clave Caja de llaves: 3443 | Dirección: Cl 10 #30-210 Bosques de la concha Apto 9914","https://www.airbnb.com/calendar/ical/1634755529814954764.ics?t=38bc4c9f949c4558a2017564ef090349",""],
    ["#0075","Central/Moderno Apt en Envigado | Kardinal 902",0,"","https://www.airbnb.com/calendar/ical/1458107014614722402.ics?t=4f926bbbce4249ada0682fb89f22a4b0",""],
    ["#0082","Edficio Doña Emilia 302",120000,"Solicitarnos las llaves | Clave apto: 7116 | Dirección: CIR 3 #68-10 apto 302","https://www.airbnb.com/calendar/ical/1544348525770961839.ics?t=e24fd62036c746aba9668a8b2eaa5ba0",""],
    ["#0086","Kardinal42 604",90000,"Clave apto: Solicitar | Dirección: CRA 42B # 25 sur 125 apto 604","https://www.airbnb.com/calendar/ical/1567644876777215413.ics?t=6c2a596d1e6c4e50bcd8cac76dfc3466",""],
    ["#0098","Laureles House | Cerca al metro",200000,"Clave entrada: 475869 | Clave Suites: Solicitar | Dirección: Crr 78B # 49A-14 Suites 1,2,3,4 y 5","https://www.airbnb.com/calendar/ical/1616091455178092939.ics?t=8dd396813bc94d9495531bc62f06da8b",""],
    ["#0081","Luxury Apartment in Envigado",140000,"Solicitar llaves | Dirección: Cl. 37 Sur #27 90, Torre 5 Apto 1533","https://www.airbnb.com/calendar/ical/1537776165136147369.ics?t=e2aa37242b30489ca42cd757b75c5cca",""],
    ["#0083","Manila Luxury Suites 201",90000,"Clave edificio: 2026401 | Clave caja de llaves: 4530 | Dirección: Cll 12 # 43D-109 suit 201","https://www.airbnb.com/calendar/ical/1573104471376137291.ics?t=9dbaec3e7ebd4fa0bced6398d114efb6",""],
    ["#0084","Manila Luxury Suites 301",90000,"Clave edificio: 2026401 | Clave caja de llaves: 5687 | Dirección: Cll 12 # 43D-109 suit 301","https://www.airbnb.com/calendar/ical/1557512405304706776.ics?t=9673882925af449c90a158ef2e5b29ea",""],
    ["#0085","Manila Luxury Suites 401",70000,"Clave edificio: 2026401 | Clave caja de llaves: 4530 | Dirección: Cll 12 # 43D-109 suit 401","https://www.airbnb.com/calendar/ical/1557148641859181965.ics?t=af7d0ebf34f6420e94538c9c7386cee4",""],
    ["#0076","Modern 1BR Apartment in Envigado Kardinal 1607 1H",0,"","https://www.airbnb.com/calendar/ical/1511952193532990951.ics?t=79b74209c2c847228915d9fe75ef716f",""],
    ["#0092","2H Apto Moderno en Laureles | Estadio y Metro",90000,"Clave edificio: 662233# | Clave apto: 0052# | Dirección: Cra 68 # 48-25 edificio Monte Ignacio apto 502","https://www.airbnb.com/calendar/ical/1067646316774826374.ics?t=0903b84c6a7c45d4a2bb5cfacc569c83",""],
    ["#0010","Stunning 1 BR Condo in Poblado",90000,"Clave apto: 000 406 | Dirección: Cl. 12 #43e-22 apto 406","https://www.airbnb.com/calendar/ical/568188404839333166.ics?t=b6deb629453144cbb7aa45b4775aa9d6",""],
    ["#0097","Suite Moderna en Laureles | 05",50000,"Clave edificio: 475869# | Clave apto: 224599# | Dirección: Crr 78B # 49A-14 suite 5","https://www.airbnb.com/calendar/ical/1600970293208740761.ics?t=6693e82b79c24b608433012a864f4b34",""],
    ["#0093","Suite Moderna en Laureles | 01",60000,"Clave edificio: 475869# | Clave apto: 552266# | Dirección: Crr 78B # 49A-14 suite 1","https://www.airbnb.com/calendar/ical/1600861844443976595.ics?t=18b585c48a134de8a8c5285275c24731",""],
    ["#0094","Suite Moderna en Laureles | 02",60000,"Clave edificio: 475869# | Clave apto: 556699# | Dirección: Crr 78B # 49A-14 suite 2","https://www.airbnb.com/calendar/ical/1600900771290899356.ics?t=c6394d64f3064c18b6ffb1aea70516f4",""],
    ["#0095","Suite Moderna en Laureles | 03",60000,"Clave edificio: 475869# | Clave apto: 2580 | Dirección: Crr 78B # 49A-14 suite 3","https://www.airbnb.com/calendar/ical/1600950183602316625.ics?t=df0a27a25a2f4085952022ce544232ee",""],
    ["#0096","Suite Moderna en Laureles | 04",50000,"Clave edificio: 475869# | Clave apto: 558899# | Dirección: Crr 78B # 49A-14 suite 4","https://www.airbnb.com/calendar/ical/1640549319042180349.ics?t=8acf02fa61cf4418bb676d4d7b24a2fa",""],
    ["#0076b","Top Floor Industrial 2BR Envigado 1607",0,"","https://www.airbnb.com/calendar/ical/1458239945601966285.ics?t=892a1efa00024704bdbc476f41a2578e",""],
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

// ============================================================
// MENÚ
// ============================================================

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("🏠 Airbnb Manager")
    .addItem("🔄 Sincronizar Airbnb",                     "sincronizarCalendarios")
    .addItem("📅 Sincronizar Google Calendar",             "sincronizarGoogleCalendar")
    .addItem("📨 Reenviar invitación (fila seleccionada)", "reenviarInvitacionSeleccionada")
    .addSeparator()
    .addItem("➕ Agregar Aseo Manual",                    "agregarAseoManual")
    .addSeparator()
    .addItem("🧹 Crear/verificar hoja Todos los Aseos",   "crearHojaAseos")
    .addItem("🏠 Recrear hoja Propiedades",               "crearHojaPropiedades")
    .addSeparator()
    .addItem("🧪 Test fechas",                "testFechas")
    .addSeparator()
    .addItem("⚙️ Crear triggers automáticos", "crearTriggersAutomaticos")
    .addToUi();
}

// ============================================================
// WEB APP
// ============================================================

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

// ============================================================
// DATOS PARA LA APP (lee de "🧹 Todos los Aseos")
// ============================================================

function getDatosAseadora(nombre) {
  const ss   = SpreadsheetApp.getActiveSpreadsheet();
  const hoja = ss.getSheetByName(CONFIG.hojaAseos);

  const proximos  = []; // checkout >= hoy, no cancelados
  const historial = []; // checkout < hoy, todos los estados

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
        // Hoy o futuro — incluir todos excepto cancelados
        if (estado !== "Cancelado") {
          proximos.push({
            codigo:    String(r[0]),
            idProp:    String(r[1]).trim(),
            propiedad: String(r[2]).trim(),
            checkin:   checkinStr,
            checkout:  checkoutStr,
            noches:    Number(r[5]) || 0,
            estado,
            precio,
            notas:   String(r[9]  || ""),
            accesos: accesoRaw ? accesoRaw.split("|").map(a => a.trim()).filter(Boolean) : [],
          });
        }
      } else {
        // Pasado — siempre va al historial, cualquier estado
        historial.push({
          codigo:          String(r[0]),
          idProp:          String(r[1]).trim(),
          propiedad:       String(r[2]).trim(),
          checkin:         checkinStr,
          checkout:        checkoutStr,
          noches:          Number(r[5]) || 0,
          estado,
          precio,
          fechaCompletado: String(r[12] || ""),
        });
      }
    }
  }

  proximos.sort((a, b) => {
    const da = fechaADate(a.checkout), db = fechaADate(b.checkout);
    if (!da || !db) return 0;
    return da - db;
  });

  // Historial: más reciente primero
  historial.sort((a, b) => {
    const da = fechaADate(a.checkout), db = fechaADate(b.checkout);
    if (!da || !db) return 0;
    return db - da;
  });

  return { proximos, historial };
}

// ============================================================
// MARCAR ASEO COMO COMPLETADO
// ============================================================

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
    hoja.getRange(fila, 8).setValue("Completado");   // col 8 = Estado
    hoja.getRange(fila, 13).setValue(ahora);          // col 13 = Fecha Completado
    hoja.getRange(fila, 1, 1, 13)
      .setBackground("#e8f5e9").setFontFamily("Arial").setFontSize(10);

    // Sync to master sheet
    const master = ss.getSheetByName(CONFIG.hojaMaestra);
    if (master && master.getLastRow() >= 2) {
      const mc = master.getRange(2, 1, master.getLastRow()-1, 1).getValues();
      for (let j = 0; j < mc.length; j++) {
        if (String(mc[j][0]) === String(codigo)) {
          master.getRange(j+2, 7).setValue("Finalizado");
          master.getRange(j+2, 1, 1, 13).setBackground("#e8f5e9");
          break;
        }
      }
    }

    return { ok: true };
  }
  return { ok: false, msg: "Aseo no encontrado" };
}

// ============================================================
// AUTO-COMPLETAR ASEOS PASADOS (corre a las 10 PM)
// ============================================================

function autoCompletarAseosPasados() {
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
    if (!String(datos[i][6])) continue; // sin aseadora asignada

    const checkoutStr = disp[i][1] || fechaToStr(datos[i][4]);
    const checkout    = fechaADate(checkoutStr);
    if (!checkout || checkout >= hoy) continue;

    const fila = i + 2;
    hoja.getRange(fila, 8).setValue("Completado");
    hoja.getRange(fila, 13).setValue(ahora + " (auto)");
    hoja.getRange(fila, 1, 1, 13).setBackground("#e8f5e9");
    count++;
  }

  Logger.log("autoCompletarAseosPasados: " + count + " aseos marcados.");
}

// ============================================================
// HOJA "🧹 TODOS LOS ASEOS"
// ============================================================

// Columns:
// 1 Código | 2 ID Prop | 3 Propiedad | 4 Check-in | 5 Check-out | 6 Noches
// 7 Aseadora | 8 Estado | 9 Precio | 10 Notas | 11 Acceso | 12 Cal ID (hidden) | 13 Completado

function crearHojaAseos() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let   h  = ss.getSheetByName(CONFIG.hojaAseos);
  if (h) {
    SpreadsheetApp.getActiveSpreadsheet().toast("La hoja ya existe.", CONFIG.hojaAseos, 4);
    return h;
  }
  h = ss.insertSheet(CONFIG.hojaAseos);
  const enc = ["Código Reserva","ID Propiedad","Propiedad","Check-in","Check-out","Noches",
               "Aseadora","Estado","Precio Aseo","Notas","Acceso","Cal Event ID","Completado"];
  h.getRange(1,1,1,enc.length).setValues([enc])
    .setBackground("#1a1a2e").setFontColor("#ffffff")
    .setFontWeight("bold").setFontSize(11).setFontFamily("Arial");
  [160,80,240,100,100,55,130,110,120,180,280,1,140].forEach((w,i)=>h.setColumnWidth(i+1,w));
  h.hideColumns(12);
  h.setFrozenRows(1);
  const nombres = CONFIG.empleadas.map(e => e.nombre);
  h.getRange("G2:G2000").setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList(["", ...nombres], true).setAllowInvalid(false).build()
  );
  h.getRange("H2:H2000").setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList(["Pendiente","Completado","Cancelado"], true)
      .setAllowInvalid(false).build()
  );
  SpreadsheetApp.getActiveSpreadsheet().toast("✅ Hoja creada.", CONFIG.hojaAseos, 4);
  return h;
}

function sincronizarHojaAseos() {
  const ss     = SpreadsheetApp.getActiveSpreadsheet();
  const master = ss.getSheetByName(CONFIG.hojaMaestra);
  if (!master || master.getLastRow() < 2) return;

  let hoja = ss.getSheetByName(CONFIG.hojaAseos);
  if (!hoja) hoja = crearHojaAseos();

  // Build index of what's already in Todos los Aseos
  const existentes = {};
  if (hoja.getLastRow() > 1) {
    const exDatos = hoja.getRange(2, 1, hoja.getLastRow()-1, 13).getValues();
    for (let i = 0; i < exDatos.length; i++) {
      const cod = String(exDatos[i][0]);
      if (cod) existentes[cod] = { row: i+2, estado: String(exDatos[i][7]) };
    }
  }

  // Read master with display values for dates
  const mDatos = master.getRange(2, 1, master.getLastRow()-1, 13).getValues();
  const mDisp  = master.getRange(2, 4, master.getLastRow()-1, 2).getDisplayValues();

  const nuevas    = [];

  for (let i = 0; i < mDatos.length; i++) {
    const r   = mDatos[i];
    const cod = String(r[0]);
    if (!cod) continue;

    const checkinStr   = mDisp[i][0] || fechaToStr(r[3]);
    const checkoutStr  = mDisp[i][1] || fechaToStr(r[4]);
    const estadoMaster = String(r[6] || "");

    if (existentes[cod]) {
      // Update existing row — but never downgrade a Completado entry
      const estadoActual = existentes[cod].estado;
      if (estadoActual === "Completado") continue;

      let nuevoEstado = estadoActual || "Pendiente";
      if (estadoMaster === "Cancelada")  nuevoEstado = "Cancelado";
      if (estadoMaster === "Finalizado") nuevoEstado = "Completado";

      const fila = existentes[cod].row;
      // Write updated row data (preserve cols 1, 12, 13)
      hoja.getRange(fila, 3).setValue(String(r[2] || ""));          // propiedad
      hoja.getRange(fila, 4).setValue(checkinStr).setNumberFormat("@");
      hoja.getRange(fila, 5).setValue(checkoutStr).setNumberFormat("@");
      hoja.getRange(fila, 6).setValue(r[5] || 0);                   // noches
      hoja.getRange(fila, 7).setValue(String(r[7] || ""));          // aseadora
      hoja.getRange(fila, 8).setValue(nuevoEstado);                  // estado
      hoja.getRange(fila, 9).setValue(Number(r[8]) || 0);            // precio
      hoja.getRange(fila, 10).setValue(String(r[9] || ""));         // notas
      hoja.getRange(fila, 11).setValue(String(r[10] || ""));        // acceso
      const bg = nuevoEstado === "Completado" ? "#e8f5e9" :
                 nuevoEstado === "Cancelado"  ? "#fff3f3" : "#ffffff";
      hoja.getRange(fila, 1, 1, 13).setBackground(bg);
      if (nuevoEstado === "Completado") {
        // Set completion timestamp if not already set
        const existingTs = hoja.getRange(fila, 13).getValue();
        if (!existingTs) {
          hoja.getRange(fila, 13).setValue(
            Utilities.formatDate(new Date(), "America/Bogota", "dd/MM/yyyy HH:mm")
          );
        }
      }

    } else {
      // New entry
      const estado = estadoMaster === "Cancelada"  ? "Cancelado"  :
                     estadoMaster === "Finalizado" ? "Completado" : "Pendiente";
      const ts     = estado === "Completado" ?
        Utilities.formatDate(new Date(), "America/Bogota", "dd/MM/yyyy HH:mm") : "";
      nuevas.push([
        cod, r[1], r[2], checkinStr, checkoutStr, r[5],
        r[7]||"", estado, r[8]||0, r[9]||"", r[10]||"", r[11]||"", ts
      ]);
    }
  }

  if (nuevas.length > 0) {
    const fi = hoja.getLastRow() + 1;
    hoja.getRange(fi, 1, nuevas.length, 13).setValues(nuevas);
    hoja.getRange(fi, 4, nuevas.length, 2).setNumberFormat("@");
    hoja.getRange(fi, 9, nuevas.length, 1).setNumberFormat("$#,##0");
    for (let i = 0; i < nuevas.length; i++) {
      const bg = nuevas[i][7] === "Completado" ? "#e8f5e9" :
                 nuevas[i][7] === "Cancelado"  ? "#fff3f3" : "#f8f9fa";
      hoja.getRange(fi+i, 1, 1, 13).setBackground(bg).setFontFamily("Arial").setFontSize(10);
    }
  }
}

// ============================================================
// SINCRONIZAR AIRBNB
// ============================================================

function sincronizarCalendarios() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let hoja = ss.getSheetByName(CONFIG.hojaMaestra);
  if (!hoja) hoja = ss.insertSheet(CONFIG.hojaMaestra);

  const guardado    = leerDatosGuardados(hoja);
  const propiedades = getPropiedades();

  // Preserve manually-added rows (MANUAL- prefix)
  const manuales = [];
  if (hoja.getLastRow() > 1) {
    const filas = hoja.getRange(2,1,hoja.getLastRow()-1,13).getValues();
    for (const f of filas) if (String(f[0]).startsWith("MANUAL-")) manuales.push([...f]);
  }

  limpiarDatos(hoja);
  configurarEncabezados(hoja);
  aplicarDropdowns(hoja);

  let reservas = [];
  for (const prop of propiedades) {
    if (!prop.icalUrl) continue;
    reservas = reservas.concat(obtenerReservasDeICal(prop));
  }
  reservas.sort((a, b) => fechaADate(a.checkout) - fechaADate(b.checkout));
  escribirReservas(hoja, reservas, guardado);

  if (manuales.length > 0) {
    const fi = hoja.getLastRow() + 1;
    hoja.getRange(fi, 1, manuales.length, 13).setValues(manuales);
    for (let i = 0; i < manuales.length; i++)
      hoja.getRange(fi+i, 1, 1, 13).setBackground("#fff9e6").setFontFamily("Arial").setFontSize(10);
  }

  // Sync to the permanent Todos los Aseos sheet
  sincronizarHojaAseos();

  SpreadsheetApp.getActiveSpreadsheet().toast(
    "✅ " + reservas.length + " reservas sincronizadas", "Airbnb Sync", 5);
}

// ============================================================
// ICAL
// ============================================================

function obtenerReservasDeICal(prop) {
  try {
    const r = UrlFetchApp.fetch(prop.icalUrl, { muteHttpExceptions: true });
    if (r.getResponseCode() !== 200) return [];
    return parsearICal(r.getContentText(), prop);
  } catch(e) {
    Logger.log("Error iCal " + prop.nombre + ": " + e.message);
    return [];
  }
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
    out.push({
      codigo:       cod,
      id:           prop.id,
      propiedad:    prop.nombre,
      checkin:      formatearFecha(fi),
      checkout:     formatearFecha(fo),
      noches:       Math.round((fo - fi) / 86400000),
      estado:       "Confirmada",
      precio:       prop.precioAseoInterno || 0,
      acceso:       prop.acceso || "",
      empleadaAuto: prop.empleadaAuto || "",
    });
  }
  return out;
}

function extraer(txt, campo) {
  const m = txt.match(new RegExp(campo + "[^:]*:([^\\n\\r]+)"));
  return m ? m[1].trim() : "";
}

// ============================================================
// HOJA MAESTRA — helpers
// ============================================================

function leerDatosGuardados(hoja) {
  const g = {};
  if (hoja.getLastRow() < 2) return g;
  const datos = hoja.getRange(2, 1, hoja.getLastRow()-1, 13).getValues();
  const disp  = hoja.getRange(2, 4, hoja.getLastRow()-1, 2).getDisplayValues();
  for (let i = 0; i < datos.length; i++) {
    const f = datos[i];
    const c = String(f[0]); if (!c) continue;
    g[c] = {
      empleada: String(f[7] || ""),
      estado:   String(f[6] || ""),
      notas:    String(f[9] || ""),
      acceso:   String(f[10] || ""),
      eventId:  String(f[11] || ""),
      checkin:  disp[i][0] || fechaToStr(f[3]),
      checkout: disp[i][1] || fechaToStr(f[4]),
    };
  }
  return g;
}

function configurarEncabezados(hoja) {
  const enc = ["Código Reserva","ID Propiedad","Propiedad","Check-in","Check-out","Noches",
               "Estado","Empleada Asignada","Precio Aseo","Notas","Acceso","Cal Event ID","Notas Admin"];
  hoja.getRange(1,1,1,enc.length).setValues([enc])
    .setBackground("#1a1a2e").setFontColor("#ffffff")
    .setFontWeight("bold").setFontSize(11).setFontFamily("Arial");
  [160,80,240,100,100,55,110,130,120,180,280,1,220].forEach((w,i)=>hoja.setColumnWidth(i+1,w));
  hoja.hideColumns(12);
  hoja.setFrozenRows(1);
}

function limpiarDatos(hoja) {
  try {
    const last   = hoja.getLastRow();
    const frozen = hoja.getFrozenRows();
    const first  = frozen + 1;
    if (last >= first) hoja.deleteRows(first, last - frozen);
  } catch(e) {
    Logger.log("limpiarDatos: " + e.message);
  }
}

function escribirReservas(hoja, reservas, guardado) {
  if (!reservas.length) return;
  const filas = reservas.map(r => {
    const g   = guardado[r.codigo] || {};
    let emp   = g.empleada || "";
    if (!emp && r.empleadaAuto) emp = r.empleadaAuto;
    const estado = g.estado === "Finalizado" ? "Finalizado" : (g.estado || r.estado);
    return [r.codigo, r.id, r.propiedad, r.checkin, r.checkout, r.noches,
            estado, emp, r.precio, g.notas||"", g.acceso||r.acceso||"",
            g.eventId||"", ""];
  });
  hoja.getRange(2, 1, filas.length, 13).setValues(filas);
  hoja.getRange(2, 4, filas.length, 2).setNumberFormat("@");
  for (let i = 0; i < filas.length; i++) {
    const bg = filas[i][6] === "Finalizado" ? "#e8f5e9" : i%2===0 ? "#f8f9fa" : "#ffffff";
    hoja.getRange(i+2, 1, 1, 13).setBackground(bg).setFontFamily("Arial").setFontSize(10);
  }
  hoja.getRange(2, 9, filas.length, 1).setNumberFormat("$#,##0");
}

function aplicarDropdowns(hoja) {
  const nombres = CONFIG.empleadas.map(e => e.nombre);
  hoja.getRange("H2:H2000").setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList(nombres, true).setAllowInvalid(false).build()
  );
  hoja.getRange("G2:G2000").setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList(["Confirmada","Cancelada","Pendiente","Finalizado"], true)
      .setAllowInvalid(false).build()
  );
}

// ============================================================
// GOOGLE CALENDAR
// ============================================================

function sincronizarGoogleCalendar() {
  const ss   = SpreadsheetApp.getActiveSpreadsheet();
  const hoja = ss.getSheetByName(CONFIG.hojaMaestra);
  if (!hoja || hoja.getLastRow() < 2) return;
  const datos = hoja.getRange(2, 1, hoja.getLastRow()-1, 13).getValues();
  const disp  = hoja.getRange(2, 4, hoja.getLastRow()-1, 2).getDisplayValues();
  const cal   = CalendarApp.getDefaultCalendar();
  let creados = 0, actualizados = 0;

  for (let i = 0; i < datos.length; i++) {
    const r       = datos[i]; const fila = i + 2;
    const codigo  = String(r[0]);
    const empNom  = String(r[7] || "");
    const estado  = String(r[6] || "");
    const eventId = String(r[11] || "");
    if (!codigo || !empNom) continue;

    if (estado === "Cancelada" || estado === "Finalizado") {
      if (eventId) {
        try { cal.getEventById(eventId).deleteEvent(); } catch(e) {}
        hoja.getRange(fila, 12).setValue("");
      }
      continue;
    }

    const emp = CONFIG.empleadas.find(e => e.nombre === empNom);
    if (!emp || !emp.email) continue;

    const checkoutStr = disp[i][1] || fechaToStr(r[4]);
    const fecha = fechaADate(checkoutStr);
    if (!fecha) continue;

    const checkinStr = disp[i][0] || fechaToStr(r[3]);
    const inicio = new Date(fecha); inicio.setHours(11,0,0,0);
    const fin    = new Date(fecha); fin.setHours(15,0,0,0);
    const titulo = "🧹 Limpieza " + nombreDia(fecha) + " - " + r[2];
    const desc   = [
      "Código: " + codigo,
      "Check-in: " + checkinStr + "  →  Check-out: " + checkoutStr,
      "Noches: " + r[5],
      "Precio: $" + Number(r[8]).toLocaleString("es-CO"),
      r[9]  ? "Notas: " + r[9]   : "",
      r[10] ? "Acceso: " + r[10] : "",
    ].filter(Boolean).join("\n");

    if (eventId) {
      try {
        const ev = cal.getEventById(eventId);
        if (ev) {
          ev.setTitle(titulo); ev.setTime(inicio, fin); ev.setDescription(desc);
          const inv = ev.getGuestList().map(g => g.getEmail().toLowerCase());
          if (!inv.includes(emp.email.toLowerCase())) ev.addGuest(emp.email);
          actualizados++; continue;
        }
      } catch(e) {}
    }
    const nEv = cal.createEvent(titulo, inicio, fin, { guests: emp.email, sendInvites: true, description: desc });
    hoja.getRange(fila, 12).setValue(nEv.getId());
    creados++;
  }
  SpreadsheetApp.getActiveSpreadsheet().toast(
    "📅 Calendario: " + creados + " creados, " + actualizados + " actualizados", "Google Calendar Sync", 5);
}

// ============================================================
// REENVIAR INVITACIÓN
// ============================================================

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
  if (eventId) {
    try {
      const ev = cal.getEventById(eventId);
      if (ev) {
        ev.removeGuest(emp.email); ev.addGuest(emp.email);
        SpreadsheetApp.getActiveSpreadsheet().toast("📨 Reenviada a " + emp.nombre, "OK", 4);
        return;
      }
    } catch(e) {}
  }
  const ini = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate(), 0, 0);
  const fin = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate(), 23, 59);
  for (const ev of cal.getEvents(ini, fin)) {
    if (ev.getTitle().includes(prop)) {
      ev.removeGuest(emp.email); ev.addGuest(emp.email);
      SpreadsheetApp.getActiveSpreadsheet().toast("📨 Reenviada a " + emp.nombre, "OK", 4);
      return;
    }
  }
  SpreadsheetApp.getActiveSpreadsheet().toast("⚠️ No se encontró el evento", "Error", 4);
}

// ============================================================
// IMPORTAR ASEOS PASADOS — correr UNA VEZ
// ============================================================

function importarAseosPasados() {
  const ss   = SpreadsheetApp.getActiveSpreadsheet();
  let   hoja = ss.getSheetByName(CONFIG.hojaAseos);
  if (!hoja) hoja = crearHojaAseos();

  // Evitar duplicados
  const existentes = new Set();
  if (hoja.getLastRow() > 1) {
    hoja.getRange(2, 1, hoja.getLastRow()-1, 1).getValues()
      .forEach(r => { if (r[0]) existentes.add(String(r[0])); });
  }

  // Aseos pasados del CSV de mayo 2026
  // Columns: código, idProp, propiedad, checkin, checkout, noches, aseadora,
  //          estado, precio, notas, acceso, calId, completado
  const aseos = [
    ["HMW3S24TCP", "#0092", "2H Apto Moderno en Laureles | Estadio y Metro",
     "30/04/2026", "03/05/2026", 3, "", "Completado", 90000, "",
     "Clave edificio: 662233# | Clave apto: 0052# | Dirección: Cra 68 # 48-25 edificio Monte Ignacio apto 502", "", "(importado)"],

    ["HMXHNJAXZM", "#0094", "Suite Moderna en Laureles | 02",
     "30/04/2026", "03/05/2026", 3, "", "Completado", 60000, "",
     "Clave edificio: 475869# | Clave apto: 556699# | Dirección: Crr 78B # 49A-14 suite 2", "", "(importado)"],

    ["HM3E42Q5HT", "#0091", "New Industrial Loft in Laureles | Stadium & Metro",
     "30/04/2026", "06/05/2026", 6, "", "Completado", 90000, "",
     "Clave edificio: 662233# | Clave apto: 5501# | Dirección: Crr 68 # 48-25 edificio monte Ignacio apto 501", "", "(importado)"],

    ["HM2RPH3KHH", "#0002", "Luxury 3 Bedroom Apartment in Provenza",
     "30/04/2026", "04/05/2026", 4, "", "Completado", 130000, "",
     "Clave apto: Actualizar | Dirección: Cl. 13 #34-31, apto 1001", "", "(importado)"],
  ];

  const nuevos = aseos.filter(a => !existentes.has(a[0]));
  if (!nuevos.length) {
    SpreadsheetApp.getActiveSpreadsheet().toast("Ya estaban todos importados.", "Importar", 4);
    return;
  }

  const fi = hoja.getLastRow() + 1;
  hoja.getRange(fi, 1, nuevos.length, 13).setValues(nuevos);
  hoja.getRange(fi, 4, nuevos.length, 2).setNumberFormat("@");
  hoja.getRange(fi, 9, nuevos.length, 1).setNumberFormat("$#,##0");
  for (let i = 0; i < nuevos.length; i++) {
    hoja.getRange(fi+i, 1, 1, 13)
      .setBackground("#e8f5e9").setFontFamily("Arial").setFontSize(10);
  }

  SpreadsheetApp.getActiveSpreadsheet()
    .toast("✅ " + nuevos.length + " aseos importados. Asigna las aseadoras en la hoja.", "Importar", 6);
}

// ============================================================
// AGREGAR ASEO MANUAL
// ============================================================

function agregarAseoManual() {
  const propiedades = getPropiedades();
  const empleadas   = CONFIG.empleadas.map(e => e.nombre);

  const propsOpts = propiedades.map(p =>
    '<option value="' + p.id + '|' + p.nombre.replace(/"/g,'') + '|' + p.precioAseoInterno + '|' + p.acceso.replace(/"/g,'') + '">' +
    p.id + ' — ' + p.nombre + '</option>'
  ).join('');

  const empOpts = ['', ...empleadas].map(e =>
    '<option value="' + e + '">' + (e || 'Sin asignar') + '</option>'
  ).join('');

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

  HtmlService.createHtmlOutput(html).setWidth(420).setHeight(510);
  SpreadsheetApp.getUi().showModalDialog(
    HtmlService.createHtmlOutput(html).setWidth(420).setHeight(510),
    '➕ Agregar Aseo Manual'
  );
}

function guardarAseoManual(data) {
  const ss   = SpreadsheetApp.getActiveSpreadsheet();
  let   hoja = ss.getSheetByName(CONFIG.hojaAseos);
  if (!hoja) hoja = crearHojaAseos();

  // Generar código único MANUAL-NNN
  const existentes = hoja.getLastRow() > 1
    ? hoja.getRange(2, 1, hoja.getLastRow()-1, 1).getValues().flat().map(String)
    : [];
  const manuales = existentes.filter(c => c.startsWith('MANUAL-'));
  const codigo   = 'MANUAL-' + String(manuales.length + 1).padStart(3, '0');

  // Convertir fecha yyyy-MM-dd → dd/MM/yyyy
  const p  = data.checkout.split('-');
  const checkoutStr = p[2] + '/' + p[1] + '/' + p[0];

  // Calcular check-in restando noches
  const coDate = new Date(parseInt(p[0]), parseInt(p[1])-1, parseInt(p[2]));
  const ciDate = new Date(coDate.getTime() - data.noches * 86400000);
  const checkinStr = String(ciDate.getDate()).padStart(2,'0') + '/' +
                     String(ciDate.getMonth()+1).padStart(2,'0') + '/' + ciDate.getFullYear();

  const fila = [
    codigo, data.idProp, data.propiedad,
    checkinStr, checkoutStr, data.noches,
    data.aseadora || '', 'Pendiente', data.precio,
    data.notas || '', data.acceso || '', '', ''
  ];

  const fi = hoja.getLastRow() + 1;
  hoja.getRange(fi, 1, 1, 13).setValues([fila]);
  hoja.getRange(fi, 4, 1, 2).setNumberFormat('@');
  hoja.getRange(fi, 9, 1, 1).setNumberFormat('$#,##0');
  hoja.getRange(fi, 1, 1, 13)
    .setBackground('#fff9e6').setFontFamily('Arial').setFontSize(10);

  SpreadsheetApp.getActiveSpreadsheet()
    .toast('✅ Aseo manual agregado: ' + codigo, 'Listo', 5);
  return '✅ Aseo manual agregado con código ' + codigo;
}

// ============================================================
// TRIGGERS
// ============================================================

function crearTriggersAutomaticos() {
  for (const t of ScriptApp.getProjectTriggers()) ScriptApp.deleteTrigger(t);
  ScriptApp.newTrigger("sincronizarCalendarios").timeBased().everyHours(6).create();
  ScriptApp.newTrigger("sincronizarGoogleCalendar").timeBased().everyHours(2).create();
  // Corre a las 10 PM — requiere que la zona horaria del proyecto sea America/Bogota
  // (verificar en Apps Script → Configuración del proyecto)
  ScriptApp.newTrigger("autoCompletarAseosPasados").timeBased().atHour(22).everyDays(1).create();
  SpreadsheetApp.getActiveSpreadsheet().toast("✅ Triggers creados (Airbnb c/6h, Calendar c/2h, Auto-completar 10PM)", "Triggers", 6);
}
