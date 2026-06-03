/* ============================================================
   Aseadora (cleaner) screens — Hoy / Calendario / Historial
   ============================================================ */

/* group aseos by checkout day, priority first */
function sortAseos(list) {
  return [...list].sort((a, b) => {
    if (a.checkout - b.checkout !== 0) return a.checkout - b.checkout;
    if (a.priority !== b.priority) return a.priority ? -1 : 1;
    const order = { urgent:0, unassigned:1, pending:2, done:3 };
    return order[a.status] - order[b.status];
  });
}
function groupByDay(list) {
  const groups = [];
  sortAseos(list).forEach(a => {
    const key = a.checkout.toDateString();
    let g = groups.find(g => g.key === key);
    if (!g) { g = { key, date: a.checkout, items: [] }; groups.push(g); }
    g.items.push(a);
  });
  return groups;
}

function HoyScreen({ ctx }) {
  const mine = ctx.aseos.filter(a => a.asignada === ctx.user && a.status !== 'done');
  const hoy      = mine.filter(a => sameDay(a.checkout, TODAY));
  const atrasados = mine.filter(a => a.checkout < TODAY && !sameDay(a.checkout, TODAY));
  const proximos = mine.filter(a => a.checkout > TODAY);
  const sortedHoy = sortAseos(hoy);
  const sortedAtrasados = sortAseos(atrasados);

  return (
    <div className="scrollarea">
      <AppBar title={'Hola, ' + ctx.user} subtitle={fmtDate(TODAY)} onLogout={ctx.logout}
        actions={<button className="icon-btn" onClick={ctx.openSync} disabled={ctx.syncing} aria-label="Actualizar"><Icon name="sync" size={20} className={ctx.syncing ? 'spin' : ''} /></button>} />
      <div className="aseo-list">
        {sortedAtrasados.length > 0 && (
          <>
            <div className="day-head">
              <span className="label sec" style={{ color: 'var(--accent)' }}>Atrasados</span>
              <span className="caption count">{sortedAtrasados.length}</span>
            </div>
            {sortedAtrasados.map(a => (
              <AseoCard key={a.codigo} aseo={a} role="aseadora"
                open={ctx.openId === a.codigo} onToggle={() => ctx.toggle(a.codigo)}
                onComplete={ctx.openCompletar} onReassign={ctx.openReassign} />
            ))}
          </>
        )}
        <div className="day-head" style={sortedAtrasados.length > 0 ? { marginTop: 24 } : null}>
          <span className="label sec">Hoy</span>
          <span className="caption count">{sortedHoy.length} {sortedHoy.length === 1 ? 'aseo' : 'aseos'}</span>
        </div>
        {sortedHoy.length === 0 && (
          <div className="empty"><Icon name="check" size={28} /><div className="body">Sin aseos para hoy</div></div>
        )}
        {sortedHoy.map(a => (
          <AseoCard key={a.codigo} aseo={a} role="aseadora"
            open={ctx.openId === a.codigo} onToggle={() => ctx.toggle(a.codigo)}
            onComplete={ctx.openCompletar} onReassign={ctx.openReassign} />
        ))}

        {proximos.length > 0 && (
          <>
            <div className="day-head" style={{ marginTop: 24 }}>
              <span className="label sec">Próximos</span>
              <span className="caption count">{proximos.length}</span>
            </div>
            {groupByDay(proximos).map(g => (
              <div className="day-group" key={g.key}>
                <div className="caption" style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>{fmtDate(g.date)}</div>
                {g.items.map(a => (
                  <AseoCard key={a.codigo} aseo={a} role="aseadora"
                    open={ctx.openId === a.codigo} onToggle={() => ctx.toggle(a.codigo)}
                    onComplete={ctx.openCompletar} onReassign={ctx.openReassign} />
                ))}
              </div>
            ))}
          </>
        )}
        <div style={{ height: 16 }}></div>
      </div>
    </div>
  );
}

/* ============================================================
   Todos — lista completa de aseos asignados a la aseadora,
   agrupada por mes, ordenada por fecha desc
   ============================================================ */
function TodosScreen({ ctx }) {
  const mine = ctx.aseos.filter(a => a.asignada === ctx.user);

  // Ordenar por checkout descendente y agrupar por mes
  const sorted = [...mine].sort((a, b) => b.checkout - a.checkout);
  const groups = [];
  sorted.forEach(a => {
    const k = a.checkout.getFullYear() + '-' + a.checkout.getMonth();
    let g = groups.find(g => g.key === k);
    if (!g) { g = { key: k, year: a.checkout.getFullYear(), month: a.checkout.getMonth(), items: [] }; groups.push(g); }
    g.items.push(a);
  });

  const totalDone   = mine.filter(a => a.status === 'done').length;
  const totalActivos = mine.length - totalDone;

  return (
    <div className="scrollarea">
      <AppBar title="Todos" subtitle={mine.length + ' en total · ' + totalActivos + ' activos · ' + totalDone + ' completados'} onLogout={ctx.logout}
        actions={<button className="icon-btn" onClick={ctx.openSync} disabled={ctx.syncing} aria-label="Actualizar"><Icon name="sync" size={20} className={ctx.syncing ? 'spin' : ''} /></button>} />
      <div className="aseo-list">
        {groups.length === 0 && (
          <div className="empty"><Icon name="list" size={28} /><div className="body">No tienes aseos asignados</div></div>
        )}
        {groups.map(g => (
          <div className="day-group" key={g.key}>
            <div className="day-head">
              <span className="label sec" style={{ textTransform: 'capitalize' }}>{MONTHS[g.month]} {g.year}</span>
              <span className="caption count">{g.items.length}</span>
            </div>
            {g.items.map(a => (
              <AseoCard key={a.codigo} aseo={a} role="aseadora"
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

function CalendarioScreen({ ctx, role }) {
  const list = role === 'admin' ? ctx.aseos : ctx.aseos.filter(a => a.asignada === ctx.user);
  const dayItems = sortAseos(list.filter(a => ctx.calSel && sameDay(a.checkout, ctx.calSel)));
  return (
    <div className="scrollarea">
      <AppBar title="Calendario" onLogout={ctx.logout}
        actions={<button className="icon-btn" onClick={ctx.openSync} disabled={ctx.syncing} aria-label="Actualizar"><Icon name="sync" size={20} className={ctx.syncing ? 'spin' : ''} /></button>} />
      <MonthCalendar aseos={list} selected={ctx.calSel} onSelect={ctx.setCalSel}
        month={ctx.calMonth} year={ctx.calYear} onMonth={ctx.shiftMonth} />
      <div className="cal-daylist">
        <div className="cal-daylabel label sec">{ctx.calSel ? fmtDate(ctx.calSel) : 'Selecciona un día'}</div>
        {ctx.calSel && dayItems.length === 0 && <div className="caption" style={{ paddingBottom: 16 }}>Sin aseos este día</div>}
        {dayItems.map(a => (
          <AseoCard key={a.codigo} aseo={a} role={role}
            open={ctx.openId === a.codigo} onToggle={() => ctx.toggle(a.codigo)}
            onComplete={ctx.openCompletar}
            onReassign={role === 'admin' ? ctx.openReassign : undefined}
            onFinalizarSinForm={role === 'admin' ? ctx.doFinalizarSinForm : undefined} />
        ))}
        <div style={{ height: 80 }}></div>
      </div>
    </div>
  );
}

/* ============================================================
   Month/range picker — shared by Historial (cleaner + admin)
   ============================================================ */
function MonthRangePicker({ value, onChange }) {
  // value: { mode: 'month'|'range', year, month, from, to }
  const isMonth = value.mode === 'month';
  function shift(dir) {
    let m = value.month + dir, y = value.year;
    if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; }
    onChange({ ...value, year: y, month: m });
  }
  function toRange() {
    const start = new Date(value.year, value.month, 1);
    const end   = new Date(value.year, value.month + 1, 0);
    const fmt = d => d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
    onChange({ mode: 'range', year: value.year, month: value.month, from: fmt(start), to: fmt(end) });
  }
  function toMonth() { onChange({ ...value, mode: 'month' }); }
  return (
    <div style={{ padding: '4px 20px 0' }}>
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderRadius: 12, padding: 12 }}>
        {isMonth ? (
          <div className="row" style={{ alignItems: 'center', gap: 8 }}>
            <button className="icon-btn" onClick={() => shift(-1)} aria-label="Mes anterior"><Icon name="chevron-left" size={20} /></button>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div className="h3" style={{ textTransform: 'capitalize' }}>{MONTHS[value.month]} {value.year}</div>
            </div>
            <button className="icon-btn" onClick={() => shift(1)} aria-label="Mes siguiente"><Icon name="chevron-right" size={20} /></button>
            <button className="btn btn-ghost" style={{ padding: '6px 10px' }} onClick={toRange}>Rango</button>
          </div>
        ) : (
          <div>
            <div className="row" style={{ gap: 8, alignItems: 'center' }}>
              <input type="date" value={value.from} onChange={e => onChange({ ...value, from: e.target.value })}
                style={{ flex: 1, padding: 8, border: '1px solid var(--border-light)', borderRadius: 6, fontFamily: 'inherit' }} />
              <span className="caption sec">a</span>
              <input type="date" value={value.to} onChange={e => onChange({ ...value, to: e.target.value })}
                style={{ flex: 1, padding: 8, border: '1px solid var(--border-light)', borderRadius: 6, fontFamily: 'inherit' }} />
              <button className="btn btn-ghost" style={{ padding: '6px 10px' }} onClick={toMonth}>Mes</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* Filter completed aseos by the chosen period.
   Uses CHECKOUT (la fecha en que se realiza el aseo), no la fecha
   de completar. Una reserva que entró en mayo pero hace checkout en
   junio cuenta para junio. */
function filterByPeriod(aseos, period) {
  return aseos.filter(a => {
    const dt = a.checkout;
    if (!(dt instanceof Date)) return false;
    if (period.mode === 'month') {
      return dt.getFullYear() === period.year && dt.getMonth() === period.month;
    }
    const from = period.from ? new Date(period.from + 'T00:00:00') : null;
    const to   = period.to   ? new Date(period.to   + 'T23:59:59') : null;
    if (from && dt < from) return false;
    if (to   && dt > to)   return false;
    return true;
  });
}

function periodLabel(period) {
  if (period.mode === 'month') return MONTHS[period.month] + ' ' + period.year;
  return (period.from || '—') + ' a ' + (period.to || '—');
}

const { useState: useStateH } = React;

function HistorialScreen({ ctx }) {
  const [period, setPeriod] = useStateH({
    mode: 'month', year: TODAY.getFullYear(), month: TODAY.getMonth(), from: '', to: ''
  });

  const allDone = ctx.aseos.filter(a => a.asignada === ctx.user && a.status === 'done');
  const inPeriod = filterByPeriod(allDone, period)
    .sort((a, b) => b.checkout - a.checkout);
  const gananciaPeriodo = inPeriod.reduce((s, a) => s + aseoEnriched(a).precio, 0);

  return (
    <div className="scrollarea">
      <AppBar title="Historial" onLogout={ctx.logout}
        actions={<button className="icon-btn" onClick={ctx.openSync} disabled={ctx.syncing} aria-label="Actualizar"><Icon name="sync" size={20} className={ctx.syncing ? 'spin' : ''} /></button>} />
      <MonthRangePicker value={period} onChange={setPeriod} />
      <div style={{ padding: '12px 20px 0' }}>
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderRadius: 12, padding: 16 }}>
          <div className="label ter" style={{ textTransform: 'capitalize' }}>{periodLabel(period)}</div>
          <div className="h1" style={{ marginTop: 4 }}>{fmtCOP(gananciaPeriodo)}</div>
          <div className="caption">{inPeriod.length} {inPeriod.length === 1 ? 'aseo completado' : 'aseos completados'}</div>
        </div>
      </div>
      <div className="aseo-list">
        <div className="day-head"><span className="label sec">Completados</span></div>
        {inPeriod.length === 0 && (
          <div className="empty"><Icon name="check" size={28} /><div className="body">Sin aseos en este período</div></div>
        )}
        {inPeriod.map(a => (
          <div key={a.codigo}>
            <AseoCard aseo={a} role="aseadora"
              open={ctx.openId === a.codigo} onToggle={() => ctx.toggle(a.codigo)} />
            {ctx.openId === a.codigo && !a.entrada && (
              <div style={{ padding: '0 16px 12px' }}>
                <button className="btn btn-secondary btn-block"
                  onClick={() => ctx.openCompletar(a)}>
                  Llenar form retroactivo
                </button>
              </div>
            )}
          </div>
        ))}
        <div style={{ height: 80 }}></div>
      </div>
    </div>
  );
}

Object.assign(window, { HoyScreen, TodosScreen, CalendarioScreen, HistorialScreen, MonthRangePicker, filterByPeriod, periodLabel, sortAseos, groupByDay });
