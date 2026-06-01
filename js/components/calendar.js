// ── Monthly calendar component ────────────────────────────────
// events: array of { date: 'dd/MM/yyyy', estado: '...', urgente: bool }
// onDayClick: (dateStr) => void

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
               'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const DIAS  = ['Do','Lu','Ma','Mi','Ju','Vi','Sa'];

export class MiniCalendar {
  constructor(container, { events = [], onDayClick, selectedDate } = {}) {
    this.container   = container;
    this.events      = events;
    this.onDayClick  = onDayClick || (() => {});
    const now        = new Date();
    this.year        = now.getFullYear();
    this.month       = now.getMonth();
    this.selectedDate = selectedDate || null;
    this.render();
  }

  setEvents(events) {
    this.events = events;
    this.render();
  }

  // Build a map: 'yyyy-MM-dd' → { count, hasUrgent, allDone }
  _buildMap() {
    const map = {};
    for (const ev of this.events) {
      const d = this._parseDate(ev.date || ev.checkout);
      if (!d) continue;
      const key = d.toISOString().slice(0, 10);
      if (!map[key]) map[key] = { count: 0, hasUrgent: false, allDone: true };
      map[key].count++;
      if (ev.urgente || ev.estado === 'urgente') map[key].hasUrgent = true;
      if (ev.estado !== 'Completado') map[key].allDone = false;
    }
    return map;
  }

  _parseDate(str) {
    if (!str) return null;
    const p = str.split('/');
    if (p.length !== 3) return null;
    return new Date(parseInt(p[2]), parseInt(p[1]) - 1, parseInt(p[0]));
  }

  _todayKey() {
    return new Date().toISOString().slice(0, 10);
  }

  _selectedKey() {
    if (!this.selectedDate) return null;
    const d = this._parseDate(this.selectedDate);
    return d ? d.toISOString().slice(0, 10) : null;
  }

  render() {
    const map        = this._buildMap();
    const todayKey   = this._todayKey();
    const selKey     = this._selectedKey();
    const firstDay   = new Date(this.year, this.month, 1).getDay();
    const daysInMonth = new Date(this.year, this.month + 1, 0).getDate();
    const prevDays   = new Date(this.year, this.month, 0).getDate();

    const dayNames = DIAS.map(d => `<div class="cal-day-name">${d}</div>`).join('');
    const cells = [];

    // Previous month filler
    for (let i = firstDay - 1; i >= 0; i--) {
      cells.push(`<div class="cal-day empty other-month"><span>${prevDays - i}</span></div>`);
    }

    // Current month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(this.year, this.month, day);
      const key  = date.toISOString().slice(0, 10);
      const ev   = map[key];
      const dateStr = String(day).padStart(2,'0') + '/' +
                      String(this.month + 1).padStart(2,'0') + '/' + this.year;

      let cls = 'cal-day';
      if (key === todayKey) cls += ' today';
      if (key === selKey)   cls += ' selected';
      if (ev) {
        cls += ' has-events';
        if (ev.hasUrgent) cls += ' has-urgent';
        else if (ev.allDone) cls += ' has-done';
      }

      cells.push(`<div class="${cls}" data-date="${dateStr}">
        <span>${day}</span>
      </div>`);
    }

    // Next month filler
    const total = cells.length;
    const remaining = (7 - (total % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      cells.push(`<div class="cal-day empty other-month"><span>${i}</span></div>`);
    }

    this.container.innerHTML = `
      <div class="cal-header">
        <button class="cal-nav" id="cal-prev" aria-label="Mes anterior">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <span class="cal-month">${MESES[this.month]} ${this.year}</span>
        <button class="cal-nav" id="cal-next" aria-label="Mes siguiente">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>
      <div class="cal-grid">
        ${dayNames}
        ${cells.join('')}
      </div>
    `;

    this.container.querySelector('#cal-prev').addEventListener('click', () => {
      if (this.month === 0) { this.month = 11; this.year--; }
      else this.month--;
      this.render();
    });
    this.container.querySelector('#cal-next').addEventListener('click', () => {
      if (this.month === 11) { this.month = 0; this.year++; }
      else this.month++;
      this.render();
    });
    this.container.querySelectorAll('.cal-day:not(.empty)').forEach(el => {
      el.addEventListener('click', () => {
        this.selectedDate = el.dataset.date;
        this.onDayClick(el.dataset.date);
        this.render();
      });
    });
  }
}
