/* ============================================================
   Icon set — outline, 1.5px stroke, round caps/joins.
   Usage: <Icon name="calendar" size={20} />
   No emojis anywhere; these are the only pictographs in the UI.
   ============================================================ */

const ICON_PATHS = {
  home: <><path d="M4 10.5 12 4l8 6.5"/><path d="M6 9.5V19a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V9.5"/><path d="M10 20v-5h4v5"/></>,
  calendar: <><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 9h16M8 3v4M16 3v4"/></>,
  list: <><path d="M8 6h12M8 12h12M8 18h12"/><path d="M4 6h.01M4 12h.01M4 18h.01"/></>,
  check: <path d="m5 12.5 4.5 4.5L19 7"/>,
  clock: <><circle cx="12" cy="12" r="8"/><path d="M12 8v4.5l3 2"/></>,
  user: <><circle cx="12" cy="8" r="3.5"/><path d="M5.5 19.5a6.5 6.5 0 0 1 13 0"/></>,
  users: <><circle cx="9" cy="8" r="3"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><path d="M16 5.5a3 3 0 0 1 0 5.8M16.5 19a5.5 5.5 0 0 0-1.8-4.1"/></>,
  key: <><circle cx="8" cy="13" r="4"/><path d="m11 11 8-8M16 6l2 2M14.5 7.5 16 9"/></>,
  location: <><path d="M12 21s7-5.5 7-11a7 7 0 0 0-14 0c0 5.5 7 11 7 11Z"/><circle cx="12" cy="10" r="2.5"/></>,
  video: <><rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10 5-3v10l-5-3"/></>,
  upload: <><path d="M12 16V4"/><path d="m7 9 5-5 5 5"/><path d="M5 16v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2"/></>,
  filter: <path d="M4 6h16M7 12h10M10 18h4"/>,
  'chevron-right': <path d="m9 6 6 6-6 6"/>,
  'chevron-down': <path d="m6 9 6 6 6-6"/>,
  'chevron-left': <path d="m15 6-6 6 6 6"/>,
  plus: <path d="M12 5v14M5 12h14"/>,
  edit: <><path d="M16 4 20 8 9 19l-4.5 1L5.5 15.5 16 4Z"/><path d="m14 6 4 4"/></>,
  logout: <><path d="M14 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8"/><path d="m16 8 4 4-4 4M20 12H9"/></>,
  alert: <><path d="M12 4 2.5 20h19L12 4Z"/><path d="M12 10v4M12 17h.01"/></>,
  money: <><circle cx="12" cy="12" r="8"/><path d="M14.5 9.5a2.5 2 0 0 0-2.5-1.5c-1.4 0-2.5.7-2.5 1.8 0 2.6 5 1.4 5 4 0 1.1-1.1 1.9-2.5 1.9a2.6 2 0 0 1-2.6-1.6M12 6.5v1.5M12 16v1.5"/></>,
  notes: <><rect x="5" y="4" width="14" height="16" rx="2"/><path d="M9 9h6M9 13h6M9 17h3"/></>,
  sync: <><path d="M20 11a8 8 0 0 0-14-4.5L4 8"/><path d="M4 4v4h4"/><path d="M4 13a8 8 0 0 0 14 4.5L20 16"/><path d="M20 20v-4h-4"/></>,
  eye: <><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/></>,
  'eye-off': <><path d="M4 4l16 16"/><path d="M9.5 6.2A9 9 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a16 16 0 0 1-3 3.6M6.4 7.9A16 16 0 0 0 2.5 12S6 18.5 12 18.5a8.8 8.8 0 0 0 3-.5"/><path d="M9.8 10a3 3 0 0 0 4.2 4.2"/></>,
  search: <><circle cx="11" cy="11" r="6"/><path d="m16 16 4 4"/></>,
  close: <path d="M6 6l12 12M18 6 6 18"/>,
  phone: <path d="M6 4h3l1.5 4-2 1.5a11 11 0 0 0 5 5l1.5-2 4 1.5V18a2 2 0 0 1-2 2A14 14 0 0 1 4 6a2 2 0 0 1 2-2Z"/>,
  bed: <><path d="M3 17v-5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5"/><path d="M3 14h18M3 17v2M21 17v2"/></>,
  file: <><path d="M13 4H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9l-6-5Z"/><path d="M13 4v5h5"/></>,
};

function Icon({ name, size = 20, className = '', style = {} }) {
  const path = ICON_PATHS[name];
  if (!path) return null;
  return (
    <svg className={'ico ' + className} width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="1.5"
      strokeLinecap="round" strokeLinejoin="round" style={style} aria-hidden="true">
      {path}
    </svg>
  );
}

Object.assign(window, { Icon });
