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
  const hoy = mine.filter(a => sameDay(a.checkout, TODAY));
  const proximos = mine.filter(a => a.checkout > TODAY);
  const sortedHoy = sortAseos(hoy);

  return (
    <div className="scrollarea">
      <AppBar title={'Hola, ' + ctx.user} subtitle={fmtDate(TODAY)} onLogout={ctx.logout} />
      <div className="aseo-list">
        <div className="day-head">
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

function CalendarioScreen({ ctx, role }) {
  const list = role === 'admin' ? ctx.aseos : ctx.aseos.filter(a => a.asignada === ctx.user);
  const dayItems = sortAseos(list.filter(a => ctx.calSel && sameDay(a.checkout, ctx.calSel)));
  return (
    <div className="scrollarea">
      <AppBar title="Calendario" onLogout={ctx.logout} />
      <MonthCalendar aseos={list} selected={ctx.calSel} onSelect={ctx.setCalSel}
        month={ctx.calMonth} year={ctx.calYear} onMonth={ctx.shiftMonth} />
      <div className="cal-daylist">
        <div className="cal-daylabel label sec">{ctx.calSel ? fmtDate(ctx.calSel) : 'Selecciona un día'}</div>
        {ctx.calSel && dayItems.length === 0 && <div className="caption" style={{ paddingBottom: 16 }}>Sin aseos este día</div>}
        {dayItems.map(a => (
          <CompactCard key={a.codigo} aseo={a} onClick={() => ctx.goToAseo(a)} />
        ))}
        <div style={{ height: 16 }}></div>
      </div>
    </div>
  );
}

function HistorialScreen({ ctx }) {
  const done = ctx.aseos.filter(a => a.asignada === ctx.user && a.status === 'done')
    .sort((a, b) => (b.completadoEl || b.checkout) - (a.completadoEl || a.checkout));
  const ganancia = done.reduce((s, a) => s + aseoEnriched(a).precio, 0);
  const esteMes = done.filter(a => (a.completadoEl || a.checkout).getMonth() === TODAY.getMonth());
  const gananciaMes = esteMes.reduce((s, a) => s + aseoEnriched(a).precio, 0);

  return (
    <div className="scrollarea">
      <AppBar title="Historial" onLogout={ctx.logout} />
      <div style={{ padding: '4px 20px 0' }}>
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderRadius: 12, padding: 16, display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div className="label ter">Ganancia mayo</div>
            <div className="h1" style={{ marginTop: 4 }}>{fmtCOP(gananciaMes)}</div>
            <div className="caption">{esteMes.length} aseos completados</div>
          </div>
          <div style={{ width: 1, background: 'var(--border-light)' }}></div>
          <div style={{ flex: 1 }}>
            <div className="label ter">Acumulado</div>
            <div className="h1" style={{ marginTop: 4 }}>{fmtCOP(ganancia)}</div>
            <div className="caption">{done.length} en total</div>
          </div>
        </div>
      </div>
      <div className="aseo-list">
        <div className="day-head"><span className="label sec">Completados</span></div>
        {done.map(a => (
          <AseoCard key={a.codigo} aseo={a} role="aseadora"
            open={ctx.openId === a.codigo} onToggle={() => ctx.toggle(a.codigo)} />
        ))}
        <div style={{ height: 16 }}></div>
      </div>
    </div>
  );
}

Object.assign(window, { HoyScreen, CalendarioScreen, HistorialScreen, sortAseos, groupByDay });
