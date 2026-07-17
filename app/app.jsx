/* ============================================================
   Login — name dropdown + PIN dots + on-screen keypad
   ============================================================ */
const { useState: useStateL, useEffect: useEffectL } = React;

// GAS_URL puede venir de un <meta name="gas-url" content="..."> inyectado por
// el workflow deploy-pages, o cae al hardcoded para dev local.
const GAS_URL = (function() {
  var m = document.querySelector('meta[name="gas-url"]');
  if (m && m.content && m.content !== '__GAS_URL__') return m.content;
  return 'https://script.google.com/macros/s/AKfycbwcMH9Ovbh0kS1QE_8kIqhnBd3fjHqYDvRwONARydXoYj67U9Kr5wT7Nukndbpo0tNG/exec';
})();

/* ============================================================
   ErrorBoundary — atrapa errores de render para evitar pantalla blanca
   ============================================================ */
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error: error }; }
  componentDidCatch(error, info) {
    try { console.error('ErrorBoundary', error, info); } catch(e) {}
  }
  render() {
    if (this.state.error) {
      return React.createElement('div', { style: { padding: 24, fontFamily: 'Inter, system-ui, sans-serif', textAlign: 'center' } },
        React.createElement('div', { style: { fontSize: 18, fontWeight: 600, marginBottom: 8 } }, 'Algo salió mal'),
        React.createElement('div', { style: { fontSize: 13, color: '#888', marginBottom: 16, wordBreak: 'break-word' } }, String(this.state.error && this.state.error.message || this.state.error)),
        React.createElement('button', { className: 'btn btn-primary', onClick: () => location.reload() }, 'Recargar')
      );
    }
    return this.props.children;
  }
}

function gasPost(body) {
  return fetch(GAS_URL, {
    method: 'POST',
    body: JSON.stringify(body),
  }).then(r => r.json());
}

/* ---- Session persistence ---- */
const SESSION_KEY = 'medcon_session_v1';
function loadSession() {
  try {
    var raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    var s = JSON.parse(raw);
    if (!s || !s.nombre || !s.rol) return null;
    return s;
  } catch (e) { return null; }
}
function saveSession(s) {
  try { localStorage.setItem(SESSION_KEY, JSON.stringify(s)); } catch (e) {}
}
function clearSession() {
  try { localStorage.removeItem(SESSION_KEY); } catch (e) {}
}

/* Parse "dd/MM/yyyy" → Date */
function parseDateStr(s) {
  if (!s) return new Date();
  var p = String(s).split('/');
  if (p.length !== 3) return new Date();
  return new Date(parseInt(p[2]), parseInt(p[1]) - 1, parseInt(p[0]));
}

/* Transform API aseos → frontend format */
function transformAseos(apiAseos) {
  var hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  // Dedup defensivo: una propiedad solo tiene un aseo por checkout.
  // Conserva la versión más completa (completado > con form > asignada).
  var dedup = {};
  function score(a) {
    var s = 0;
    if (a.estado === 'Completado') s += 100;
    if (a.formFilled)              s += 10;
    if (String(a.codigo || '').indexOf('MAN') === 0) s += 5;
    if (a.asignada)                s += 1;
    s += (Number(a.precio) || 0) / 1e9; // desempate: gana mayor precio
    return s;
  }
  (apiAseos || []).forEach(function(a) {
    if (String(a.estado || '') === 'Cancelado') return;
    // Identidad del aseo: propiedad + día de salida (checkout)
    var key = (a.idProp || a.propiedad || '') + '|' + a.checkout;
    if (dedup[key] === undefined || score(a) >= score(dedup[key])) dedup[key] = a;
  });
  return Object.keys(dedup).map(function(k) { return dedup[k]; }).map(function(a) {
    // checkout (el campo que toda la app usa para agendar/ordenar) = DÍA DEL ASEO.
    // checkoutReserva = fecha real de salida de la reserva (Airbnb) — solo para
    // mostrar check-out y calcular noches. checkin = fecha real de entrada.
    var checkoutReserva = parseDateStr(a.checkout);
    var checkin  = parseDateStr(a.checkin);
    var checkout = parseDateStr(a.fechaAseo || a.checkout);  // día del aseo
    checkout.setHours(0, 0, 0, 0);
    checkoutReserva.setHours(0, 0, 0, 0);
    var isCancelled = a.estado === 'Cancelado';
    var isDone      = a.estado === 'Completado';
    var isToday = sameDay(checkout, hoy);
    var isPast  = checkout < hoy;
    var status  = isCancelled   ? 'cancelled'  :
                  isDone        ? 'done'        :
                  !a.asignada   ? 'unassigned'  :
                  (isToday || isPast) ? 'urgent' : 'pending';
    return {
      codigo:   a.codigo,
      prop:     a.idProp,
      checkin:  checkin,
      checkout: checkout,            // día del aseo (puede diferir de la reserva)
      checkoutReserva: checkoutReserva,  // salida real de la reserva (Airbnb)
      status:   status,
      estado:   a.estado || '',
      iniciado: a.estado === 'Iniciado',
      asignada: a.asignada || null,
      priority: isToday && !isDone,
      notas:    a.notas || '',
      precio:   a.precio || 0,
      entrada:  a.entrada || '',
      salida:   a.salida || '',
      formFilled: !!a.formFilled,
    };
  });
}

/* Transform API propiedades → frontend format */
function transformProps(apiProps) {
  return (apiProps || []).map(function(p) {
    var partes = String(p.acceso || '').split('|').map(function(s) { return s.trim(); });
    var dir = partes.filter(function(s) { return s.toLowerCase().includes('dirección') || s.toLowerCase().includes('direccion'); })[0] || partes[partes.length - 1] || '';
    var struct = p.accesoEstructurado || null;
    var direcStruct = struct && struct.direccion;
    return {
      id:       p.id,
      nombre:   p.nombre,
      barrio:   '',
      direccion: direcStruct || dir,
      precio:   p.precio || 0,
      claves:   { acceso: p.acceso || '' },
      accesoEstructurado: struct,
      icalUrls: p.icalUrls || (p.icalUrl ? [p.icalUrl] : []),
      empleadaAuto: p.empleadaAuto || '',
      mapsLink: p.mapsLink || '',
      airbnbLink: p.airbnbLink || '',
    };
  });
}

/* Transform API personal → frontend format */
function transformPersonal(apiPersonal) {
  return (apiPersonal || []).map(function(p, i) {
    return {
      codigo:  '#' + String(i + 1).padStart(4, '0'),
      nombre:  p.nombre,
      pin:     p.pin || '',
      rol:     p.rol || 'aseadora',
      tel:     p.tel || '',
      email:   p.email || '',
      cedula:       p.cedula || '',
      banco:        p.banco || '',
      tipoCuenta:   p.tipoCuenta || '',
      numeroCuenta: p.numeroCuenta || '',
      nombreCompleto: p.nombreCompleto || '',
    };
  });
}

function Login({ personalList, onLogin }) {
  const [nombre, setNombre] = useStateL('');
  const [query, setQuery]   = useStateL('');
  const [suggestOpen, setSuggestOpen] = useStateL(false);
  const [pin, setPin]       = useStateL('');
  const [error, setError]   = useStateL(false);
  const [loading, setLoading] = useStateL(false);

  const suggestions = query.trim()
    ? personalList.filter(p => p.nombre.toLowerCase().includes(query.trim().toLowerCase()))
    : personalList;

  function pickNombre(n) {
    setNombre(n); setQuery(n); setSuggestOpen(false); setPin(''); setError(false);
  }
  function onQueryChange(v) {
    setQuery(v); setSuggestOpen(true);
    const exact = personalList.find(p => p.nombre.toLowerCase() === v.trim().toLowerCase());
    if (exact) setNombre(exact.nombre);
  }

  function press(n) { setError(false); setPin(p => (p.length >= 4 ? p : p + n)); }
  function back()   { setError(false); setPin(p => p.slice(0, -1)); }

  useEffectL(() => {
    if (pin.length !== 4) return;
    setLoading(true);
    gasPost({ action: 'login', nombre, pin })
      .then(function(res) {
        setLoading(false);
        if (res.ok) {
          setTimeout(function() { onLogin(res.data); }, 160);
        } else {
          setError(true); setPin('');
        }
      })
      .catch(function() {
        setLoading(false); setError(true); setPin('');
      });
  }, [pin]);

  return (
    <div className="login">
      <div className="login-brand">
        <div className="login-mark"><Icon name="home" size={26} /></div>
        <div className="login-title">Medcon Cleanings</div>
        <div className="login-sub caption">Gestión de aseos · Medellín</div>
      </div>

      <div className="field" style={{ position: 'relative' }}>
        <label className="label field-label sec">Nombre</label>
        <div className="text-input" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="user" size={16} style={{ color: 'var(--text-tertiary)' }} />
          <input
            style={{ border: 'none', background: 'transparent', flex: 1, fontFamily: 'inherit', fontSize: 15, outline: 'none', color: 'var(--text-primary)' }}
            value={query}
            onChange={e => onQueryChange(e.target.value)}
            onFocus={() => setSuggestOpen(true)}
            onBlur={() => setTimeout(() => setSuggestOpen(false), 120)}
            placeholder="Escribe tu nombre…"
            autoComplete="off"
          />
        </div>
        {suggestOpen && suggestions.length > 0 && (
          <div className="autosuggest-list">
            {suggestions.map(p => (
              <button type="button" key={p.nombre} className="autosuggest-item"
                onMouseDown={() => pickNombre(p.nombre)}>
                {p.nombre}{p.rol === 'admin' ? ' (admin)' : ''}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="field">
        <label className="label field-label sec">PIN</label>
        <div className="pin-dots" style={error ? { animation: 'shake .35s' } : null}>
          {[0,1,2,3].map(i => <span key={i} className={'pin-dot' + (i < pin.length ? ' filled' : '')}
            style={error ? { borderColor: 'var(--accent)' } : null}></span>)}
        </div>
        {error && <div className="caption center" style={{ color: 'var(--accent)', marginBottom: 8 }}>PIN incorrecto</div>}
      </div>

      {loading
        ? <div className="caption center" style={{ padding: 24, color: 'var(--sec)' }}>Verificando…</div>
        : <div className="keypad">
            {[1,2,3,4,5,6,7,8,9].map(n => <button key={n} className="key" onClick={() => press(String(n))}>{n}</button>)}
            <button className="key blank" disabled></button>
            <button className="key" onClick={() => press('0')}>0</button>
            <button className="key" onClick={back} aria-label="Borrar"><Icon name="chevron-left" size={22} /></button>
          </div>
      }

      <div className="role-hint">
        <span className="caption">{personalList.filter(p => p.rol === 'aseadora').map(p => p.nombre).join(' · ')} son aseadoras · Admin para gestión</span>
      </div>
    </div>
  );
}

/* ============================================================
   Root App
   ============================================================ */
function App() {
  const [session, setSession]   = useStateL(loadSession);
  const [aseos, setAseos]       = useStateL(() => ASEOS.map(a => ({ ...a })));
  const [props, setProps]       = useStateL(getProps);
  const [personal, setPersonal] = useStateL(getPersonal);
  const [editProp, setEditProp] = useStateL(null);
  const [editPropOpen, setEditPropOpen]   = useStateL(false);
  const [addCleanerOpen, setAddCleanerOpen] = useStateL(false);
  const [editCleaner, setEditCleaner]       = useStateL(null);
  const [editCleanerOpen, setEditCleanerOpen] = useStateL(false);
  const [tab, setTab]           = useStateL('hoy');
  const [openId, setOpenId]     = useStateL(null);
  const [propId, setPropId]     = useStateL(null);
  const [dataLoaded, setDataLoaded] = useStateL(false);

  // "Ver como" admin impersonation — puramente en memoria, NUNCA toca
  // localStorage/sesión real. viewAs = nombre de la aseadora impersonada.
  const [viewAs, setViewAs] = useStateL(null);

  // Login screen state
  const [personalList, setPersonalList] = useStateL([]);
  const [loadingPersonal, setLoadingPersonal] = useStateL(true);

  // sheets
  const [completar, setCompletar]       = useStateL(null);
  const [completarOpen, setCompletarOpen] = useStateL(false);
  const [reassign, setReassign]         = useStateL(null);
  const [reassignOpen, setReassignOpen] = useStateL(false);
  const [moverFecha, setMoverFecha]     = useStateL(null);
  const [moverFechaOpen, setMoverFechaOpen] = useStateL(false);
  const [agregarOpen, setAgregarOpen]   = useStateL(false);

  // calendar
  const [calMonth, setCalMonth] = useStateL(TODAY.getMonth());
  const [calYear, setCalYear]   = useStateL(TODAY.getFullYear());
  const [calSel, setCalSel]     = useStateL(TODAY);

  // admin filters
  const [filter, setFilter] = useStateL({ estado: 'all', aseadora: null });

  // toast + sync indicator
  const [toast, setToast]       = useStateL(null);
  const [syncing, setSyncing]   = useStateL(false);
  const [lastSync, setLastSync] = useStateL(null);
  function showToast(msg) { setToast(msg); setTimeout(() => setToast(null), 2200); }

  // Fetch personal list on mount for login dropdown
  useEffectL(function() {
    gasPost({ action: 'getPersonal' })
      .then(function(res) {
        if (res.ok && res.data && res.data.length) {
          setPersonalList(res.data);
        } else {
          // Fallback to hardcoded
          setPersonalList(getPersonal().map(p => ({ nombre: p.nombre, rol: p.rol })));
        }
        setLoadingPersonal(false);
      })
      .catch(function() {
        setPersonalList(getPersonal().map(p => ({ nombre: p.nombre, rol: p.rol })));
        setLoadingPersonal(false);
      });
  }, []);

  function loadDataFor(nombre, rol) {
    setSyncing(true);
    return gasPost({ action: 'getDatos', nombre: nombre, rol: rol })
      .then(function(res) {
        if (res.ok && res.data) {
          const realAseos    = transformAseos(res.data.aseos);
          const realProps    = transformProps(res.data.propiedades);
          const realPersonal = transformPersonal(res.data.personal);
          setAseos(realAseos);
          setLiveProps(realProps); setProps(realProps);
          setLivePersonal(realPersonal); setPersonal(realPersonal);
          setLastSync(new Date());
        }
      })
      .catch(function() {})
      .finally(function() { setSyncing(false); setDataLoaded(true); });
  }

  function doIniciar(a) {
    const prev = aseos;
    setAseos(list => list.map(x => x.codigo === a.codigo ? { ...x, iniciado: true } : x));
    return gasPost({ action: 'iniciarAseo', codigo: a.codigo, nombre: a.asignada || '' })
      .then(res => {
        if (!res || !res.ok) {
          setAseos(prev);
          showToast('Error: ' + ((res && res.error) || 'sin conexión'));
        }
      })
      .catch(() => {
        setAseos(prev);
        showToast('Error de conexión, no se guardó');
      });
  }

  // Ver como <aseadora>: entra/sale de la vista de una aseadora sin tocar la
  // sesión real. Las acciones que tome dentro SÍ pegan al backend real.
  function startViewAs(nombre) { setViewAs(nombre); setTab('hoy'); setOpenId(null); setPropId(null); }
  function exitViewAs() { setViewAs(null); setTab('aseos'); setOpenId(null); setPropId(null); }

  function login(userInfo) {
    const nombre = userInfo.nombre;
    const rol    = userInfo.rol;
    saveSession(userInfo);
    setSession(userInfo);
    setTab(rol === 'admin' ? 'aseos' : 'hoy');
    setOpenId(null); setPropId(null);
    loadDataFor(nombre, rol);
  }
  function logout() { clearSession(); setSession(null); }

  // Rehydrate: if a session was restored from localStorage on mount, fetch fresh data
  useEffectL(function() {
    if (session && session.nombre && session.rol) {
      loadDataFor(session.nombre, session.rol);
      setTab(session.rol === 'admin' ? 'aseos' : 'hoy');
    }
  // eslint-disable-next-line
  }, []);

  function toggle(id) { setOpenId(o => o === id ? null : id); }
  function shiftMonth(dir) {
    let m = calMonth + dir, y = calYear;
    if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; }
    setCalMonth(m); setCalYear(y);
  }
  function goToAseo(a) { setTab(session.rol === 'admin' ? 'aseos' : 'hoy'); setOpenId(a.codigo); }

  // actions
  // Nunca abrir el sheet sin aseo: un `a` undefined dejaba el sheet
  // renderizado en blanco (body vacío) pero con el footer activo.
  function openCompletar(a) { if (!a) return; setCompletar(a); setCompletarOpen(true); }

  // Red de seguridad: si por cualquier vía el sheet quedó abierto sin aseo
  // (desincronización de estado tras un refresh/error), cerrarlo.
  useEffectL(function() {
    if (completarOpen && !completar) setCompletarOpen(false);
  }, [completarOpen, completar]);
  function doneCompletar(a, payload) {
    // El completador es la aseadora ASIGNADA (así pasa la validación del backend
    // y se le cuenta el pago), no quien tiene la sesión abierta. Si el admin
    // completa un aseo sin asignar, va como "No asignado" (sin pago).
    const esAdmin = session.rol === 'admin';
    const nombreCompletar = a.asignada || (esAdmin ? '' : session.nombre);
    const sinAsignar = esAdmin && !a.asignada;

    const prev = aseos;
    setAseos(list => list.map(x => x.codigo === a.codigo
      ? { ...x, status: 'done', completadoEl: TODAY, tipo: x.tipo || 'Full',
          asignada: sinAsignar ? 'No asignado' : x.asignada,
          notas: payload.notas || x.notas,
          entrada: payload.entrada, salida: payload.salida,
          revision: payload.revision, reposicion: payload.reposicion,
          funcionamiento: payload.funcionamiento, reporte: payload.reporte,
          video: payload.file && payload.file.name }
      : x));
    setCompletarOpen(false); setOpenId(null);

    // Save full form to Google Sheets (cols 14-20 via handleCompletarAseo)
    gasPost({
      action:    'completarAseo',
      codigo:    a.codigo,
      nombre:    nombreCompletar,
      sinAsignar: sinAsignar || undefined,
      notas:     payload.notas || '',
      entrada:   payload.entrada || '',
      salida:    payload.salida || '',
      revision:       payload.revision || null,
      reposicion:     payload.reposicion || null,
      funcionamiento: payload.funcionamiento || null,
      reporte:   payload.reporte || '',
      videoLink: (payload.file && (payload.file.link || payload.file.name)) || '',
    }).then(res => {
      if (!res || !res.ok) {
        setAseos(prev);
        showToast('Error al guardar: ' + ((res && res.error) || 'sin conexión'));
      }
    }).catch(() => { setAseos(prev); showToast('Error de conexión, no se guardó'); });

    const flags = flaggedAreas({ revision: payload.revision, funcionamiento: payload.funcionamiento, reposicion: payload.reposicion });
    showToast(flags.length ? 'Aseo completado · ' + flags.length + ' por revisar' : 'Aseo completado');
  }
  function doFinalizarSinForm(a) {
    const sinAsignar = !a.asignada;
    const propNombre = propById(a.prop)?.nombre || a.codigo;
    const msg = sinAsignar
      ? 'Marcar "' + propNombre + '" como hecho SIN asignar?\n\nQuedará como "No asignado" y no se suma a ninguna aseadora ni a ningún pago.'
      : 'Marcar "' + propNombre + '" como Finalizado sin llenar el form?\n\nÚsalo para aseos viejos o cuando la aseadora no llenó el form.';
    if (!confirm(msg)) return;

    const prev = aseos;
    setAseos(list => list.map(x => x.codigo === a.codigo
      ? { ...x, status: 'done', completadoEl: a.checkout, tipo: 'Sin form',
          asignada: sinAsignar ? 'No asignado' : x.asignada,
          precio: sinAsignar ? 0 : x.precio }
      : x));
    showToast('Marcando…');

    const payload = sinAsignar
      ? { action: 'completarAseo', codigo: a.codigo, sinAsignar: true }
      : { action: 'completarAseo', codigo: a.codigo, nombre: a.asignada };
    gasPost(payload)
      .then(res => {
        if (res && res.ok) showToast('Marcado finalizado');
        else {
          setAseos(prev);
          showToast('Error: ' + ((res && res.error) || 'sin conexión'));
        }
      })
      .catch(() => {
        setAseos(prev);
        showToast('Error de conexión');
      });
  }

  function openReassign(a) { setReassign(a); setReassignOpen(true); }
  function openMoverFecha(a) { setMoverFecha(a); setMoverFechaOpen(true); }
  function doMoverFecha(a, fechaIso) {
    // fechaIso = "yyyy-MM-dd" → dd/MM/yyyy
    const [y, m, dd] = fechaIso.split('-').map(Number);
    const nuevaFechaStr = String(dd).padStart(2, '0') + '/' + String(m).padStart(2, '0') + '/' + y;
    const nuevaDate = new Date(y, m - 1, dd);

    const prev = aseos;
    setAseos(list => list.map(x => x.codigo === a.codigo
      ? { ...x, checkout: nuevaDate,   // solo el día del aseo; check-in/out reales intactos
          status: x.status === 'done' ? 'done'
                  : !x.asignada ? 'unassigned'
                  : sameDay(nuevaDate, TODAY) ? 'urgent' : 'pending',
          priority: sameDay(nuevaDate, TODAY) && x.status !== 'done' }
      : x));
    setMoverFechaOpen(false);
    showToast('Cambiando fecha…');

    gasPost({ action: 'moverAseo', codigo: a.codigo, nuevaFecha: nuevaFechaStr })
      .then(res => {
        if (res && res.ok) showToast('Fecha actualizada');
        else {
          setAseos(prev);
          showToast('Error: ' + ((res && res.error) || 'sin conexión'));
        }
      })
      .catch(() => {
        setAseos(prev);
        showToast('Error de conexión');
      });
  }
  function doAssign(a, who) {
    setAseos(list => list.map(x => x.codigo === a.codigo
      ? { ...x, asignada: who, status: who ? (x.status === 'unassigned' ? (sameDay(x.checkout, TODAY) ? 'urgent' : 'pending') : x.status) : 'unassigned' }
      : x));
    setReassignOpen(false);
    showToast(who ? 'Asignado a ' + who : 'Aseo sin asignar');

    // Persist to spreadsheet (Fase 6)
    gasPost({ action: 'asignarAseo', codigo: a.codigo, aseadora: who || '' })
      .then(function(res) {
        if (!res || !res.ok) {
          // Roll back UI on failure
          setAseos(list => list.map(x => x.codigo === a.codigo ? { ...x, asignada: a.asignada || null } : x));
          showToast('Error guardando: ' + ((res && res.error) || 'sin conexión'));
        }
      })
      .catch(function() {
        setAseos(list => list.map(x => x.codigo === a.codigo ? { ...x, asignada: a.asignada || null } : x));
        showToast('Error de conexión, no se guardó');
      });
  }
  function openEditProp(id) { setEditProp(props.find(p => p.id === id) || null); setEditPropOpen(true); }
  function doDeleteProp(id) {
    const target = props.find(p => p.id === id);
    if (!target) return;
    const linked = aseos.filter(a => a.prop === id).length;
    const msg = 'Archivar la propiedad "' + target.nombre + '" (' + id + ')?\n\n' +
      'Se oculta de la app y deja de sincronizarse desde Airbnb. Todos los datos se conservan en el spreadsheet (col I "Activa" = FALSE).' +
      (linked > 0
        ? ('\n\n' + linked + ' aseo(s) ya creados se quedan como historial.')
        : '') +
      '\n\nPara reactivarla después: marca la casilla Activa de esa fila en el spreadsheet.';
    if (!confirm(msg)) return;

    const prev = props;
    const next = props.filter(p => p.id !== id);
    setLiveProps(next); setProps(next);
    setPropId(null); // cerrar el detalle
    showToast('Archivando…');

    gasPost({ action: 'eliminarPropiedad', id: id })
      .then(res => {
        if (res && res.ok) showToast('Propiedad archivada');
        else {
          setLiveProps(prev); setProps(prev);
          showToast('Error: ' + ((res && res.error) || 'sin conexión'));
        }
      })
      .catch(() => {
        setLiveProps(prev); setProps(prev);
        showToast('Error de conexión, no se archivó');
      });
  }
  function openAddProp() { setEditProp(null); setEditPropOpen(true); }
  function doSaveProp(oldId, datos) {
    const icalUrls = datos.icalUrls || [];
    if (oldId == null) {
      // Alta — optimista local + persistir en backend
      const prev = props;
      const nuevo = {
        id: datos.id, nombre: datos.nombre, barrio: '', direccion: datos.direccion,
        precio: datos.precio,
        claves: { acceso: datos.acceso || '' },
        accesoEstructurado: datos.accesoEstructurado || null,
        icalUrls: icalUrls,
        mapsLink: datos.mapsLink || '', airbnbLink: datos.airbnbLink || '',
      };
      const next = [...props, nuevo];
      setLiveProps(next); setProps(next);
      setEditPropOpen(false);
      showToast('Creando propiedad…');
      gasPost({
        action: 'agregarPropiedad',
        datos: {
          nombre: datos.nombre,
          precioAseo: datos.precio,
          acceso: datos.acceso,
          accesoEstructurado: datos.accesoEstructurado,
          icalUrls: icalUrls,
          mapsLink: datos.mapsLink || '',
          airbnbLink: datos.airbnbLink || '',
        },
      }).then(res => {
        if (res && res.ok) {
          showToast('Propiedad creada · ' + (res.data && res.data.id || datos.id));
          loadDataFor(session.nombre, session.rol);
        } else {
          setLiveProps(prev); setProps(prev);
          showToast('Error creando: ' + ((res && res.error) || 'sin conexión'));
        }
      }).catch(() => {
        setLiveProps(prev); setProps(prev);
        showToast('Error de conexión, no se creó');
      });
      return;
    }

    // Optimistic update local
    const prev = props;
    const next = props.map(p => p.id === oldId
      ? {
          ...p,
          nombre: datos.nombre,
          direccion: datos.direccion,
          precio: datos.precio,
          claves: { ...p.claves, acceso: datos.acceso },
          accesoEstructurado: datos.accesoEstructurado || null,
          icalUrls: icalUrls,
          mapsLink: datos.mapsLink || '', airbnbLink: datos.airbnbLink || '',
        }
      : p);
    setLiveProps(next);
    setProps(next);
    setEditPropOpen(false);
    showToast('Guardando…');

    // Persistir vía API
    gasPost({
      action: 'actualizarPropiedad',
      id: oldId,
      datos: {
        nombre: datos.nombre,
        precioAseo: datos.precio,
        acceso: datos.acceso,
        accesoEstructurado: datos.accesoEstructurado,
        icalUrls: icalUrls,
        mapsLink: datos.mapsLink || '',
        airbnbLink: datos.airbnbLink || '',
      },
    }).then(res => {
      if (res && res.ok) showToast('Propiedad actualizada');
      else {
        setLiveProps(prev); setProps(prev);
        showToast('Error guardando: ' + ((res && res.error) || 'sin conexión'));
      }
    }).catch(() => {
      setLiveProps(prev); setProps(prev);
      showToast('Error de conexión, no se guardó');
    });
  }

  function openAddCleaner() { setAddCleanerOpen(true); }
  function doAddCleaner(datos) {
    const nueva = { codigo: nextPersonalId(), nombre: datos.nombre, pin: datos.pin, rol: 'aseadora', tel: datos.tel, email: datos.email };
    const next = [...personal, nueva];
    setLivePersonal(next); setPersonal(next);
    setAddCleanerOpen(false);
    showToast('Aseadora creada · ' + nueva.codigo);
  }
  function openEditCleaner(persona) { setEditCleaner(persona); setEditCleanerOpen(true); }
  function doSaveCleaner(persona, cambios) {
    const next = personal.map(p => p.nombre === persona.nombre
      ? { ...p, pin: cambios.pin || p.pin, tel: cambios.tel, email: cambios.email,
          cedula: cambios.cedula, banco: cambios.banco, tipoCuenta: cambios.tipoCuenta, numeroCuenta: cambios.numeroCuenta,
          nombreCompleto: cambios.nombreCompleto }
      : p);
    setLivePersonal(next); setPersonal(next);
    setEditCleanerOpen(false);
    showToast('Guardando…');

    gasPost({
      action: 'actualizarPersonal',
      nombre: persona.nombre,
      datos: {
        pin:      cambios.pin || persona.pin,
        telefono: cambios.tel,
        email:    cambios.email,
        cedula:       cambios.cedula,
        banco:        cambios.banco,
        tipoCuenta:   cambios.tipoCuenta,
        numeroCuenta: cambios.numeroCuenta,
        nombreCompleto: cambios.nombreCompleto,
      }
    }).then(res => {
      if (res && res.ok) showToast('Datos guardados');
      else {
        // rollback
        setLivePersonal(personal); setPersonal(personal);
        showToast('Error guardando: ' + ((res && res.error) || 'sin conexión'));
      }
    }).catch(() => {
      setLivePersonal(personal); setPersonal(personal);
      showToast('Error de conexión, no se guardó');
    });
  }

  function doAgregar(data) {
    const prop = propById(data.propId);
    if (!prop) { showToast('Propiedad no encontrada'); return; }

    // Convert yyyy-MM-dd (input HTML) → dd/MM/yyyy (formato spreadsheet)
    const [y, m, dd] = data.fecha.split('-').map(Number);
    const co = new Date(y, m - 1, dd);
    const checkoutStr = String(dd).padStart(2, '0') + '/' + String(m).padStart(2, '0') + '/' + y;

    // Optimistic insert con código temporal; el backend devuelve el código real
    const tmpCodigo = 'PENDING-' + Date.now();
    const optimistic = {
      codigo: tmpCodigo,
      prop: data.propId, checkin: co, checkout: co, checkoutReserva: co,
      status: data.asignada ? (sameDay(co, TODAY) ? 'urgent' : 'pending') : 'unassigned',
      asignada: data.asignada, priority: false,
      notas: data.notas, precio: data.precio, tipo: data.tipo,
      entrada: '', salida: '', formFilled: false,
    };
    setAseos(list => [...list, optimistic]);
    setAgregarOpen(false);
    showToast('Guardando…');

    gasPost({
      action: 'agregarAseo',
      propiedad: prop.nombre,
      idProp:    data.propId,
      checkout:  checkoutStr,
      aseadora:  data.asignada || '',
      precio:    data.precio || 0,
      notas:     data.notas || '',
      codigo:    data.codigo || '',
      // backend completa acceso desde la propiedad si no lo mandamos
    }).then(res => {
      if (res && res.ok && res.data) {
        // Reemplazar el optimistic con los datos reales del backend
        const realCodigo = res.data.codigo;
        setAseos(list => list.map(a => a.codigo === tmpCodigo
          ? { ...a, codigo: realCodigo }
          : a));
        showToast('Aseo manual creado · ' + realCodigo);
      } else {
        // Rollback
        setAseos(list => list.filter(a => a.codigo !== tmpCodigo));
        showToast('Error guardando: ' + ((res && res.error) || 'sin conexión'));
      }
    }).catch(() => {
      setAseos(list => list.filter(a => a.codigo !== tmpCodigo));
      showToast('Error de conexión, no se guardó');
    });
  }

  // Loading screen while fetching personal list (skip if session already restored)
  if (loadingPersonal && !session) {
    return (
      <div className="stage">
        <div className="screen" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
          <div className="login-mark"><Icon name="home" size={26} /></div>
          <div className="login-title">Medcon Cleanings</div>
          <LoadingState label="Conectando…" />
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="stage">
        <div className="screen">
          <Login personalList={personalList} onLogin={login} />
        </div>
      </div>
    );
  }

  const realIsAdmin = session.rol === 'admin';
  // Mientras se está "Viendo como <aseadora>", la app se comporta como si
  // esa aseadora hubiera iniciado sesión (mismo rol/nombre para pantallas y
  // llamadas a la API), pero session/localStorage NO cambian.
  const isAdmin = realIsAdmin && !viewAs;
  const effectiveUser = viewAs || session.nombre;
  const ctx = {
    user: effectiveUser, aseos, props, personal, openId, toggle, logout,
    openCompletar, openReassign, openProp: (id) => setPropId(id), closeProp: () => setPropId(null),
    openEditProp, openAddProp, openAddCleaner, openEditCleaner,
    openMoverFecha, doIniciar,
    doFinalizarSinForm, doDeleteProp,
    calMonth, calYear, calSel, setCalSel, shiftMonth, goToAseo,
    filter, setFilter,
    openSync: () => {
      if (syncing) return;
      loadDataFor(effectiveUser, isAdmin ? 'admin' : 'aseadora').then(() => showToast('Datos actualizados'));
    },
    syncing,
    lastSync,
    dataLoaded,
    viewAs, startViewAs, exitViewAs,
  };

  // urgent count for nav badge
  const urgentMine = aseos.filter(a => (isAdmin ? true : a.asignada === effectiveUser) && (a.status === 'urgent' || a.priority) && a.status !== 'done').length;

  const cleanerTabs = [
    { id: 'hoy', label: 'Aseos', icon: 'list', badge: urgentMine || null },
    { id: 'calendario', label: 'Calendario', icon: 'calendar' },
    { id: 'historial', label: 'Historial', icon: 'check' },
  ];
  const adminTabs = [
    { id: 'aseos', label: 'Aseos', icon: 'list', badge: urgentMine || null },
    { id: 'historial', label: 'Historial', icon: 'check' },
    { id: 'calendario', label: 'Calendario', icon: 'calendar' },
    { id: 'propiedades', label: 'Propiedades', icon: 'home' },
    { id: 'personal', label: 'Personal', icon: 'users' },
  ];

  let screen;
  if (propId && isAdmin) {
    screen = <PropiedadDetail ctx={ctx} propId={propId} />;
  } else if (isAdmin) {
    if (tab === 'aseos') screen = <AseosScreen ctx={ctx} />;
    else if (tab === 'historial') screen = <HistorialAdminScreen ctx={ctx} />;
    else if (tab === 'calendario') screen = <CalendarioScreen ctx={ctx} role="admin" />;
    else if (tab === 'propiedades') screen = <PropiedadesScreen ctx={ctx} />;
    else screen = <PersonalScreen ctx={ctx} />;
  } else {
    if (tab === 'hoy') screen = <HoyScreen ctx={ctx} />;
    else if (tab === 'calendario') screen = <CalendarioScreen ctx={ctx} role="aseadora" />;
    else screen = <HistorialScreen ctx={ctx} />;
  }

  return (
    <div className="stage">
      <div className="screen">
        {viewAs && (
          <div className="viewas-banner">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Icon name="eye" size={16} /> Viendo como {viewAs} — las acciones que tomes aquí son reales y se guardan en el sistema.
            </span>
            <button className="btn btn-ghost" style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.5)' }} onClick={exitViewAs}>Salir</button>
          </div>
        )}
        {screen}

        {isAdmin && tab === 'aseos' && !propId && (
          <button className="fab" onClick={() => setAgregarOpen(true)} aria-label="Agregar aseo"><Icon name="plus" size={24} /></button>
        )}
        {isAdmin && tab === 'propiedades' && !propId && (
          <button className="fab" onClick={openAddProp} aria-label="Agregar propiedad"><Icon name="plus" size={24} /></button>
        )}
        {isAdmin && tab === 'personal' && (
          <button className="fab" onClick={openAddCleaner} aria-label="Agregar aseadora"><Icon name="plus" size={24} /></button>
        )}

        <BottomNav tabs={isAdmin ? adminTabs : cleanerTabs} active={tab}
          onChange={(t) => { setTab(t); setPropId(null); setOpenId(null); }} />

        {/* Las aseadoras solo pueden completar sus aseos. El resto de hojas
            (reasignar, mover fecha, agregar aseo/propiedad/aseadora) son
            exclusivas de admin y ni siquiera se montan para aseadoras. */}
        <CompletarSheet open={completarOpen} aseo={completar} onClose={() => setCompletarOpen(false)} onDone={doneCompletar} />
        {isAdmin && (
          <React.Fragment>
            <ReassignSheet open={reassignOpen} aseo={reassign} onClose={() => setReassignOpen(false)} onAssign={doAssign} />
            <MoverFechaSheet open={moverFechaOpen} aseo={moverFecha} onClose={() => setMoverFechaOpen(false)} onSave={doMoverFecha} />
            <AgregarAseoSheet open={agregarOpen} onClose={() => setAgregarOpen(false)} onAdd={doAgregar} />
            <EditarPropiedadSheet open={editPropOpen} prop={editProp} onClose={() => setEditPropOpen(false)} onSave={doSaveProp} />
            <AgregarAseadoraSheet open={addCleanerOpen} onClose={() => setAddCleanerOpen(false)} onAdd={doAddCleaner} />
            <EditarAseadoraSheet open={editCleanerOpen} persona={editCleaner} onClose={() => setEditCleanerOpen(false)} onSave={doSaveCleaner} />
          </React.Fragment>
        )}

        {toast && <div className="toast">{toast}</div>}
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <ErrorBoundary><App /></ErrorBoundary>
);
