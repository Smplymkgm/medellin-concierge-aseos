import icons from './icons2.js?v=4';

// Aseadora: 3 tabs
export function renderNavAseadora(activeTab = 'hoy') {
  const tabs = [
    { id: 'hoy',       label: 'Hoy',       icon: 'broom'    },
    { id: 'calendario',label: 'Calendario', icon: 'calendar' },
    { id: 'historial', label: 'Historial',  icon: 'clock'    },
  ];
  return renderNav(tabs, activeTab, 'ase');
}

// Admin: 4 tabs
export function renderNavAdmin(activeTab = 'aseos') {
  const tabs = [
    { id: 'aseos',       label: 'Aseos',      icon: 'list'     },
    { id: 'calendario',  label: 'Calendario', icon: 'calendar' },
    { id: 'propiedades', label: 'Propiedades',icon: 'home'     },
    { id: 'personal',    label: 'Personal',   icon: 'users'    },
  ];
  return renderNav(tabs, activeTab, 'adm');
}

function renderNav(tabs, activeTab, prefix) {
  return `<nav class="bottom-nav" id="${prefix}-nav">
    ${tabs.map(t => `
      <button class="nav-item${t.id === activeTab ? ' active' : ''}" data-tab="${t.id}" aria-label="${t.label}">
        ${icons.get(t.icon, 20)}
        ${t.label}
      </button>
    `).join('')}
  </nav>`;
}
