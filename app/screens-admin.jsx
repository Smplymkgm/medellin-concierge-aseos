/* ============================================================
   Admin screens — Aseos (filtros) / Propiedades / Detalle / Personal
   ============================================================ */
const { useState: useStateA } = React;

function AseosScreen({ ctx }) {
  // Default: month current. Filtros se aplican sobre checkout.
  const cleaners = ctx.personal.filter(p => p.rol === 'aseadora').map(p => p.nombre);
  const f = ctx.filter;

  // Si no hay fechas en el filtro, default = mes actual
  const monthStart = new Date(TODAY.getFullYear(), TODAY.getMonth(), 1);
  const monthEnd   = new Date(TODAY.getFullYear(), TODAY.getMonth() + 1, 0);
  const fmtISO = d => d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  const desdeStr = f.desde || fmtISO(monthStart);
  const hastaStr = f.hasta || fmtISO(monthEnd);
  const desde = new Date(desdeStr + 'T00:00:00');
  const hasta = new Date(hastaStr + 'T23:59:59');

  let list = ctx.aseos.filter(a => a.status !== 'done');
  // Filtro por rango de fecha (checkout)
  list = list.filter(a => a.checkout >= desde && a.checkout <= hasta);
  if (f.estado === 'urgent') list = list.filter(a => a.status === 'urgent' || a.priority);
  else if (f.estado === 'unassigned') list = list.filter(a => a.status === 'unassigned');
  else if (f.estado === 'pending') list = list.filter(a => a.status === 'pending');
  if (f.aseadora) list = list.filter(a => a.asignada === f.aseadora);

  const groups = groupByDay(list);
  const active = f.estado !== 'all' || f.aseadora || f.desde || f.hasta;

  return (
    <div className="scrollarea">
      <AppBar title="Aseos" subtitle={list.length + ' programados'} onLogout={ctx.logout}
        actions={<button className="icon-btn" onClick={ctx.openSync} disabled={ctx.syncing} aria-label="Actualizar"><Icon name="sync" size={20} className={ctx.syncing ? 'spin' : ''} /></button>} />

      <div className="filters">
        <div className="chips">
          <button className={'chip' + (f.estado === 'all' ? ' active' : '')} onClick={() => ctx.setFilter({ ...f, estado: 'all' })}>Todos</button>
          <button className={'chip' + (f.estado === 'urgent' ? ' active' : '')} onClick={() => ctx.setFilter({ ...f, estado: 'urgent' })}>Prioridad</button>
          <button className={'chip' + (f.estado === 'unassigned' ? ' active' : '')} onClick={() => ctx.setFilter({ ...f, estado: 'unassigned' })}>Sin asignar</button>
          <button className={'chip' + (f.estado === 'pending' ? ' active' : '')} onClick={() => ctx.setFilter({ ...f, estado: 'pending' })}>Pendiente</button>
          <span style={{ width: 1, background: 'var(--border-light)', margin: '2px 4px', flexShrink: 0 }}></span>
          {cleaners.map(c => (
            <button key={c} className={'chip' + (f.aseadora === c ? ' active' : '')}
              onClick={() => ctx.setFilter({ ...f, aseadora: f.aseadora === c ? null : c })}>{c}</button>
          ))}
        </div>
        <div className="daterange" style={{ gap: 6 }}>
          <input type="date" className="date-input" value={desdeStr}
            onChange={e => ctx.setFilter({ ...f, desde: e.target.value })}
            style={{ flex: 1, padding: 8, border: '1px solid var(--border-light)', borderRadius: 6, fontFamily: 'inherit' }} />
          <span className="caption sec">a</span>
          <input type="date" className="date-input" value={hastaStr}
            onChange={e => ctx.setFilter({ ...f, hasta: e.target.value })}
            style={{ flex: 1, padding: 8, border: '1px solid var(--border-light)', borderRadius: 6, fontFamily: 'inherit' }} />
          {active && <button className="clear-btn" onClick={() => ctx.setFilter({ estado: 'all', aseadora: null, desde: '', hasta: '' })}>Limpiar</button>}
        </div>
      </div>

      <div className="aseo-list" style={{ paddingTop: 4 }}>
        {groups.length === 0 && <div className="empty"><Icon name="list" size={28} /><div className="body">Sin aseos con estos filtros</div></div>}
        {groups.map(g => (
          <div className="day-group" key={g.key}>
            <div className="day-head">
              <span className="label sec">{sameDay(g.date, TODAY) ? 'Hoy · ' + fmtShort(g.date) : fmtDate(g.date)}</span>
              <span className="caption count">{g.items.length}</span>
            </div>
            {g.items.map(a => (
              <AseoCard key={a.codigo} aseo={a} role="admin"
                open={ctx.openId === a.codigo} onToggle={() => ctx.toggle(a.codigo)}
                onComplete={ctx.openCompletar} onReassign={ctx.openReassign} />
            ))}
          </div>
        ))}
        <div style={{ height: 80 }}></div>
      </div>
    </div>
  );
}

function PropiedadesScreen({ ctx }) {
  return (
    <div className="scrollarea">
      <AppBar title="Propiedades" subtitle={ctx.props.length + ' activas'} onLogout={ctx.logout} />
      <div className="prop-list">
        {ctx.props.map(p => (
          <div className="prop-row" key={p.id} onClick={() => ctx.openProp(p.id)}>
            <div className="prop-thumb">{propInitials(p.nombre)}</div>
            <div className="prop-main">
              <div className="prop-name">{p.nombre}</div>
              <div className="prop-addr">
                <Icon name="location" size={14} style={{ color: 'var(--text-tertiary)' }} />
                <span className="caption">{p.barrio}</span>
              </div>
            </div>
            <Icon name="chevron-right" size={20} style={{ color: 'var(--text-tertiary)' }} />
          </div>
        ))}
        <div style={{ height: 80 }}></div>
      </div>
    </div>
  );
}

function PropiedadDetail({ ctx, propId }) {
  const [reveal, setReveal] = useStateA(false);
  const p = ctx.props.find(x => x.id === propId) || propById(propId);
  if (!p) return null;
  const recientes = ctx.aseos.filter(a => a.prop === propId && a.status === 'done')
    .sort((a, b) => (b.completadoEl || b.checkout) - (a.completadoEl || a.checkout)).slice(0, 4);
  const mask = v => '•'.repeat(String(v).length);

  return (
    <div className="scrollarea">
      <div className="back-row" style={{ justifyContent: 'space-between' }}>
        <button className="btn btn-ghost" onClick={ctx.closeProp}><Icon name="chevron-left" size={20} /> Propiedades</button>
        <button className="btn btn-ghost" onClick={() => ctx.openEditProp(p.id)}><Icon name="edit" size={18} /> Editar</button>
      </div>
      <div className="prop-cover">{propInitials(p.nombre)}</div>
      <div className="prop-detail-body">
        <div className="h2">{p.nombre}</div>
        <div className="prop-addr" style={{ marginTop: 6 }}>
          <Icon name="location" size={16} style={{ color: 'var(--text-tertiary)' }} />
          <span className="body sec">{p.direccion}</span>
        </div>

        <div className="section">
          <div className="section-title">
            <Icon name="key" size={16} />
            <span className="h3">Claves de acceso</span>
            <button className="icon-btn" style={{ marginLeft: 'auto' }} onClick={() => setReveal(!reveal)} aria-label="Mostrar claves">
              <Icon name={reveal ? 'eye-off' : 'eye'} size={20} />
            </button>
          </div>
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderRadius: 10, padding: '4px 16px' }}>
            <div className="key-row"><span className="caption">Lockbox</span><span className={'key-val' + (reveal ? '' : ' hidden')}>{reveal ? p.claves.lockbox : mask(p.claves.lockbox)}</span></div>
            <div className="key-row"><span className="caption">WiFi</span><span className={'key-val' + (reveal ? '' : ' hidden')}>{reveal ? p.claves.wifi : mask(p.claves.wifi)}</span></div>
            <div className="key-row"><span className="caption">Portería</span><span className="key-val">{p.claves.porteria}</span></div>
          </div>
        </div>

        <div className="section">
          <div className="section-title"><Icon name="money" size={16} /><span className="h3">Precio aseo</span></div>
          <div className="body">{fmtCOP(p.precio)} <span className="caption">· Express {fmtCOP(Math.round(p.precio*0.6))}</span></div>
        </div>

        <div className="section">
          <div className="section-title"><Icon name="check" size={16} /><span className="h3">Últimos aseos</span></div>
          {recientes.length === 0 && <div className="caption">Sin aseos completados aún</div>}
          {recientes.map(a => (
            <div className="key-row" key={a.codigo}>
              <span className="body">{fmtDate(a.completadoEl || a.checkout)}</span>
              <span className="caption">{a.asignada} · {a.tipo || 'Full'}</span>
            </div>
          ))}
        </div>

        <div className="section">
          <div className="row gap-base caption" style={{ color: 'var(--text-tertiary)' }}>
            <Icon name="sync" size={16} /> Sincronizado vía iCal · {p.id}
          </div>
        </div>
        <div style={{ height: 24 }}></div>
      </div>
    </div>
  );
}

function PersonalScreen({ ctx }) {
  const cleaners = ctx.personal.filter(p => p.rol === 'aseadora');
  const mesActual = MONTHS_SHORT[TODAY.getMonth()];
  return (
    <div className="scrollarea">
      <AppBar title="Personal" subtitle={cleaners.length + ' aseadoras'} onLogout={ctx.logout}
        actions={<button className="icon-btn" onClick={ctx.openSync} disabled={ctx.syncing} aria-label="Actualizar"><Icon name="sync" size={20} className={ctx.syncing ? 'spin' : ''} /></button>} />
      <div className="team-list">
        {cleaners.map(c => {
          const done = ctx.aseos.filter(a => a.asignada === c.nombre && a.status === 'done' && a.checkout.getMonth() === TODAY.getMonth() && a.checkout.getFullYear() === TODAY.getFullYear());
          const pend = ctx.aseos.filter(a => a.asignada === c.nombre && a.status !== 'done');
          const gan = done.reduce((s, a) => s + aseoEnriched(a).precio, 0);
          return (
            <div className="team-row" key={c.codigo || c.nombre}
              onClick={() => ctx.openEditCleaner && ctx.openEditCleaner(c)}
              style={{ cursor: 'pointer' }}>
              <span className="team-avatar">{initials(c.nombre).toUpperCase()}</span>
              <div className="team-main">
                <div className="label ter" style={{ marginBottom: 1 }}>{c.codigo}</div>
                <div className="h3">{c.nombre}</div>
                <div className="caption">{pend.length} pendientes · {done.length} completados</div>
                <div className="row gap-sm caption" style={{ marginTop: 2, color: 'var(--text-tertiary)' }}>
                  <Icon name="phone" size={14} /> {c.tel || '—'}
                </div>
              </div>
              <div className="team-stat">
                <div className="num">{fmtCOP(gan)}</div>
                <div className="label ter" style={{ textTransform: 'capitalize' }}>{mesActual}</div>
              </div>
            </div>
          );
        })}
        <div style={{ height: 80 }}></div>
      </div>
    </div>
  );
}

/* ============================================================
   Admin Historial — payroll-focused filtered view
   ============================================================ */
function HistorialAdminScreen({ ctx }) {
  const [period, setPeriod] = useStateA({
    mode: 'month', year: TODAY.getFullYear(), month: TODAY.getMonth(), from: '', to: ''
  });
  const [aseadora, setAseadora] = useStateA(null);
  const [propId, setPropId]     = useStateA(null);

  const cleaners = ctx.personal.filter(p => p.rol === 'aseadora').map(p => p.nombre);
  const propsList = ctx.props;

  let list = ctx.aseos.filter(a => a.status === 'done');
  list = filterByPeriod(list, period);
  if (aseadora) list = list.filter(a => a.asignada === aseadora);
  if (propId)   list = list.filter(a => a.prop === propId);
  list = list.sort((a, b) => b.checkout - a.checkout);

  // Per-aseadora totals (payroll)
  const totales = {};
  list.forEach(a => {
    const k = a.asignada || 'Sin asignar';
    if (!totales[k]) totales[k] = { count: 0, total: 0 };
    totales[k].count++;
    totales[k].total += aseoEnriched(a).precio;
  });
  const totalGlobal = list.reduce((s, a) => s + aseoEnriched(a).precio, 0);
  const filtroActivo = aseadora || propId;

  return (
    <div className="scrollarea">
      <AppBar title="Historial" subtitle={list.length + ' completados'} onLogout={ctx.logout} />
      <MonthRangePicker value={period} onChange={setPeriod} />

      <div className="filters" style={{ marginTop: 8 }}>
        <div className="chips">
          <button className={'chip' + (!aseadora ? ' active' : '')} onClick={() => setAseadora(null)}>Todas</button>
          {cleaners.map(c => (
            <button key={c} className={'chip' + (aseadora === c ? ' active' : '')}
              onClick={() => setAseadora(aseadora === c ? null : c)}>{c}</button>
          ))}
        </div>
        <div className="chips" style={{ marginTop: 6 }}>
          <button className={'chip' + (!propId ? ' active' : '')} onClick={() => setPropId(null)}>Todas las props</button>
          {propsList.slice(0, 12).map(p => (
            <button key={p.id} className={'chip' + (propId === p.id ? ' active' : '')}
              onClick={() => setPropId(propId === p.id ? null : p.id)}>{p.nombre.slice(0, 18)}</button>
          ))}
        </div>
        {filtroActivo && (
          <button className="clear-btn" style={{ marginTop: 6 }} onClick={() => { setAseadora(null); setPropId(null); }}>Limpiar filtros</button>
        )}
      </div>

      <div style={{ padding: '12px 20px 0' }}>
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderRadius: 12, padding: 16 }}>
          <div className="label ter" style={{ textTransform: 'capitalize' }}>{periodLabel(period)}</div>
          <div className="h1" style={{ marginTop: 4 }}>{fmtCOP(totalGlobal)}</div>
          <div className="caption">{list.length} aseos · total a pagar</div>
          {Object.keys(totales).length > 1 && (
            <div style={{ marginTop: 10, borderTop: '1px solid var(--border-light)', paddingTop: 10 }}>
              {Object.entries(totales).sort((a,b) => b[1].total - a[1].total).map(([n, t]) => (
                <div key={n} className="key-row" style={{ padding: '4px 0' }}>
                  <span className="body">{n} <span className="caption sec">· {t.count}</span></span>
                  <span className="body" style={{ fontWeight: 600 }}>{fmtCOP(t.total)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="aseo-list">
        <div className="day-head"><span className="label sec">Detalle</span></div>
        {list.length === 0 && (
          <div className="empty"><Icon name="check" size={28} /><div className="body">Sin aseos con estos filtros</div></div>
        )}
        {list.map(a => (
          <AseoCard key={a.codigo} aseo={a} role="admin"
            open={ctx.openId === a.codigo} onToggle={() => ctx.toggle(a.codigo)} />
        ))}
        <div style={{ height: 80 }}></div>
      </div>
    </div>
  );
}

Object.assign(window, { AseosScreen, PropiedadesScreen, PropiedadDetail, PersonalScreen, HistorialAdminScreen });
