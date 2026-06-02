/* ============================================================
   Admin screens — Aseos (filtros) / Propiedades / Detalle / Personal
   ============================================================ */
const { useState: useStateA } = React;

function AseosScreen({ ctx }) {
  const cleaners = PERSONAL.filter(p => p.rol === 'aseadora').map(p => p.nombre);
  const f = ctx.filter;
  let list = ctx.aseos.filter(a => a.status !== 'done');
  if (f.estado === 'urgent') list = list.filter(a => a.status === 'urgent' || a.priority);
  else if (f.estado === 'unassigned') list = list.filter(a => a.status === 'unassigned');
  else if (f.estado === 'pending') list = list.filter(a => a.status === 'pending');
  if (f.aseadora) list = list.filter(a => a.asignada === f.aseadora);

  const groups = groupByDay(list);
  const active = f.estado !== 'all' || f.aseadora;

  return (
    <div className="scrollarea">
      <AppBar title="Aseos" subtitle={list.length + ' programados'} onLogout={ctx.logout}
        actions={<button className="icon-btn" onClick={ctx.openSync} aria-label="Sincronizar"><Icon name="sync" size={20} /></button>} />

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
        <div className="daterange">
          <div className="date-input"><Icon name="calendar" size={16} /> 31 may 2026</div>
          <div className="date-input"><Icon name="calendar" size={16} /> 6 jun 2026</div>
          {active && <button className="clear-btn" onClick={() => ctx.setFilter({ estado: 'all', aseadora: null })}>Limpiar</button>}
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
  return (
    <div className="scrollarea">
      <AppBar title="Personal" subtitle={cleaners.length + ' aseadoras'} onLogout={ctx.logout} />
      <div className="team-list">
        {cleaners.map(c => {
          const done = ctx.aseos.filter(a => a.asignada === c.nombre && a.status === 'done');
          const pend = ctx.aseos.filter(a => a.asignada === c.nombre && a.status !== 'done');
          const gan = done.reduce((s, a) => s + aseoEnriched(a).precio, 0);
          return (
            <div className="team-row" key={c.codigo || c.nombre}>
              <span className="team-avatar">{initials(c.nombre).toUpperCase()}</span>
              <div className="team-main">
                <div className="label ter" style={{ marginBottom: 1 }}>{c.codigo}</div>
                <div className="h3">{c.nombre}</div>
                <div className="caption">{pend.length} pendientes · {done.length} completados</div>
                <div className="row gap-sm caption" style={{ marginTop: 2, color: 'var(--text-tertiary)' }}>
                  <Icon name="phone" size={14} /> {c.tel}
                </div>
              </div>
              <div className="team-stat">
                <div className="num">{fmtCOP(gan)}</div>
                <div className="label ter">Mayo</div>
              </div>
            </div>
          );
        })}
        <div style={{ height: 80 }}></div>
      </div>
    </div>
  );
}

Object.assign(window, { AseosScreen, PropiedadesScreen, PropiedadDetail, PersonalScreen });
