/* ============================================================
   Action sheets: Completar aseo, Reasignar, Agregar aseo
   ============================================================ */
const { useState: useStateS, useRef: useRefS, useEffect: useEffectS } = React;

/* ---- Completar aseo: asistente de 4 pasos según el form real ---- */
const STEP_TITLES = ['Datos del servicio', 'Revisión de aseo', 'Funcionamiento', 'Fotos y videos'];

function CompletarSheet({ open, aseo, onClose, onDone }) {
  const [step, setStep] = useStateS(0);
  const [entrada, setEntrada] = useStateS('');
  const [salida, setSalida] = useStateS('');
  const [notas, setNotas] = useStateS('');
  const [revision, setRevision] = useStateS({});
  const [reposicion, setReposicion] = useStateS({});
  const [funcionamiento, setFuncionamiento] = useStateS({});
  const [reporte, setReporte] = useStateS('');
  const [file, setFile] = useStateS(null);
  const [progress, setProgress] = useStateS(0);
  const [uploading, setUploading] = useStateS(false);
  const fileRef = useRefS(null);
  const timer = useRefS(null);
  const bodyRef = useRefS(null);

  useEffectS(() => {
    if (open) {
      setStep(0); setEntrada(''); setSalida(''); setNotas('');
      setRevision({}); setReposicion({}); setFuncionamiento({}); setReporte('');
      setFile(null); setProgress(0); setUploading(false);
    }
    return () => clearInterval(timer.current);
  }, [open]);

  const a = aseo ? aseoEnriched(aseo) : null;

  function realUpload(f) {
    setFile({ name: f.name, size: f.size });
    setUploading(true);
    setProgress(0);

    // 1. Pedir resumable URL al backend
    gasPost({
      action: 'getUploadUrl',
      codigo: a.codigo,
      propiedad: a.propNombre,
      aseadora: a.asignada || '',
      filename: f.name,
    }).then(res => {
      if (!res || !res.ok) throw new Error((res && res.error) || 'No se pudo iniciar upload');
      const data = res.data || {};
      const uploadUrl = data.uploadUrl;
      const finalName = data.filename || f.name;
      if (!uploadUrl) throw new Error('Sin uploadUrl');

      // 2. PUT al resumable URL con progreso real
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', uploadUrl);
      xhr.setRequestHeader('Content-Type', f.type || 'video/mp4');
      xhr.upload.onprogress = ev => {
        if (ev.lengthComputable) setProgress(Math.round(ev.loaded / ev.total * 100));
      };
      let uploadFinished = false;

      function finalizeSuccess(fileId) {
        if (uploadFinished) return;
        uploadFinished = true;
        const link = fileId ? ('https://drive.google.com/file/d/' + fileId + '/view') : '';
        setFile({ name: finalName, size: f.size, fileId: fileId, link: link, mime: f.type });
        setProgress(100);
        setUploading(false);
        // Siempre registrar — si fileId está vacío, el backend lo busca
        // por filename en la carpeta de la propiedad. Esto repara el caso
        // Safari + CORS.
        gasPost({
          action: 'registrarVideo',
          codigo: a.codigo,
          propiedad: a.propNombre,
          aseadora: a.asignada || '',
          checkout: '',
          fileId: fileId,
          filename: finalName,
          notas: '',
        }).then(reg => {
          if (reg && reg.ok && reg.data && reg.data.link && !file?.link) {
            // backend resolvió el link a posteriori
            setFile(curr => curr ? { ...curr, fileId: reg.data.fileId || curr.fileId, link: reg.data.link } : curr);
          }
        }).catch(() => {});
      }

      xhr.onload = () => {
        if (uploadFinished) return;
        // 200/201 = success. 308 is "Resume Incomplete" (no debería pasar
        // en una sola PUT pero por si acaso). 0 puede pasar en Safari iOS
        // si el response viene con headers que el browser bloquea — la
        // subida real ya terminó, solo no podemos leer el body.
        const okStatus = (xhr.status >= 200 && xhr.status < 300) || xhr.status === 0;
        let fileId = '';
        try {
          const resp = JSON.parse(xhr.responseText);
          fileId = resp.id || '';
        } catch (e) {}
        if (okStatus) {
          finalizeSuccess(fileId);
        } else {
          uploadFinished = true;
          setUploading(false);
          alert('Error subiendo (' + xhr.status + '): ' + (xhr.responseText || '').slice(0, 200));
        }
      };

      xhr.onerror = () => {
        // Si el upload ya progresó al 100% y entonces falla la lectura
        // del response (Safari + CORS), el archivo ya está en Drive.
        // No molestamos al usuario; le mostramos un aviso suave.
        if (uploadFinished) return;
        if (progress >= 99) {
          finalizeSuccess('');
          showAlertSoft('Video subido a Drive. No se pudo confirmar el link automáticamente.');
        } else {
          uploadFinished = true;
          setUploading(false);
          alert('Error de red durante el upload');
        }
      };

      function showAlertSoft(msg) {
        // No usar alert() para no bloquear el flujo; usar console + algo no intrusivo
        try { console.warn(msg); } catch(e) {}
      }

      xhr.send(f);
    }).catch(err => {
      setUploading(false);
      alert('Error: ' + (err && err.message || err));
    });
  }
  function pickFile(e) {
    const f = e.target.files && e.target.files[0];
    if (f) realUpload(f);
    e.target.value = '';
  }
  function fmtSize(b) { return b > 1e6 ? (b/1e6).toFixed(1) + ' MB' : Math.round(b/1e3) + ' KB'; }

  // option sets
  const aseoOpts  = na => [{ key:'ok', label:'Aseada', state:'done' }, { key:'review', label:'Requiere mejora', state:'pending' }, ...(na ? [{ key:'na', label:'No aplica', state:'neutral' }] : [])];
  const funcOpts  = na => [{ key:'ok', label:'Funciona', state:'done' }, { key:'review', label:'Requiere atención', state:'pending' }, ...(na ? [{ key:'na', label:'No aplica', state:'neutral' }] : [])];
  const siNoOpts  = [{ key:'si', label:'Sí', state:'done' }, { key:'no', label:'No', state:'pending' }];

  function markAllAseoOk() {
    const r = {}; CHECK_ASEO.forEach(q => r[q.id] = 'ok');
    const rp = {}; CHECK_REPOSICION.forEach(q => rp[q.id] = 'si');
    setRevision(r); setReposicion(rp);
  }
  function markAllFuncOk() { const f = {}; CHECK_FUNCIONA.forEach(q => f[q.id] = 'ok'); setFuncionamiento(f); }

  // per-step validity
  const step0ok = entrada && salida;
  const step1ok = CHECK_ASEO.every(q => revision[q.id]) && CHECK_REPOSICION.every(q => reposicion[q.id]);
  const step2ok = CHECK_FUNCIONA.every(q => funcionamiento[q.id]);
  const step3ok = file && progress >= 100 && !uploading;
  const stepValid = [step0ok, step1ok, step2ok, step3ok][step];

  function goStep(n) { setStep(n); if (bodyRef.current) bodyRef.current.scrollTop = 0; }
  function next() { if (step < 3 && stepValid) goStep(step + 1); }
  function finish() {
    const repoBool = {}; CHECK_REPOSICION.forEach(q => repoBool[q.id] = reposicion[q.id] === 'si');
    onDone(aseo, { entrada, salida, notas, revision, reposicion: repoBool, funcionamiento, reporte, file });
  }

  const footer = (
    <div className="row gap-base">
      {step > 0 && <button className="btn btn-secondary" style={{ flex: '0 0 auto', minWidth: 96 }} onClick={() => goStep(step - 1)}>Atrás</button>}
      {step < 3
        ? <button className="btn btn-primary" style={{ flex: 1 }} disabled={!stepValid} onClick={next}>Continuar</button>
        : <button className="btn btn-primary" style={{ flex: 1 }} disabled={!step3ok} onClick={finish}>Enviar y completar</button>}
    </div>
  );

  return (
    <Sheet open={open} onClose={onClose} title="Completar aseo" footer={footer} height="90%">
      {a && (
        <div ref={bodyRef}>
          {/* persistent property header */}
          <div className="row gap-base" style={{ marginBottom: 16 }}>
            <div className="prop-thumb" style={{ width: 40, height: 40, fontSize: 13 }}>{propInitials(a.propNombre)}</div>
            <div style={{ minWidth: 0 }}>
              <div className="h3">{a.propNombre}</div>
              <div className="caption">{a.codigo} · {a.direccion}</div>
            </div>
          </div>

          {/* step header */}
          <div className="wiz-head">
            <div className="wiz-step-label">
              <span className="label sec">Paso {step + 1} de 4</span>
              <span className="caption">{STEP_TITLES[step]}</span>
            </div>
            <div className="wiz-progress">{[0,1,2,3].map(i => <span key={i} className={'seg-bar' + (i <= step ? ' on' : '')}></span>)}</div>
          </div>

          {/* STEP 0 — Datos del servicio */}
          {step === 0 && (
            <>
              <div className="form-group">
                <label className="label">Aseadora</label>
                <div className="text-input" style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-primary)' }}>
                  <Icon name="user" size={16} style={{ color: 'var(--text-tertiary)' }} />
                  {a.asignada || 'Sin asignar'}
                </div>
              </div>
              <div className="form-group">
                <label className="label">Fecha del servicio</label>
                <div className="text-input" style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-primary)' }}>
                  <Icon name="calendar" size={16} style={{ color: 'var(--text-tertiary)' }} />
                  {fmtDate(a.checkout)}
                </div>
              </div>
              <div className="row gap-base" style={{ alignItems: 'flex-start' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="label">Hora de entrada</label>
                  <input type="time" className="text-input" value={entrada} onChange={e => setEntrada(e.target.value)} />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="label">Hora de salida</label>
                  <input type="time" className="text-input" value={salida} onChange={e => setSalida(e.target.value)} />
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="label">Notas (opcional)</label>
                <textarea className="textarea" rows="2" placeholder="Observaciones generales…" value={notas} onChange={e => setNotas(e.target.value)} />
              </div>
            </>
          )}

          {/* STEP 1 — Revisión de aseo */}
          {step === 1 && (
            <>
              <div className="wiz-blurb">Marca cada área aseada y revisada antes de salir. Indica si algo requiere revisión o mejora.</div>
              <div className="check-quick"><button className="linkbtn" onClick={markAllAseoOk}>Marcar todo como correcto</button></div>
              {CHECK_ASEO.map(q => (
                <CheckRow key={q.id} label={q.label} hint={q.hint}
                  value={revision[q.id]} onChange={v => setRevision(s => ({ ...s, [q.id]: v }))}
                  options={aseoOpts(q.na)} />
              ))}
              <div className="label sec" style={{ margin: '20px 0 4px' }}>Reposición de insumos</div>
              {CHECK_REPOSICION.map(q => (
                <CheckRow key={q.id} label={q.label}
                  value={reposicion[q.id]} onChange={v => setReposicion(s => ({ ...s, [q.id]: v }))}
                  options={siNoOpts} />
              ))}
            </>
          )}

          {/* STEP 2 — Funcionamiento */}
          {step === 2 && (
            <>
              <div className="wiz-blurb">Si algo no funciona o empieza a deteriorarse, repórtalo de inmediato para darle solución a tiempo.</div>
              <div className="check-quick"><button className="linkbtn" onClick={markAllFuncOk}>Marcar todo como correcto</button></div>
              {CHECK_FUNCIONA.map(q => (
                <CheckRow key={q.id} label={q.label}
                  value={funcionamiento[q.id]} onChange={v => setFuncionamiento(s => ({ ...s, [q.id]: v }))}
                  options={funcOpts(q.na)} />
              ))}
              <div className="form-group" style={{ marginTop: 20, marginBottom: 0 }}>
                <label className="label">Reporte de daños o deterioro (opcional)</label>
                <textarea className="textarea" rows="3" placeholder="¿Qué no funciona o se está dañando? Especifica…" value={reporte} onChange={e => setReporte(e.target.value)} />
              </div>
            </>
          )}

          {/* STEP 3 — Fotos y videos */}
          {step === 3 && (
            <>
              <div className="wiz-blurb">Carga el video del aseo desde tu galería o grábalo con la cámara. Se guarda automáticamente en Drive en la carpeta de la propiedad.</div>
              <input ref={fileRef} type="file" accept="video/*" hidden onChange={pickFile} />
              {!file ? (
                <div className="upload-zone" onClick={() => fileRef.current && fileRef.current.click()}>
                  <Icon name="upload" size={24} />
                  <div className="h3">Seleccionar video</div>
                  <div className="caption">Galería o cámara · Carpeta: {a.propNombre}</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div className="file-preview">
                    <div className="file-thumb"><Icon name="video" size={20} /></div>
                    <div className="file-info">
                      <div className="file-name">{file.name}</div>
                      <div className="caption">{fmtSize(file.size)}{uploading ? (' · subiendo ' + progress + '%') : ' · subido a Drive'}</div>
                    </div>
                    {!uploading && progress >= 100 && <Icon name="check" size={20} style={{ color: 'var(--state-done)' }} />}
                  </div>
                  <div className="progress"><div className="progress-bar" style={{ width: progress + '%' }}></div></div>
                  {!uploading && progress >= 100 && (
                    <div className="row gap-base" style={{ flexWrap: 'wrap' }}>
                      <button className="linkbtn" onClick={() => fileRef.current && fileRef.current.click()}>Reemplazar archivo</button>
                      {file.link && <a className="linkbtn" href={file.link} target="_blank" rel="noopener">Ver en Drive</a>}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </Sheet>
  );
}

/* ---- Reasignar aseo: chips de aseadoras ---- */
function ReassignSheet({ open, aseo, onClose, onAssign }) {
  const [sel, setSel] = useStateS(null);
  useEffectS(() => { if (open && aseo) setSel(aseo.asignada || null); }, [open, aseo]);
  const a = aseo ? aseoEnriched(aseo) : null;
  const cleaners = getPersonal().filter(p => p.rol === 'aseadora').map(p => p.nombre);

  const footer = (
    <button className="btn btn-primary btn-block btn-lg" onClick={() => onAssign(aseo, sel)}>
      {sel ? 'Confirmar asignación' : 'Dejar sin asignar'}
    </button>
  );
  return (
    <Sheet open={open} onClose={onClose} title="Reasignar aseo" footer={footer} height="auto">
      {a && (
        <>
          <div className="caption" style={{ marginBottom: 16 }}>{a.propNombre} · Checkout {fmtShort(a.checkout)}</div>
          <label className="label" style={{ display: 'block', color: 'var(--text-tertiary)', marginBottom: 12 }}>Asignar a</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {cleaners.map(c => (
              <button key={c} className={'team-row' + (sel === c ? ' sel' : '')}
                style={{ cursor: 'pointer', textAlign: 'left', border: sel === c ? '1.5px solid var(--accent)' : '1px solid var(--border-light)', background: sel === c ? 'var(--accent-subtle)' : 'var(--bg-surface)' }}
                onClick={() => setSel(c)}>
                <span className="team-avatar">{initials(c).toUpperCase()}</span>
                <div className="team-main"><div className="h3">{c}</div></div>
                {sel === c && <Icon name="check" size={20} style={{ color: 'var(--accent)' }} />}
              </button>
            ))}
            <button className={'team-row'} style={{ cursor: 'pointer', textAlign: 'left', border: sel === null ? '1.5px solid var(--accent)' : '1px solid var(--border-light)', background: sel === null ? 'var(--accent-subtle)' : 'var(--bg-surface)' }} onClick={() => setSel(null)}>
              <span className="team-avatar" style={{ background: 'var(--bg-muted)', color: 'var(--text-tertiary)' }}><Icon name="user" size={20} /></span>
              <div className="team-main"><div className="h3">Sin asignar</div></div>
              {sel === null && <Icon name="check" size={20} style={{ color: 'var(--accent)' }} />}
            </button>
          </div>
        </>
      )}
    </Sheet>
  );
}

/* ---- Agregar aseo extra: Full / Express toggle, cálculo precio ---- */
function AgregarAseoSheet({ open, onClose, onAdd }) {
  // Robust contra getProps() vacío (cuando la app aún no terminó de cargar).
  const firstProp = () => (getProps() || [])[0] || { id: '', precio: 0 };
  const [propId, setPropId] = useStateS(() => firstProp().id);
  const [fecha, setFecha] = useStateS(() => {
    var t = new Date(); return t.getFullYear() + '-' + String(t.getMonth()+1).padStart(2,'0') + '-' + String(t.getDate()).padStart(2,'0');
  });
  const [asignada, setAsignada] = useStateS(null);
  const [tipo, setTipo] = useStateS('Full');
  const [precio, setPrecio] = useStateS(() => firstProp().precio || 0);
  const [notas, setNotas] = useStateS('');
  const [query, setQuery] = useStateS('');

  useEffectS(() => {
    if (open) {
      const fp = firstProp();
      setPropId(fp.id); setAsignada(null);
      setTipo('Full'); setPrecio(fp.precio || 0); setNotas(''); setQuery('');
      var t = new Date();
      setFecha(t.getFullYear() + '-' + String(t.getMonth()+1).padStart(2,'0') + '-' + String(t.getDate()).padStart(2,'0'));
    }
  }, [open]);

  const prop = propId ? propById(propId) : null;
  const base = prop ? prop.precio : 0;
  const finalPrecio = tipo === 'Express' ? Math.round(base * 0.60) : precio;
  const cleaners = (getPersonal() || []).filter(p => p.rol === 'aseadora').map(p => p.nombre);
  const filtered = (getProps() || []).filter(p => (p.nombre || '').toLowerCase().includes(query.toLowerCase()));

  function selectProp(id) {
    setPropId(id);
    const found = propById(id);
    setPrecio(found ? found.precio : 0);
    setQuery('');
  }

  const footer = (
    <button className="btn btn-primary btn-block btn-lg" onClick={() => onAdd({ propId, fecha, asignada, tipo, precio: finalPrecio, notas })}>
      Agregar aseo
    </button>
  );

  return (
    <Sheet open={open} onClose={onClose} title="Agregar aseo" footer={footer} height="85%">
      <div className="form-group">
        <label className="label">Propiedad</label>
        <div className="text-input" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <Icon name="search" size={16} style={{ color: 'var(--text-tertiary)' }} />
          <input style={{ border: 'none', background: 'transparent', flex: 1, fontFamily: 'inherit', fontSize: 14, outline: 'none' }}
            placeholder={prop ? prop.nombre : 'Buscar propiedad'} value={query} onChange={e => setQuery(e.target.value)} />
        </div>
        {query && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 160, overflowY: 'auto', marginBottom: 4 }}>
            {filtered.map(p => (
              <button key={p.id} className="prop-row" style={{ padding: 10, cursor: 'pointer' }} onClick={() => selectProp(p.id)}>
                <div className="prop-thumb" style={{ width: 32, height: 32, fontSize: 11 }}>{propInitials(p.nombre)}</div>
                <div className="prop-main"><div className="h3">{p.nombre}</div></div>
              </button>
            ))}
            {filtered.length === 0 && <div className="caption" style={{ padding: 8 }}>Sin resultados</div>}
          </div>
        )}
      </div>

      <div className="form-group">
        <label className="label">Fecha</label>
        <input type="date" className="text-input" value={fecha} onChange={e => setFecha(e.target.value)} />
      </div>

      <div className="form-group">
        <label className="label">Aseadora</label>
        <div className="chips" style={{ padding: 0 }}>
          {cleaners.map(c => (
            <button key={c} className={'chip' + (asignada === c ? ' active' : '')} onClick={() => setAsignada(c)}>{c}</button>
          ))}
          <button className={'chip' + (asignada === null ? ' active' : '')} onClick={() => setAsignada(null)}>Sin asignar</button>
        </div>
      </div>

      <div className="form-group">
        <label className="label">Tipo de aseo</label>
        <div className="toggle-group">
          <button className={'toggle-opt' + (tipo === 'Full' ? ' active' : '')} onClick={() => setTipo('Full')}>
            <span className="t-name">Full</span>
            <span className="t-sub">Precio estándar</span>
          </button>
          <button className={'toggle-opt' + (tipo === 'Express' ? ' active' : '')} onClick={() => setTipo('Express')}>
            <span className="t-name">Express</span>
            <span className="t-sub">40% descuento</span>
          </button>
        </div>
        {tipo === 'Express' && (
          <div className="price-calc">
            <span className="amt">{fmtCOP(finalPrecio)}</span>
            <span className="was">{fmtCOP(base)}</span>
            <span>precio Express</span>
          </div>
        )}
      </div>

      <div className="form-group">
        <label className="label">Precio</label>
        <input type="text" className="text-input" disabled={tipo === 'Express'}
          value={fmtCOP(finalPrecio)} onChange={e => setPrecio(parseInt(e.target.value.replace(/\D/g,'')) || 0)} />
      </div>

      <div className="form-group" style={{ marginBottom: 0 }}>
        <label className="label">Notas (opcional)</label>
        <input type="text" className="text-input" placeholder="Una línea" value={notas} onChange={e => setNotas(e.target.value)} />
      </div>
    </Sheet>
  );
}

/* ---- Crear / editar propiedad: maneja todos los datos del registro ---- */
const TIPOS_ACCESO = [
  { value: '',              label: 'Sin acceso' },
  { value: 'chapa_digital', label: 'Chapa digital' },
  { value: 'llave_fisica',  label: 'Llave física' },
  { value: 'caja_llaves',   label: 'Caja de llaves' },
];

function EditarPropiedadSheet({ open, prop, onClose, onSave }) {
  const isEdit = !!prop;
  const [form, setForm] = useStateS(null);
  useEffectS(() => {
    if (!open) return;
    const struct = (prop && prop.accesoEstructurado) || {};
    const ext = struct.externo || {};
    const intn = struct.interno || {};
    if (prop) setForm({
      id: prop.id, nombre: prop.nombre, direccion: struct.direccion || prop.direccion || '',
      precio: prop.precio || 0,
      ext_tipo: ext.tipo || '', ext_valor: ext.valor || '',
      int_tipo: intn.tipo || '', int_valor: intn.valor || '',
      notas: struct.notas || '',
      acceso: (prop.claves && prop.claves.acceso) || '',
      ical: prop.ical || '',
    });
    else setForm({
      id: nextPropId(), nombre: '', direccion: '', precio: 50000,
      ext_tipo: '', ext_valor: '', int_tipo: '', int_valor: '', notas: '',
      acceso: '', ical: '',
    });
  }, [open, prop]);

  const title = isEdit ? 'Editar propiedad' : 'Agregar propiedad';
  if (!form) return <Sheet open={open} onClose={onClose} title={title} height="88%"></Sheet>;
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const precioNum = parseInt(String(form.precio).replace(/\D/g, '')) || 0;
  const canSave = form.nombre.trim();

  function save() {
    const accesoEstructurado = {
      direccion: form.direccion.trim(),
      externo:   form.ext_tipo || form.ext_valor.trim() ? { tipo: form.ext_tipo, valor: form.ext_valor.trim() } : null,
      interno:   form.int_tipo || form.int_valor.trim() ? { tipo: form.int_tipo, valor: form.int_valor.trim() } : null,
      notas:     form.notas.trim() || '',
    };
    onSave(isEdit ? prop.id : null, {
      id: form.id.trim() || nextPropId(),
      nombre: form.nombre.trim(),
      direccion: form.direccion.trim(),
      precio: precioNum,
      acceso: form.acceso.trim(),
      accesoEstructurado: accesoEstructurado,
      ical: form.ical.trim(),
    });
  }

  const footer = <button className="btn btn-primary btn-block btn-lg" disabled={!canSave} onClick={save}>{isEdit ? 'Guardar cambios' : 'Crear propiedad'}</button>;

  function TipoSelect({ value, onChange }) {
    return (
      <div className="select">
        <select value={value} onChange={e => onChange(e.target.value)}
          style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-light)', background: 'var(--bg-surface)', fontFamily: 'inherit', fontSize: 14, appearance: 'none' }}>
          {TIPOS_ACCESO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <Icon name="chevron-down" size={18} className="chev" />
      </div>
    );
  }

  return (
    <Sheet open={open} onClose={onClose} title={title} footer={footer} height="92%">
      <div className="row gap-base" style={{ marginBottom: 20 }}>
        <div className="prop-thumb" style={{ width: 44, height: 44, fontSize: 14 }}>{propInitials(form.nombre) || '—'}</div>
        <div className="caption">{isEdit ? 'Editando registro · ' + prop.id : 'Nuevo registro · ' + form.id}</div>
      </div>

      <div className="form-group">
        <label className="label">Nombre de la propiedad</label>
        <input className="text-input" value={form.nombre} onChange={e => set('nombre', e.target.value)} placeholder="Ej. Manila Luxury Suites 301" />
      </div>

      <div className="form-group">
        <label className="label">Código</label>
        <input className="text-input" value={form.id} onChange={e => set('id', e.target.value)} placeholder="#0000" />
      </div>

      <div className="form-group">
        <label className="label">Dirección</label>
        <input className="text-input" value={form.direccion} onChange={e => set('direccion', e.target.value)} placeholder="Cra 00 #00-00, suit 0" />
      </div>

      <div className="form-group">
        <label className="label">Precio aseo (COP)</label>
        <input className="text-input" inputMode="numeric" value={fmtCOP(precioNum)} onChange={e => set('precio', e.target.value)} />
      </div>

      <div className="divider"></div>
      <div className="section-title" style={{ marginBottom: 12 }}><Icon name="key" size={16} /><span className="h3">Acceso externo</span></div>
      <div className="caption" style={{ marginBottom: 12 }}>Puerta del edificio o entrada principal del apto.</div>
      <div className="row gap-base" style={{ alignItems: 'flex-start' }}>
        <div className="form-group" style={{ flex: 1 }}>
          <label className="label">Tipo</label>
          <TipoSelect value={form.ext_tipo} onChange={v => set('ext_tipo', v)} />
        </div>
        <div className="form-group" style={{ flex: 1 }}>
          <label className="label">Clave / código / ubicación</label>
          <input className="text-input" value={form.ext_valor} onChange={e => set('ext_valor', e.target.value)} placeholder="123456" />
        </div>
      </div>

      <div className="divider"></div>
      <div className="section-title" style={{ marginBottom: 12 }}><Icon name="key" size={16} /><span className="h3">Acceso interno</span></div>
      <div className="caption" style={{ marginBottom: 12 }}>Suite o habitación. Opcional si la propiedad es un apto completo.</div>
      <div className="row gap-base" style={{ alignItems: 'flex-start' }}>
        <div className="form-group" style={{ flex: 1 }}>
          <label className="label">Tipo</label>
          <TipoSelect value={form.int_tipo} onChange={v => set('int_tipo', v)} />
        </div>
        <div className="form-group" style={{ flex: 1 }}>
          <label className="label">Clave / código / ubicación</label>
          <input className="text-input" value={form.int_valor} onChange={e => set('int_valor', e.target.value)} placeholder="0000" />
        </div>
      </div>

      <div className="form-group">
        <label className="label">Notas de acceso (opcional)</label>
        <textarea className="textarea" rows="2" value={form.notas} onChange={e => set('notas', e.target.value)} placeholder="Llaves en porteria, instrucciones, etc." />
      </div>

      <div className="divider"></div>
      <div className="form-group">
        <label className="label">URL iCal (Airbnb)</label>
        <input className="text-input" value={form.ical} onChange={e => set('ical', e.target.value)} placeholder="https://airbnb.com/calendar/ical/…" />
      </div>

      <div className="form-group" style={{ marginBottom: 0 }}>
        <label className="label">Acceso (texto libre, legacy)</label>
        <textarea className="textarea" rows="2" value={form.acceso} onChange={e => set('acceso', e.target.value)} placeholder="Conservado para compatibilidad. No requerido si llenaste las secciones de arriba." />
      </div>
    </Sheet>
  );
}

/* ---- Agregar aseadora: alta de personal ---- */
function AgregarAseadoraSheet({ open, onClose, onAdd }) {
  const [nombre, setNombre] = useStateS('');
  const [pin, setPin] = useStateS('');
  const [tel, setTel] = useStateS('');
  const [email, setEmail] = useStateS('');
  useEffectS(() => { if (open) { setNombre(''); setPin(''); setTel(''); setEmail(''); } }, [open]);

  const pinOk = /^\d{4}$/.test(pin);
  const nombreOk = nombre.trim().length > 1;
  const dup = getPersonal().some(p => p.nombre.toLowerCase() === nombre.trim().toLowerCase());
  const canSave = nombreOk && pinOk && !dup;

  const footer = (
    <button className="btn btn-primary btn-block btn-lg" disabled={!canSave}
      onClick={() => onAdd({ nombre: nombre.trim(), pin, tel: tel.trim(), email: email.trim() })}>Crear aseadora</button>
  );

  return (
    <Sheet open={open} onClose={onClose} title="Agregar aseadora" footer={footer} height="auto">
      <div className="row gap-base" style={{ marginBottom: 20 }}>
        <div className="team-avatar">{(initials(nombre).toUpperCase()) || '—'}</div>
        <div className="caption">Nueva integrante del equipo</div>
      </div>

      <div className="form-group">
        <label className="label">Nombre</label>
        <input className="text-input" value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej. Mariana" />
        {dup && <div className="caption" style={{ color: 'var(--accent)', marginTop: 6 }}>Ya existe una persona con ese nombre</div>}
      </div>

      <div className="form-group">
        <label className="label">PIN de acceso (4 dígitos)</label>
        <input className="text-input" inputMode="numeric" maxLength="4" value={pin}
          onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="0000"
          style={{ letterSpacing: '0.3em', fontVariantNumeric: 'tabular-nums' }} />
      </div>

      <div className="row gap-base" style={{ alignItems: 'flex-start' }}>
        <div className="form-group" style={{ flex: 1 }}>
          <label className="label">Teléfono</label>
          <input className="text-input" inputMode="tel" value={tel} onChange={e => setTel(e.target.value)} placeholder="+57 300 000 0000" />
        </div>
      </div>

      <div className="form-group" style={{ marginBottom: 0 }}>
        <label className="label">Email (opcional)</label>
        <input className="text-input" inputMode="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="nombre@medcon.co" />
      </div>
    </Sheet>
  );
}

/* ---- Editar aseadora: nombre/PIN/tel/email ---- */
function EditarAseadoraSheet({ open, persona, onClose, onSave }) {
  const [pin, setPin]     = useStateS('');
  const [tel, setTel]     = useStateS('');
  const [email, setEmail] = useStateS('');
  useEffectS(() => {
    if (open && persona) {
      setPin(persona.pin || '');
      setTel(persona.tel || '');
      setEmail(persona.email || '');
    }
  }, [open, persona]);

  if (!persona) return null;

  const pinOk = !pin || /^\d{4}$/.test(pin);
  const canSave = pinOk;

  const footer = (
    <button className="btn btn-primary btn-block btn-lg" disabled={!canSave}
      onClick={() => onSave(persona, { pin: pin, tel: tel.trim(), email: email.trim() })}>Guardar cambios</button>
  );

  return (
    <Sheet open={open} onClose={onClose} title={'Editar ' + persona.nombre} footer={footer} height="auto">
      <div className="row gap-base" style={{ marginBottom: 20 }}>
        <div className="team-avatar">{initials(persona.nombre).toUpperCase()}</div>
        <div>
          <div className="h3">{persona.nombre}</div>
          <div className="caption sec">{persona.rol === 'admin' ? 'Administradora' : 'Aseadora'}</div>
        </div>
      </div>

      <div className="form-group">
        <label className="label">PIN (4 dígitos)</label>
        <input className="text-input" inputMode="numeric" maxLength="4" value={pin}
          onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="0000"
          style={{ letterSpacing: '0.3em', fontVariantNumeric: 'tabular-nums' }} />
      </div>

      <div className="form-group">
        <label className="label">Teléfono</label>
        <input className="text-input" inputMode="tel" value={tel} onChange={e => setTel(e.target.value)} placeholder="+57 300 000 0000" />
      </div>

      <div className="form-group" style={{ marginBottom: 0 }}>
        <label className="label">Email</label>
        <input className="text-input" inputMode="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="nombre@medcon.co" />
      </div>
    </Sheet>
  );
}

Object.assign(window, { CompletarSheet, ReassignSheet, AgregarAseoSheet, EditarPropiedadSheet, AgregarAseadoraSheet, EditarAseadoraSheet });
