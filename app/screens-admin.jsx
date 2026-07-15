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

  // Alerta de aseos sin asignar HOY (independiente de los filtros)
  const sinAsignarHoy = ctx.aseos.filter(a =>
    !a.asignada && a.status !== 'done' && sameDay(a.checkout, TODAY)
  );

  return (
    <div className="scrollarea">
      <AppBar title="Aseos" subtitle={list.length + ' programados'} onLogout={ctx.logout}
        actions={<button className="icon-btn" onClick={ctx.openSync} disabled={ctx.syncing} aria-label="Actualizar"><Icon name="sync" size={20} className={ctx.syncing ? 'spin' : ''} /></button>} />

      {sinAsignarHoy.length > 0 && (
        <div className="row gap-base" style={{ margin: '4px 16px 8px', padding: '10px 12px', background: 'rgba(196,98,45,0.10)', border: '1px solid var(--accent)', borderRadius: 10, cursor: 'pointer' }}
          onClick={() => ctx.setFilter({ ...f, estado: 'unassigned', desde: '', hasta: '' })}>
          <Icon name="alert" size={18} style={{ color: 'var(--accent)' }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="body" style={{ fontWeight: 600 }}>
              {sinAsignarHoy.length} aseo{sinAsignarHoy.length === 1 ? '' : 's'} sin asignar hoy
            </div>
            <div className="caption sec">Toca para filtrar</div>
          </div>
        </div>
      )}

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
        {!ctx.dataLoaded && <LoadingState label="Cargando aseos…" />}
        {ctx.dataLoaded && groups.length === 0 && <div className="empty"><Icon name="list" size={28} /><div className="body">Sin aseos con estos filtros</div></div>}
        {groups.map(g => (
          <div className="day-group" key={g.key}>
            <div className="day-head">
              <span className="label sec">{sameDay(g.date, TODAY) ? 'Hoy · ' + fmtShort(g.date) : fmtDate(g.date)}</span>
              <span className="caption count">{g.items.length}</span>
            </div>
            {g.items.map(a => (
              <AseoCard key={a.codigo} aseo={a} role="admin"
                open={ctx.openId === a.codigo} onToggle={() => ctx.toggle(a.codigo)}
                onComplete={ctx.openCompletar} onReassign={ctx.openReassign}
                onFinalizarSinForm={ctx.doFinalizarSinForm}
                onMoverFecha={ctx.openMoverFecha} />
            ))}
          </div>
        ))}
        <div style={{ height: 80 }}></div>
      </div>
    </div>
  );
}

function PropiedadesScreen({ ctx }) {
  const [q, setQ] = useStateA('');
  const query = q.trim().toLowerCase();
  const filtradas = query
    ? ctx.props.filter(p =>
        (p.id || '').toLowerCase().includes(query) ||
        (p.nombre || '').toLowerCase().includes(query)
      )
    : ctx.props;

  return (
    <div className="scrollarea">
      <AppBar title="Propiedades" subtitle={filtradas.length + ' / ' + ctx.props.length} onLogout={ctx.logout}
        actions={<button className="icon-btn" onClick={ctx.openSync} disabled={ctx.syncing} aria-label="Actualizar"><Icon name="sync" size={20} className={ctx.syncing ? 'spin' : ''} /></button>} />

      <div style={{ padding: '4px 16px 8px' }}>
        <div className="row gap-base" style={{ alignItems: 'center', background: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderRadius: 10, padding: '8px 12px' }}>
          <Icon name="filter" size={16} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
          <input
            type="search"
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Buscar por código (#0086) o nombre…"
            style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontFamily: 'inherit', fontSize: 14, color: 'var(--text-primary)', minWidth: 0 }}
          />
          {q && (
            <button onClick={() => setQ('')} className="icon-btn" aria-label="Limpiar"
              style={{ padding: 2 }}>
              <Icon name="close" size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="prop-list">
        {!ctx.dataLoaded && <LoadingState label="Cargando propiedades…" />}
        {ctx.dataLoaded && filtradas.length === 0 && (
          <div className="empty"><Icon name="home" size={28} /><div className="body">Sin resultados</div></div>
        )}
        {filtradas.map(p => (
          <div className="prop-row" key={p.id} onClick={() => ctx.openProp(p.id)}>
            <span className="label sec" style={{ minWidth: 56, textAlign: 'left', fontVariantNumeric: 'tabular-nums', color: 'var(--text-tertiary)', fontWeight: 600 }}>{p.id}</span>
            <div className="prop-main" style={{ minWidth: 0 }}>
              <div className="prop-name">{p.nombre}</div>
              {p.direccion && (
                <div className="prop-addr">
                  <Icon name="location" size={14} style={{ color: 'var(--text-tertiary)' }} />
                  <span className="caption">{p.direccion}</span>
                </div>
              )}
            </div>
            <Icon name="chevron-right" size={20} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
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

        {(() => {
          const tipoLabels = {
            chapa_digital: 'Chapa digital',
            llave_fisica:  'Llave física',
            caja_llaves:   'Caja de llaves',
          };
          const struct = p.accesoEstructurado || {};
          const ext = struct.externo;
          const intn = struct.interno;
          const hayStruct = (ext && (ext.tipo || ext.valor)) || (intn && (intn.tipo || intn.valor)) || struct.notas;
          if (hayStruct) {
            return (
              <div className="section">
                <div className="section-title">
                  <Icon name="key" size={16} />
                  <span className="h3">Acceso</span>
                  <button className="icon-btn" style={{ marginLeft: 'auto' }} onClick={() => setReveal(!reveal)} aria-label="Mostrar/ocultar claves">
                    <Icon name={reveal ? 'eye-off' : 'eye'} size={20} />
                  </button>
                </div>
                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderRadius: 10, padding: '4px 16px' }}>
                  {ext && (ext.tipo || ext.valor) && (
                    <div className="key-row">
                      <span className="caption">Externo · {tipoLabels[ext.tipo] || ext.tipo || '—'}</span>
                      <span className={'key-val' + (reveal ? '' : ' hidden')}>{reveal ? (ext.valor || '—') : mask(ext.valor || '')}</span>
                    </div>
                  )}
                  {intn && (intn.tipo || intn.valor) && (
                    <div className="key-row">
                      <span className="caption">Interno · {tipoLabels[intn.tipo] || intn.tipo || '—'}</span>
                      <span className={'key-val' + (reveal ? '' : ' hidden')}>{reveal ? (intn.valor || '—') : mask(intn.valor || '')}</span>
                    </div>
                  )}
                  {struct.notas && (
                    <div className="key-row">
                      <span className="caption">Notas</span>
                      <span className="key-val">{struct.notas}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          }
          // Fallback: mostrar el texto libre del spreadsheet partido por |
          const accesoStr = (p.claves && p.claves.acceso) || '';
          const parts = accesoStr.split('|').map(s => s.trim()).filter(Boolean);
          if (parts.length === 0) return null;
          return (
            <div className="section">
              <div className="section-title"><Icon name="key" size={16} /><span className="h3">Acceso</span></div>
              <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderRadius: 10, padding: '4px 16px' }}>
                {parts.map((part, i) => (
                  <div className="key-row" key={i}>
                    <span className="key-val" style={{ fontSize: 13 }}>{part}</span>
                  </div>
                ))}
              </div>
              <div className="caption" style={{ marginTop: 6, color: 'var(--text-tertiary)' }}>Toca Editar para estructurar el acceso en tipo + clave</div>
            </div>
          );
        })()}

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

        <div className="section">
          <button
            className="btn btn-block"
            onClick={() => ctx.doDeleteProp(p.id)}
            style={{
              background: 'transparent',
              color: 'var(--accent)',
              border: '1px solid var(--accent)',
              fontWeight: 600,
            }}>
            Archivar propiedad
          </button>
          <div className="caption" style={{ marginTop: 6, color: 'var(--text-tertiary)', textAlign: 'center' }}>
            Se oculta de la app. Datos preservados en el spreadsheet.
          </div>
        </div>

        <div style={{ height: 80 }}></div>
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
              <div className="team-stat" style={{ alignItems: 'flex-end', gap: 6 }}>
                <div className="num">{fmtCOP(gan)}</div>
                <div className="label ter" style={{ textTransform: 'capitalize' }}>{mesActual}</div>
                {ctx.startViewAs && (
                  <button className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                    onClick={e => { e.stopPropagation(); ctx.startViewAs(c.nombre); }}>
                    <Icon name="eye" size={14} /> Ver como
                  </button>
                )}
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
  const [cuentaOpen, setCuentaOpen] = useStateA(false);

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
        <div style={{ marginTop: 8 }}>
          <div className="select">
            <select value={propId || ''} onChange={e => setPropId(e.target.value || null)}
              style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border-light)', background: 'var(--bg-surface)', fontFamily: 'inherit', fontSize: 14, appearance: 'none' }}>
              <option value="">Todas las propiedades</option>
              {[...propsList].sort((a, b) => a.nombre.localeCompare(b.nombre)).map(p => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </select>
            <Icon name="chevron-down" size={18} className="chev" />
          </div>
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
          <button className="btn btn-primary btn-block" style={{ marginTop: 12 }}
            disabled={!aseadora || list.length === 0}
            onClick={() => setCuentaOpen(true)}>
            <Icon name="check" size={16} /> {aseadora ? ('Cuenta de cobro · ' + aseadora) : 'Elige una aseadora para la cuenta de cobro'}
          </button>
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
        {!ctx.dataLoaded && <LoadingState label="Cargando historial…" />}
        {ctx.dataLoaded && list.length === 0 && (
          <div className="empty"><Icon name="check" size={28} /><div className="body">Sin aseos con estos filtros</div></div>
        )}
        {list.map(a => (
          <AseoCard key={a.codigo} aseo={a} role="admin"
            open={ctx.openId === a.codigo} onToggle={() => ctx.toggle(a.codigo)} />
        ))}
        <div style={{ height: 80 }}></div>
      </div>

      {cuentaOpen && aseadora && (
        <CuentaCobro
          persona={ctx.personal.find(p => p.nombre === aseadora) || { nombre: aseadora }}
          lista={list}
          period={period}
          onClose={() => setCuentaOpen(false)} />
      )}
    </div>
  );
}

/* ============================================================
   Cuenta de cobro (PDF vía imprimir) — por aseadora y período
   ============================================================ */
const NIT_EMPRESA = '901564260-7';
const EMPRESA = 'Medellín Concierge';

function ddmmyyyy(d) {
  if (!d) return '';
  return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
}

function CuentaCobro({ persona, lista, period, onClose }) {
  // Rango del período
  let desde, hasta;
  if (period.mode === 'range' && period.from && period.to) {
    desde = new Date(period.from + 'T00:00:00');
    hasta = new Date(period.to + 'T00:00:00');
  } else {
    desde = new Date(period.year, period.month, 1);
    hasta = new Date(period.year, period.month + 1, 0);
  }

  const filas = [...lista].sort((a, b) => a.checkout - b.checkout).map(a => aseoEnriched(a));
  const total = filas.reduce((s, a) => s + (a.precio || 0), 0);
  const esManual = (cod) => String(cod || '').indexOf('MAN') === 0;
  // Nombre legal para la cuenta de cobro (cae al usuario si no se cargó)
  const nombreCobro = (persona.nombreCompleto && persona.nombreCompleto.trim()) || persona.nombre;

  // Imprime usando un iframe oculto con estilos propios (sin el CSS del
  // marco de la app, que rompía el layout). La tabla usa ancho fijo y
  // envuelve el texto para que NO se corte ni se salga de la página.
  // Etiqueta del período para el nombre del archivo
  const MESES_CAP = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const mesLabel = (period.mode === 'range' && period.from && period.to)
    ? (period.from + ' a ' + period.to)
    : (MESES_CAP[period.month] + ' ' + period.year);
  const tituloArchivo = 'Cuenta de cobro ' + nombreCobro + ' ' + mesLabel;

  function imprimirCuenta() {
    const node = document.querySelector('.cuenta-doc');
    if (!node) return;
    // @page sin margen + padding en el body: así el body ocupa EXACTAMENTE
    // el ancho de la hoja y la tabla (100%) nunca se desborda/corta.
    const css =
      "*{box-sizing:border-box;} html{margin:0;padding:0;}" +
      "body{font-family:'Helvetica Neue',Arial,sans-serif;color:#1a1a1a;font-size:12px;line-height:1.45;margin:0;padding:13mm;}" +
      ".cuenta-doc{margin:0;max-width:100%;box-shadow:none;padding:0;}" +
      ".cc-title{font-size:17px;font-weight:700;text-align:center;margin:0 0 16px;}" +
      ".cc-h2{font-size:13px;font-weight:700;margin:16px 0 6px;border-bottom:1px solid #ddd;padding-bottom:4px;}" +
      ".cc-line{margin:3px 0;} .cc-total{font-size:14px;margin:12px 0;text-align:right;}" +
      ".cc-list{margin:4px 0 4px 18px;} .cc-firma{margin-top:32px;} .cc-foot{margin-top:10px;font-size:10px;color:#555;text-align:center;}" +
      ".cc-table{width:100%;border-collapse:collapse;margin:8px 0;font-size:10.5px;table-layout:fixed;}" +
      ".cc-table th,.cc-table td{border:1px solid #ccc;padding:4px 5px;text-align:left;vertical-align:top;word-wrap:break-word;overflow-wrap:anywhere;}" +
      ".cc-table th{background:#f0ede9;font-weight:700;}" +
      ".cc-table th:nth-child(1),.cc-table td:nth-child(1){width:10%;}" +
      ".cc-table th:nth-child(2),.cc-table td:nth-child(2){width:16%;}" +
      ".cc-table th:nth-child(3),.cc-table td:nth-child(3){width:23%;}" +
      ".cc-table th:nth-child(4),.cc-table td:nth-child(4){width:13%;}" +
      ".cc-table th:nth-child(5),.cc-table td:nth-child(5){width:27%;}" +
      ".cc-table th:nth-child(6),.cc-table td:nth-child(6){width:11%;}" +
      ".cc-table .cc-right{text-align:right;} .cc-table tfoot td{background:#faf8f5;}" +
      "tr{page-break-inside:avoid;} @page{size:A4;margin:0;}";
    var prev = document.getElementById('cc-print-frame');
    if (prev) prev.remove();
    var f = document.createElement('iframe');
    f.id = 'cc-print-frame';
    // Tamaño A4 real (offscreen) para que el layout coincida con la impresión
    f.style.position = 'fixed'; f.style.left = '-10000px'; f.style.top = '0';
    f.style.width = '210mm'; f.style.height = '297mm'; f.style.border = '0';
    document.body.appendChild(f);
    var doc = f.contentWindow.document;
    doc.open();
    doc.write('<!doctype html><html><head><meta charset="utf-8"><title>' +
      tituloArchivo + '</title><style>' + css + '</style></head><body>' +
      node.outerHTML + '</body></html>');
    doc.close();
    setTimeout(function () {
      try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) {}
    }, 400);
  }

  return (
    <div className="cuenta-overlay">
      <div className="cuenta-toolbar no-print">
        <button className="btn btn-ghost" onClick={onClose}><Icon name="x" size={18} /> Cerrar</button>
        <button className="btn btn-primary" onClick={imprimirCuenta}><Icon name="check" size={18} /> Imprimir / Guardar PDF</button>
      </div>

      <div className="cuenta-doc">
        <h1 className="cc-title">CUENTA DE COBRO — SERVICIOS DE ASEO</h1>
        <p className="cc-line">Fecha: {ddmmyyyy(new Date())}</p>
        <p className="cc-line">Nombre del prestador(a): <strong>{nombreCobro}</strong></p>
        <p className="cc-line">Documento de identidad: {persona.cedula || '________________'}</p>
        <p className="cc-line">Teléfono: {persona.tel || '________________'}</p>
        <p className="cc-line">A quién se factura: {EMPRESA} — NIT: {NIT_EMPRESA}</p>

        <h2 className="cc-h2">Concepto del servicio</h2>
        <p className="cc-line">
          Por medio de la presente, yo, <strong>{nombreCobro}</strong>, certifico que presté servicios de aseo
          de manera independiente durante el período comprendido entre el <strong>{ddmmyyyy(desde)}</strong> y
          el <strong>{ddmmyyyy(hasta)}</strong>, correspondientes a los servicios registrados a continuación.
        </p>

        <h2 className="cc-h2">Detalle de aseos realizados</h2>
        <table className="cc-table">
          <thead>
            <tr>
              <th>Cód. propiedad</th>
              <th>Código reserva</th>
              <th>Propiedad</th>
              <th>Fecha de aseo</th>
              <th>Notas</th>
              <th className="cc-right">Valor</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((a, i) => (
              <tr key={a.codigo || i}>
                <td>{a.prop || '—'}</td>
                <td>{esManual(a.codigo) ? 'Aseo asignado' : a.codigo}</td>
                <td>{a.propNombre}</td>
                <td>{ddmmyyyy(a.checkout)}</td>
                <td>{a.notas || '—'}</td>
                <td className="cc-right">{fmtCOP(a.precio || 0)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan="5"><strong>Número de aseos realizados: {filas.length}</strong></td>
              <td className="cc-right"><strong>{fmtCOP(total)}</strong></td>
            </tr>
          </tfoot>
        </table>

        <p className="cc-total">Total a pagar: <strong>{fmtCOP(total)}</strong></p>

        <h2 className="cc-h2">Declaración</h2>
        <ul className="cc-list">
          <li>Este pago corresponde exclusivamente a servicios prestados de manera independiente.</li>
          <li>El pago se realiza únicamente sobre los servicios efectivamente registrados.</li>
        </ul>

        <h2 className="cc-h2">Datos para pago</h2>
        <p className="cc-line">Banco: {persona.banco || '________________'}</p>
        <p className="cc-line">Tipo de cuenta: {persona.tipoCuenta || '________________'}</p>
        <p className="cc-line">Número de cuenta: {persona.numeroCuenta || '________________'}</p>
        <p className="cc-line">Titular: {nombreCobro}</p>

        <p className="cc-firma">Firma: ____________________________</p>
        <p className="cc-foot">NO SE DESCUENTAN COSTOS Y GASTOS DE LA DECLARACIÓN DE RENTA</p>
      </div>
    </div>
  );
}

Object.assign(window, { AseosScreen, PropiedadesScreen, PropiedadDetail, PersonalScreen, HistorialAdminScreen, CuentaCobro });
