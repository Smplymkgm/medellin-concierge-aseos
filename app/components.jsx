/* ============================================================
   Shared components
   ============================================================ */
const { useState, useRef, useEffect } = React;

/* ---- Status badge: colored dot + uppercase label ---- */
function StatusBadge({ status }) {
  return (
    <span className={'status s-' + status}>
      <span className="dot"></span>{STATUS_LABEL[status]}
    </span>
  );
}

/* ---- App bar ---- */
function AppBar({ title, subtitle, actions, onLogout }) {
  return (
    <header className="appbar">
      <div>
        <div className="h1">{title}</div>
        {subtitle && <div className="caption sub">{subtitle}</div>}
      </div>
      <div className="appbar-actions">
        {actions}
        {onLogout && <button className="icon-btn" onClick={onLogout} aria-label="Salir"><Icon name="logout" size={20} /></button>}
      </div>
    </header>
  );
}

/* ---- Avatar ---- */
function Avatar({ name, className = 'avatar' }) {
  return <span className={className}>{initials(name).toUpperCase()}</span>;
}

/* ============================================================
   Aseo card — expandable, status border, optional priority
   ============================================================ */
function AseoCard({ aseo, open, onToggle, onComplete, onReassign, onFinalizarSinForm, onMoverFecha, role }) {
  const a = aseoEnriched(aseo);
  const cls = ['aseo-card', 's-' + a.status, a.priority ? 'priority' : '', open ? 'open' : ''].join(' ');
  return (
    <div className={cls}>
      <div className="aseo-head" onClick={onToggle}>
        <div className="aseo-main">
          <div className="aseo-title-row">
            {a.priority && <span className="prio-pill">Prioridad</span>}
            <span className="aseo-name">{a.propNombre}</span>
          </div>
          <div className="aseo-dates">
            <span className="aseo-checkout">Fecha de aseo {fmtDate(a.checkout).replace(/(\d+)\s+(\w+)$/, '$1 de $2')}</span>
            <span className="aseo-meta">
              Check-in {fmtShort(a.checkin)} · {a.noches} {a.noches === 1 ? 'noche' : 'noches'}
            </span>
          </div>
          <div className="row gap-base" style={{ marginTop: 10, flexWrap: 'wrap' }}>
            <StatusBadge status={a.status} />
            {a.status === 'done' && (
              <span className={'form-badge ' + (a.formFilled ? 'ok' : 'miss')}>
                {a.formFilled ? '✓ Form completado' : '⚠ Form pendiente'}
              </span>
            )}
            {role === 'admin' && (
              <span className="assignee">
                {a.asignada
                  ? <><Avatar name={a.asignada} /> {a.asignada}</>
                  : <span className="ter">Sin asignar</span>}
              </span>
            )}
            {role === 'aseadora' && a.precio > 0 && (
              <span className="assignee" style={{ fontWeight: 600 }}>
                <Icon name="money" size={14} /> {fmtCOP(a.precio)}
              </span>
            )}
          </div>
        </div>
        <Icon name="chevron-down" size={20} className="aseo-chevron" style={{ transform: open ? 'rotate(180deg)' : 'none' }} />
      </div>

      {open && (
        <div className="aseo-detail spacer">
            <div className="detail-row">
              <Icon name="location" size={16} />
              <div className="keypair">
                <span className="detail-label">Dirección</span>
                <span className="detail-value">{a.direccion}</span>
              </div>
            </div>
            {(() => {
              const tipoLabels = {
                chapa_digital: 'Chapa digital',
                llave_fisica:  'Llave física',
                caja_llaves:   'Caja de llaves',
              };
              const struct = a.accesoEstructurado;
              // Si hay estructura nueva, mostrar Externo / Interno separados
              if (struct && (struct.externo || struct.interno || struct.notas)) {
                const rows = [];
                if (struct.externo && (struct.externo.tipo || struct.externo.valor)) {
                  rows.push({ label: 'Acceso externo', tipo: tipoLabels[struct.externo.tipo] || struct.externo.tipo, valor: struct.externo.valor });
                }
                if (struct.interno && (struct.interno.tipo || struct.interno.valor)) {
                  rows.push({ label: 'Acceso interno', tipo: tipoLabels[struct.interno.tipo] || struct.interno.tipo, valor: struct.interno.valor });
                }
                return (
                  <>
                    {rows.map((r, i) => (
                      <div className="detail-row" key={i}>
                        <Icon name="key" size={16} />
                        <div className="keypair">
                          <span className="detail-label">{r.label}</span>
                          <span className="detail-value">{[r.tipo, r.valor].filter(Boolean).join(' · ')}</span>
                        </div>
                      </div>
                    ))}
                    {struct.notas && (
                      <div className="detail-row">
                        <Icon name="notes" size={16} />
                        <div className="keypair">
                          <span className="detail-label">Notas de acceso</span>
                          <span className="detail-value">{struct.notas}</span>
                        </div>
                      </div>
                    )}
                  </>
                );
              }
              // Fallback: texto libre del spreadsheet, partido por '|'
              const accesoStr = (a.claves && a.claves.acceso) || '';
              const parts = accesoStr.split('|')
                .map(s => s.trim())
                .filter(s => s && !/direcci[oó]n/i.test(s));
              if (parts.length === 0) return null;
              return (
                <div className="detail-row">
                  <Icon name="key" size={16} />
                  <div className="keypair">
                    <span className="detail-label">Acceso</span>
                    {parts.map((p, i) => <span key={i} className="detail-value" style={{ display: 'block' }}>{p}</span>)}
                  </div>
                </div>
              );
            })()}
            {a.notas && (
              <div className="detail-row">
                <Icon name="notes" size={16} />
                <div className="keypair">
                  <span className="detail-label">Notas</span>
                  <span className="detail-value">{a.notas}</span>
                </div>
              </div>
            )}
            <div className="detail-row">
              <Icon name="money" size={16} />
              <div className="keypair">
                <span className="detail-label">{role === 'aseadora' ? 'Pago del aseo' : 'Precio aseo'}</span>
                <span className="detail-value">
                  {a.precio > 0
                    ? fmtCOP(a.precio)
                    : <span className="caption sec">Sin cargo · paga propietario</span>}
                </span>
              </div>
            </div>

            {a.status !== 'done' && (
              <div className="aseo-actions" style={{ flexWrap: 'wrap' }}>
                {role === 'aseadora'
                  ? <button className="btn btn-primary btn-block" onClick={() => onComplete(a)}>Completar</button>
                  : <>
                      <button className="btn btn-primary" onClick={() => onReassign && onReassign(a)}>
                        {a.asignada ? 'Reasignar' : 'Asignar'}
                      </button>
                      <button className="btn btn-secondary" onClick={() => onComplete(a)}>Completar</button>
                      {onMoverFecha && (
                        <button className="btn btn-ghost" onClick={() => onMoverFecha(a)}
                          title="Cambiar la fecha del aseo">
                          Cambiar fecha
                        </button>
                      )}
                      {a.asignada && onFinalizarSinForm && (
                        <button className="btn btn-ghost" onClick={() => onFinalizarSinForm(a)}
                          title="Marca como completado sin llenar el form (para aseos viejos)">
                          Finalizar sin form
                        </button>
                      )}
                    </>}
              </div>
            )}
            {a.status === 'done' && a.completadoEl && (
              <>
                <div className="detail-row">
                  <Icon name="check" size={16} style={{ color: 'var(--state-done)' }} />
                  <span className="detail-value sec">Completado {fmtDate(a.completadoEl)}{a.tipo ? ' · ' + a.tipo : ''}</span>
                </div>
                {(a.entrada || a.salida) && (
                  <div className="detail-row">
                    <Icon name="clock" size={16} />
                    <div className="keypair">
                      <span className="detail-label">Horario</span>
                      <span className="detail-value">{a.entrada || '—'} – {a.salida || '—'}</span>
                    </div>
                  </div>
                )}
                {(() => {
                  const flags = flaggedAreas(a);
                  if (!flags.length && (a.revision || a.funcionamiento)) {
                    return <div className="ok-line"><Icon name="check" size={16} /> Todo en orden, sin novedades</div>;
                  }
                  if (!flags.length) return null;
                  return (
                    <div>
                      <div className="detail-label" style={{ marginBottom: 6 }}>Requiere atención ({flags.length})</div>
                      <div className="flag-box">
                        {flags.map((f, i) => <div className="flag-item" key={i}><span className="dot"></span>{f}</div>)}
                      </div>
                    </div>
                  );
                })()}
                {a.reporte && (
                  <div className="detail-row">
                    <Icon name="alert" size={16} style={{ color: 'var(--state-pending)' }} />
                    <div className="keypair">
                      <span className="detail-label">Reporte</span>
                      <span className="detail-value">{a.reporte}</span>
                    </div>
                  </div>
                )}
                {a.video && (
                  <div className="detail-row">
                    <Icon name="video" size={16} />
                    <div className="keypair">
                      <span className="detail-label">Soporte</span>
                      <span className="detail-value">{a.video}</span>
                    </div>
                  </div>
                )}
              </>
            )}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   Compact card (calendar day list)
   ============================================================ */
function CompactCard({ aseo, onClick }) {
  const a = aseoEnriched(aseo);
  return (
    <div className={'compact-card s-' + a.status} onClick={onClick}>
      <div className="cc-main">
        <div className="cc-name">{a.propNombre}</div>
        <div className="caption">{a.asignada || 'Sin asignar'} · {a.noches} noches</div>
      </div>
      <StatusBadge status={a.status} />
    </div>
  );
}

/* ============================================================
   Bottom navigation
   ============================================================ */
function BottomNav({ tabs, active, onChange }) {
  return (
    <nav className="bottomnav">
      {tabs.map(t => (
        <button key={t.id} className={'navtab' + (active === t.id ? ' active' : '')} onClick={() => onChange(t.id)}>
          <Icon name={t.icon} size={22} />
          <span className="navlabel">{t.label}</span>
          {t.badge ? <span className="nav-badge">{t.badge}</span> : null}
        </button>
      ))}
    </nav>
  );
}

/* ============================================================
   Segmented control + checklist row (Completar wizard)
   ============================================================ */
function SegControl({ value, onChange, options }) {
  // options: [{ key, label, state }]  state ∈ 'done'|'pending'|'neutral'
  return (
    <div className="seg">
      {options.map(o => (
        <button key={o.key} type="button"
          className={'seg-opt' + (value === o.key ? ' on s-' + o.state : '')}
          onClick={() => onChange(o.key)}>
          <span className="seg-dot"></span>{o.label}
        </button>
      ))}
    </div>
  );
}

function CheckRow({ label, hint, value, onChange, options }) {
  return (
    <div className="checkrow">
      <div className="q">{label}</div>
      {hint && <div className="qhint">{hint}</div>}
      <SegControl value={value} onChange={onChange} options={options} />
    </div>
  );
}

/* ============================================================
   Bottom sheet
   ============================================================ */
function Sheet({ open, onClose, title, children, footer, height }) {
  return (
    <>
      <div className={'overlay' + (open ? ' show' : '')} onClick={onClose}></div>
      <div className={'sheet' + (open ? ' show' : '')} style={height ? { height } : null}>
        <div className="sheet-handle"></div>
        {title && (
          <div className="sheet-head">
            <div className="h2">{title}</div>
            <button className="icon-btn" onClick={onClose} aria-label="Cerrar"><Icon name="close" size={20} /></button>
          </div>
        )}
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-foot">{footer}</div>}
      </div>
    </>
  );
}

Object.assign(window, { StatusBadge, AppBar, Avatar, AseoCard, CompactCard, BottomNav, Sheet, SegControl, CheckRow });
