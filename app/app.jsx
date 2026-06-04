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
  return (apiAseos || []).map(function(a) {
    var checkout = parseDateStr(a.checkout);
    var checkin  = parseDateStr(a.checkin);
    checkout.setHours(0, 0, 0, 0);
    var isDone = a.estado === 'Completado' || a.estado === 'Cancelado';
    var isToday = sameDay(checkout, hoy);
    var isPast  = checkout < hoy;
    var status  = isDone        ? 'done'       :
                  !a.asignada   ? 'unassigned' :
                  (isToday || isPast) ? 'urgent' : 'pending';
    return {
      codigo:   a.codigo,
      prop:     a.idProp,
      checkin:  checkin,
      checkout: checkout,
      status:   status,
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
    };
  });
}

function Login({ personalList, onLogin }) {
  const [nombre, setNombre] = useStateL(personalList.length ? personalList[0].nombre : '');
  const [pin, setPin]       = useStateL('');
  const [error, setError]   = useStateL(false);
  const [loading, setLoading] = useStateL(false);

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

      <div className="field">
        <label className="label field-label sec">Nombre</label>
        <div className="select">
          <select value={nombre} onChange={e => { setNombre(e.target.value); setPin(''); setError(false); }}>
            {personalList.map(p => <option key={p.nombre} value={p.nombre}>{p.nombre}{p.rol === 'admin' ? ' (admin)' : ''}</option>)}
          </select>
          <Icon name="chevron-down" size={20} className="chev" />
        </div>
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

  // Login screen state
  const [personalList, setPersonalList] = useStateL([]);
  const [loadingPersonal, setLoadingPersonal] = useStateL(true);

  // sheets
  const [completar, setCompletar]       = useStateL(null);
  const [completarOpen, setCompletarOpen] = useStateL(false);
  const [reassign, setReassign]         = useStateL(null);
  const [reassignOpen, setReassignOpen] = useStateL(false);
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
      .finally(function() { setSyncing(false); });
  }

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
  function openCompletar(a) { setCompletar(a); setCompletarOpen(true); }
  function doneCompletar(a, payload) {
    setAseos(list => list.map(x => x.codigo === a.codigo
      ? { ...x, status: 'done', completadoEl: TODAY, tipo: x.tipo || 'Full',
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
      nombre:    session.nombre,
      notas:     payload.notas || '',
      entrada:   payload.entrada || '',
      salida:    payload.salida || '',
      revision:       payload.revision || null,
      reposicion:     payload.reposicion || null,
      funcionamiento: payload.funcionamiento || null,
      reporte:   payload.reporte || '',
      videoLink: (payload.file && (payload.file.link || payload.file.name)) || '',
    }).catch(function() {});

    const flags = flaggedAreas({ revision: payload.revision, funcionamiento: payload.funcionamiento, reposicion: payload.reposicion });
    showToast(flags.length ? 'Aseo completado · ' + flags.length + ' por revisar' : 'Aseo completado');
  }
  function doFinalizarSinForm(a) {
    if (!a.asignada) { showToast('Asigna una aseadora primero'); return; }
    if (!confirm('Marcar "' + (propById(a.prop)?.nombre || a.codigo) + '" como Finalizado sin llenar el form?\n\nÚsalo para aseos viejos o cuando la aseadora no llenó el form.')) return;

    const prev = aseos;
    setAseos(list => list.map(x => x.codigo === a.codigo
      ? { ...x, status: 'done', completadoEl: a.checkout, tipo: 'Sin form' }
      : x));
    showToast('Marcando finalizado…');

    gasPost({ action: 'completarAseo', codigo: a.codigo, nombre: a.asignada })
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
    const msg = 'Eliminar la propiedad "' + target.nombre + '" (' + id + ')?\n\n' +
      (linked > 0
        ? ('Hay ' + linked + ' aseo(s) ligados a esta propiedad. Quedarán como historial sin propiedad asociada (no se borran).\n\n')
        : '') +
      'La carpeta de Drive y los videos NO se borran. El iCal de Airbnb deja de sincronizarse.\n\n' +
      'Esta acción no se puede deshacer.';
    if (!confirm(msg)) return;

    const prev = props;
    const next = props.filter(p => p.id !== id);
    setLiveProps(next); setProps(next);
    setPropId(null); // cerrar el detalle
    showToast('Eliminando…');

    gasPost({ action: 'eliminarPropiedad', id: id })
      .then(res => {
        if (res && res.ok) showToast('Propiedad eliminada');
        else {
          setLiveProps(prev); setProps(prev);
          showToast('Error: ' + ((res && res.error) || 'sin conexión'));
        }
      })
      .catch(() => {
        setLiveProps(prev); setProps(prev);
        showToast('Error de conexión, no se eliminó');
      });
  }
  function openAddProp() { setEditProp(null); setEditPropOpen(true); }
  function doSaveProp(oldId, datos) {
    if (oldId == null) {
      // Alta (no implementada en backend desde la app). Mantener local.
      const nuevo = {
        id: datos.id, nombre: datos.nombre, barrio: '', direccion: datos.direccion,
        precio: datos.precio,
        claves: { acceso: datos.acceso || '' },
        accesoEstructurado: datos.accesoEstructurado || null,
        ical: datos.ical
      };
      const next = [...props, nuevo];
      setLiveProps(next); setProps(next);
      setEditPropOpen(false);
      showToast('Propiedad creada · ' + datos.id);
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
        icalUrl: datos.ical,
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
      ? { ...p, pin: cambios.pin || p.pin, tel: cambios.tel, email: cambios.email }
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
    const [y, m, dd] = data.fecha.split('-').map(Number);
    const co = new Date(y, m - 1, dd);
    const nuevo = {
      codigo: 'HM' + String(Math.floor(Math.random()*9000)+1000),
      prop: data.propId, checkin: co, checkout: co,
      status: data.asignada ? (sameDay(co, TODAY) ? 'urgent' : 'pending') : 'unassigned',
      asignada: data.asignada, priority: false, notas: data.notas, precio: data.precio, tipo: data.tipo,
    };
    setAseos(list => [...list, nuevo]);
    setAgregarOpen(false);
    showToast('Aseo agregado · ' + prop.nombre);
  }

  // Loading screen while fetching personal list (skip if session already restored)
  if (loadingPersonal && !session) {
    return (
      <div className="stage">
        <div className="screen" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
          <div className="login-mark"><Icon name="home" size={26} /></div>
          <div className="login-title">Medcon Cleanings</div>
          <div className="caption sec">Conectando…</div>
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

  const isAdmin = session.rol === 'admin';
  const ctx = {
    user: session.nombre, aseos, props, personal, openId, toggle, logout,
    openCompletar, openReassign, openProp: (id) => setPropId(id), closeProp: () => setPropId(null),
    openEditProp, openAddProp, openAddCleaner, openEditCleaner,
    doFinalizarSinForm, doDeleteProp,
    calMonth, calYear, calSel, setCalSel, shiftMonth, goToAseo,
    filter, setFilter,
    openSync: () => {
      if (syncing) return;
      loadDataFor(session.nombre, session.rol).then(() => showToast('Datos actualizados'));
    },
    syncing,
    lastSync,
  };

  // urgent count for nav badge
  const urgentMine = aseos.filter(a => (isAdmin ? true : a.asignada === session.nombre) && (a.status === 'urgent' || a.priority) && a.status !== 'done').length;

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

        <CompletarSheet open={completarOpen} aseo={completar} onClose={() => setCompletarOpen(false)} onDone={doneCompletar} />
        <ReassignSheet open={reassignOpen} aseo={reassign} onClose={() => setReassignOpen(false)} onAssign={doAssign} />
        <AgregarAseoSheet open={agregarOpen} onClose={() => setAgregarOpen(false)} onAdd={doAgregar} />
        <EditarPropiedadSheet open={editPropOpen} prop={editProp} onClose={() => setEditPropOpen(false)} onSave={doSaveProp} />
        <AgregarAseadoraSheet open={addCleanerOpen} onClose={() => setAddCleanerOpen(false)} onAdd={doAddCleaner} />
        <EditarAseadoraSheet open={editCleanerOpen} persona={editCleaner} onClose={() => setEditCleanerOpen(false)} onSave={doSaveCleaner} />

        {toast && <div className="toast">{toast}</div>}
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <ErrorBoundary><App /></ErrorBoundary>
);
