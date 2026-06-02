/* ============================================================
   Calendar — month grid with status dots + selected day list
   ============================================================ */
const { useState: useStateC, useMemo: useMemoC } = React;

function MonthCalendar({ aseos, selected, onSelect, month, year, onMonth }) {
  // build grid
  const first = new Date(year, month, 1);
  const startDow = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  // leading blanks from prev month
  const prevDays = new Date(year, month, 0).getDate();
  for (let i = startDow - 1; i >= 0; i--) cells.push({ day: prevDays - i, muted: true });
  for (let day = 1; day <= daysInMonth; day++) cells.push({ day, muted: false, date: new Date(year, month, day) });
  // trailing days from next month
  let tail = 1;
  while (cells.length % 7 !== 0) cells.push({ day: tail++, muted: true });

  // status per day
  function statusesFor(date) {
    if (!date) return [];
    const list = aseos.filter(a => sameDay(a.checkout, date));
    const order = ['urgent','pending','done','unassigned'];
    const present = [...new Set(list.map(a => a.status))];
    return order.filter(s => present.includes(s));
  }

  return (
    <>
      <div className="cal-head">
        <button className="icon-btn" onClick={() => onMonth(-1)} aria-label="Mes anterior"><Icon name="chevron-left" size={20} /></button>
        <div className="h2">{MONTHS[month].replace(/^\w/, c=>c.toUpperCase())} {year}</div>
        <button className="icon-btn" onClick={() => onMonth(1)} aria-label="Mes siguiente"><Icon name="chevron-right" size={20} /></button>
      </div>
      <div className="cal-grid">
        {DOW.map(dw => <div key={dw} className="cal-dow">{dw}</div>)}
        {cells.map((c, i) => {
          const isToday = c.date && sameDay(c.date, TODAY);
          const isSel = c.date && selected && sameDay(c.date, selected);
          const sts = statusesFor(c.date);
          return (
            <button key={i} disabled={c.muted}
              className={['cal-cell', c.muted ? 'muted' : '', isToday ? 'today' : '', isSel ? 'selected' : ''].join(' ')}
              onClick={() => c.date && onSelect(c.date)}>
              <span className="cal-num">{c.day}</span>
              {sts.length > 0 && (
                <span className="cal-dots">
                  {sts.slice(0,3).map(s => <span key={s} className="d" style={{ background: 'var(--state-' + s + ')' }}></span>)}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </>
  );
}

Object.assign(window, { MonthCalendar });
