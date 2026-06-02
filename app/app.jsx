/* ============================================================
   Login — name dropdown + PIN dots + on-screen keypad
   ============================================================ */
const { useState: useStateL } = React;

function Login({ onLogin }) {
  const [nombre, setNombre] = useStateL(getPersonal()[0].nombre);
  const [pin, setPin] = useStateL('');
  const [error, setError] = useStateL(false);

  function press(n) {
    setError(false);
    setPin(p => (p.length >= 4 ? p : p + n));
  }
  function back() { setError(false); setPin(p => p.slice(0, -1)); }

  React.useEffect(() => {
    if (pin.length !== 4) return;
    const user = getPersonal().find(p => p.nombre === nombre && p.pin === pin);
    if (user) { const t = setTimeout(() => onLogin(user), 160); return () => clearTimeout(t); }
    const t = setTimeout(() => { setError(true); setPin(''); }, 200);
    return () => clearTimeout(t);
  }, [pin, nombre]);

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
            {getPersonal().map(p => <option key={p.nombre} value={p.nombre}>{p.nombre}{p.rol === 'admin' ? ' (admin)' : ''}</option>)}
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

      <div className="keypad">
        {[1,2,3,4,5,6,7,8,9].map(n => <button key={n} className="key" onClick={() => press(String(n))}>{n}</button>)}
        <button className="key blank" disabled></button>
        <button className="key" onClick={() => press('0')}>0</button>
        <button className="key" onClick={back} aria-label="Borrar"><Icon name="chevron-left" size={22} /></button>
      </div>

      <div className="role-hint">
        <span className="caption">{getPersonal().filter(p => p.rol === 'aseadora').map(p => p.nombre).join(' · ')} son aseadoras · Admin para gestión</span>
      </div>
    </div>
  );
}

/* ============================================================
   Root App
   ============================================================ */
function App() {
  const [session, setSession] = useStateL(null);     // PERSONAL entry
  const [aseos, setAseos] = useStateL(() => ASEOS.map(a => ({ ...a })));
  const [props, setProps] = useStateL(getProps);
  const [personal, setPersonal] = useStateL(getPersonal);
  const [editProp, setEditProp] = useStateL(null);
  const [editPropOpen, setEditPropOpen] = useStateL(false);
  const [addCleanerOpen, setAddCleanerOpen] = useStateL(false);
  const [tab, setTab] = useStateL('hoy');
  const [openId, setOpenId] = useStateL(null);
  const [propId, setPropId] = useStateL(null);

  // sheets
  const [completar, setCompletar] = useStateL(null);
  const [completarOpen, setCompletarOpen] = useStateL(false);
  const [reassign, setReassign] = useStateL(null);
  const [reassignOpen, setReassignOpen] = useStateL(false);
  const [agregarOpen, setAgregarOpen] = useStateL(false);

  // calendar
  const [calMonth, setCalMonth] = useStateL(TODAY.getMonth());
  const [calYear, setCalYear] = useStateL(TODAY.getFullYear());
  const [calSel, setCalSel] = useStateL(TODAY);

  // admin filters
  const [filter, setFilter] = useStateL({ estado: 'all', aseadora: null });

  // toast
  const [toast, setToast] = useStateL(null);
  function showToast(msg) { setToast(msg); setTimeout(() => setToast(null), 2200); }

  function login(user) {
    setSession(user);
    setTab(user.rol === 'admin' ? 'aseos' : 'hoy');
    setOpenId(null); setPropId(null);
  }
  function logout() { setSession(null); }

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
    const flags = flaggedAreas({ revision: payload.revision, funcionamiento: payload.funcionamiento, reposicion: payload.reposicion });
    showToast(flags.length ? 'Aseo completado · ' + flags.length + ' por revisar' : 'Aseo completado');
  }
  function openReassign(a) { setReassign(a); setReassignOpen(true); }
  function doAssign(a, who) {
    setAseos(list => list.map(x => x.codigo === a.codigo
      ? { ...x, asignada: who, status: who ? (x.status === 'unassigned' ? (sameDay(x.checkout, TODAY) ? 'urgent' : 'pending') : x.status) : 'unassigned' }
      : x));
    setReassignOpen(false);
    showToast(who ? 'Asignado a ' + who : 'Aseo sin asignar');
  }
  function openEditProp(id) { setEditProp(props.find(p => p.id === id) || null); setEditPropOpen(true); }
  function openAddProp() { setEditProp(null); setEditPropOpen(true); }
  function doSaveProp(oldId, datos) {
    if (oldId == null) {
      const nuevo = { id: datos.id, nombre: datos.nombre, barrio: datos.barrio, direccion: datos.direccion, precio: datos.precio, claves: { ...datos.claves }, ical: datos.ical };
      const next = [...props, nuevo];
      setLiveProps(next); setProps(next);
      setEditPropOpen(false);
      showToast('Propiedad creada · ' + datos.id);
      return;
    }
    const next = props.map(p => p.id === oldId
      ? { ...p, ...datos, claves: { ...p.claves, ...(datos.claves || {}) } }
      : p);
    setLiveProps(next);
    setProps(next);
    if (datos.id && datos.id !== oldId) {
      setAseos(list => list.map(a => a.prop === oldId ? { ...a, prop: datos.id } : a));
      setPropId(datos.id);
    }
    setEditPropOpen(false);
    showToast('Propiedad actualizada');
  }

  function openAddCleaner() { setAddCleanerOpen(true); }
  function doAddCleaner(datos) {
    const nueva = { codigo: nextPersonalId(), nombre: datos.nombre, pin: datos.pin, rol: 'aseadora', tel: datos.tel, email: datos.email };
    const next = [...personal, nueva];
    setLivePersonal(next); setPersonal(next);
    setAddCleanerOpen(false);
    showToast('Aseadora creada · ' + nueva.codigo);
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

  if (!session) {
    return <div className="stage"><div className="screen"><Login onLogin={login} /></div></div>;
  }

  const isAdmin = session.rol === 'admin';
  const ctx = {
    user: session.nombre, aseos, props, personal, openId, toggle, logout,
    openCompletar, openReassign, openProp: (id) => setPropId(id), closeProp: () => setPropId(null),
    openEditProp, openAddProp, openAddCleaner,
    calMonth, calYear, calSel, setCalSel, shiftMonth, goToAseo,
    filter, setFilter, openSync: () => showToast('Sincronizando con Airbnb…'),
  };

  // urgent count for nav badge
  const urgentMine = aseos.filter(a => (isAdmin ? true : a.asignada === session.nombre) && (a.status === 'urgent' || a.priority) && a.status !== 'done').length;

  const cleanerTabs = [
    { id: 'hoy', label: 'Hoy', icon: 'list', badge: urgentMine || null },
    { id: 'calendario', label: 'Calendario', icon: 'calendar' },
    { id: 'historial', label: 'Historial', icon: 'check' },
  ];
  const adminTabs = [
    { id: 'aseos', label: 'Aseos', icon: 'list', badge: urgentMine || null },
    { id: 'calendario', label: 'Calendario', icon: 'calendar' },
    { id: 'propiedades', label: 'Propiedades', icon: 'home' },
    { id: 'personal', label: 'Personal', icon: 'users' },
  ];

  let screen;
  if (propId && isAdmin) {
    screen = <PropiedadDetail ctx={ctx} propId={propId} />;
  } else if (isAdmin) {
    if (tab === 'aseos') screen = <AseosScreen ctx={ctx} />;
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

        {toast && <div className="toast">{toast}</div>}
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
