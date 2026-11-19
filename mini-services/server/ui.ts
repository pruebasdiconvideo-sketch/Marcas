// UI HTML del servidor - se sirve en /
export function serverHTML(): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Servidor Biométrico - DiconSolutions</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: #0f172a; color: #e2e8f0; min-height: 100vh;
  }
  header {
    background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
    border-bottom: 1px solid #334155;
    padding: 1rem 2rem; position: sticky; top: 0; z-index: 10;
  }
  .header-content { display: flex; align-items: center; justify-content: space-between; max-width: 1400px; margin: 0 auto; }
  .logo { display: flex; align-items: center; gap: 0.75rem; }
  .logo-icon {
    width: 42px; height: 42px; border-radius: 10px;
    background: linear-gradient(135deg, #06b6d4 0%, #0891b2 100%);
    display: flex; align-items: center; justify-content: center;
    font-size: 24px;
  }
  .logo-text h1 { font-size: 1.1rem; font-weight: 700; }
  .logo-text p { font-size: 0.75rem; color: #94a3b8; }
  .status-badges { display: flex; gap: 0.5rem; flex-wrap: wrap; }
  .badge {
    display: inline-flex; align-items: center; gap: 0.35rem;
    padding: 0.3rem 0.7rem; border-radius: 9999px;
    font-size: 0.75rem; font-weight: 600;
  }
  .badge-ok { background: rgba(34,197,94,0.15); color: #4ade80; border: 1px solid rgba(34,197,94,0.3); }
  .badge-warn { background: rgba(234,179,8,0.15); color: #facc15; border: 1px solid rgba(234,179,8,0.3); }
  .badge-info { background: rgba(6,182,212,0.15); color: #22d3ee; border: 1px solid rgba(6,182,212,0.3); }
  .pulse { width: 8px; height: 8px; border-radius: 50%; background: currentColor; animation: pulse 2s infinite; }
  @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }
  main { max-width: 1400px; margin: 0 auto; padding: 1.5rem 2rem; }
  .stats-grid {
    display: grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    margin-bottom: 1.5rem;
  }
  .stat-card {
    background: #1e293b; border: 1px solid #334155; border-radius: 12px;
    padding: 1rem 1.25rem;
  }
  .stat-card .label { font-size: 0.75rem; color: #94a3b8; margin-bottom: 0.25rem; }
  .stat-card .value { font-size: 1.75rem; font-weight: 700; }
  .stat-card .value.ok { color: #4ade80; }
  .stat-card .value.err { color: #f87171; }
  .stat-card .value.warn { color: #facc15; }
  .grid-2 { display: grid; gap: 1rem; grid-template-columns: 2fr 1fr; }
  @media (max-width: 900px) { .grid-2 { grid-template-columns: 1fr; } }
  .card {
    background: #1e293b; border: 1px solid #334155; border-radius: 12px;
    overflow: hidden;
  }
  .card-header {
    padding: 0.85rem 1.25rem; border-bottom: 1px solid #334155;
    display: flex; align-items: center; justify-content: space-between;
  }
  .card-title { font-size: 0.95rem; font-weight: 600; display: flex; align-items: center; gap: 0.5rem; }
  .card-body { padding: 0; max-height: 520px; overflow-y: auto; }
  .card-body::-webkit-scrollbar { width: 8px; }
  .card-body::-webkit-scrollbar-track { background: #1e293b; }
  .card-body::-webkit-scrollbar-thumb { background: #475569; border-radius: 4px; }
  .marc-row {
    padding: 0.75rem 1.25rem; border-bottom: 1px solid #334155;
    transition: background 0.2s;
  }
  .marc-row.new { animation: slideIn 0.5s ease-out; background: rgba(6,182,212,0.08); }
  @keyframes slideIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
  .marc-row:hover { background: #334155; }
  .marc-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.35rem; }
  .marc-info { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
  .marc-name { font-weight: 600; font-size: 0.9rem; }
  .marc-cod { font-size: 0.7rem; padding: 0.15rem 0.5rem; border-radius: 4px; background: #334155; color: #cbd5e1; font-family: monospace; }
  .tipo-tag {
    font-size: 0.7rem; padding: 0.15rem 0.5rem; border-radius: 4px;
    font-weight: 600;
  }
  .tipo-TRABAJO-ENTRADA { background: rgba(34,197,94,0.2); color: #4ade80; }
  .tipo-TRABAJO-SALIDA { background: rgba(248,113,113,0.2); color: #f87171; }
  .tipo-REFRIGERIO-ENTRADA { background: rgba(250,204,21,0.2); color: #facc15; }
  .tipo-REFRIGERIO-SALIDA { background: rgba(251,146,60,0.2); color: #fb923c; }
  .tipo-DESCONOCIDO { background: rgba(239,68,68,0.2); color: #ef4444; }
  .marc-hex {
    font-family: 'Courier New', monospace; font-size: 0.72rem;
    color: #94a3b8; word-break: break-all; margin-top: 0.25rem;
  }
  .marc-meta { font-size: 0.72rem; color: #64748b; margin-top: 0.25rem; }
  .marc-time { font-size: 0.72rem; color: #64748b; }
  .empty { padding: 3rem 1.25rem; text-align: center; color: #64748b; }
  .empty-icon { font-size: 2.5rem; opacity: 0.4; margin-bottom: 0.5rem; }
  .equipo-row {
    padding: 0.65rem 1.25rem; border-bottom: 1px solid #334155;
    display: flex; align-items: center; justify-content: space-between;
  }
  .equipo-ip { font-family: monospace; font-size: 0.85rem; }
  .equipo-meta { font-size: 0.7rem; color: #64748b; }
  .log-row {
    padding: 0.5rem 1.25rem; border-bottom: 1px solid #334155;
    font-size: 0.78rem; font-family: monospace;
  }
  .log-time { color: #64748b; }
  .log-msg-ok { color: #4ade80; }
  .log-msg-err { color: #f87171; }
  .log-msg-warn { color: #facc15; }
  footer {
    border-top: 1px solid #334155; padding: 1rem 2rem; text-align: center;
    font-size: 0.75rem; color: #64748b; margin-top: 2rem;
  }
  .code { font-family: monospace; background: #334155; padding: 0.1rem 0.35rem; border-radius: 3px; font-size: 0.85em; }
  .actions { display: flex; gap: 0.5rem; }
  button {
    background: #334155; color: #e2e8f0; border: 1px solid #475569;
    padding: 0.4rem 0.85rem; border-radius: 6px; cursor: pointer;
    font-size: 0.78rem; font-weight: 500;
  }
  button:hover { background: #475569; }
  button.primary { background: #0891b2; border-color: #06b6d4; }
  button.primary:hover { background: #06b6d4; }
</style>
</head>
<body>
<header>
  <div class="header-content">
    <div class="logo">
      <div class="logo-icon">🔑</div>
      <div class="logo-text">
        <h1>Servidor Biométrico DiconSolutions</h1>
        <p>Receptor TCP de marcaciones · Puerto 5000 · API Puerto 3001</p>
      </div>
    </div>
    <div class="status-badges">
      <span class="badge badge-ok" id="ws-badge"><span class="pulse"></span>SSE Conectado</span>
      <span class="badge badge-info" id="tcp-badge">TCP :5000 Activo</span>
      <span class="badge badge-warn" id="equipos-badge">0 equipos</span>
    </div>
  </div>
</header>

<main>
  <div class="stats-grid" id="stats"></div>

  <div class="grid-2">
    <div class="card">
      <div class="card-header">
        <div class="card-title">📡 Marcaciones descargadas en vivo</div>
        <div class="actions">
          <button onclick="simularUna()">▶ Simular 1</button>
          <button onclick="simularRafaga()" class="primary">⚡ Ráfaga 5</button>
        </div>
      </div>
      <div class="card-body" id="marcaciones-list">
        <div class="empty">
          <div class="empty-icon">📡</div>
          <div>Esperando marcaciones del equipo biométrico...</div>
          <div style="margin-top:0.5rem;font-size:0.78rem">Las tramas que lleguen al puerto TCP 5000 aparecerán aquí automáticamente.</div>
        </div>
      </div>
    </div>

    <div style="display:flex;flex-direction:column;gap:1rem">
      <div class="card">
        <div class="card-header"><div class="card-title">🔌 Equipos conectados</div></div>
        <div class="card-body" id="equipos-list" style="max-height:240px"></div>
      </div>
      <div class="card">
        <div class="card-header"><div class="card-title">📋 Log de eventos</div></div>
        <div class="card-body" id="log-list" style="max-height:240px"></div>
      </div>
    </div>
  </div>
</main>

<footer>
  Protocolo: trama 24 bytes · sync 0x25 · end 0x7F · checksum XOR ·
  API REST en <span class="code">http://localhost:3001</span>
</footer>

<script>
  let marcaciones = [];
  let logs = [];

  function fmtHora(iso) {
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch { return iso; }
  }
  function fmtFechaHora(iso) {
    try {
      const d = new Date(iso);
      return d.toLocaleString('es-PE', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch { return iso; }
  }

  function renderMarcaciones() {
    const el = document.getElementById('marcaciones-list');
    if (marcaciones.length === 0) {
      el.innerHTML = '<div class="empty"><div class="empty-icon">📡</div><div>Esperando marcaciones del equipo biométrico...</div></div>';
      return;
    }
    el.innerHTML = marcaciones.slice(0, 50).map((m, i) => {
      const tipoClass = 'tipo-' + (m.tipoMarcacion || 'DESCONOCIDO');
      const chkIcon = m.checksumValido ? '✓' : '⚠';
      const chkClass = m.checksumValido ? 'log-msg-ok' : 'log-msg-err';
      const newClass = i === 0 ? 'new' : '';
      return '<div class="marc-row ' + newClass + '">' +
        '<div class="marc-top">' +
          '<div class="marc-info">' +
            '<span class="marc-name">' + (m.trabajador || 'Desconocido') + '</span>' +
            '<span class="marc-cod">Cod ' + m.codTarjeta + '</span>' +
            '<span class="tipo-tag ' + tipoClass + '">' + m.tipoMarcacion + '</span>' +
            '<span class="' + chkClass + '">' + chkIcon + '</span>' +
          '</div>' +
          '<span class="marc-time">' + fmtHora(m.recibidoEn) + '</span>' +
        '</div>' +
        '<div class="marc-hex">' + m.tramaHex + '</div>' +
        '<div class="marc-meta">' + fmtFechaHora(m.fechaHora) + ' · IP ' + m.ipEquipo +
          (m.errores && m.errores.length ? ' · <span class="log-msg-err">' + m.errores.join('; ') + '</span>' : '') +
        '</div>' +
      '</div>';
    }).join('');
  }

  function renderEquipos(equipos) {
    const el = document.getElementById('equipos-list');
    if (!equipos || equipos.length === 0) {
      el.innerHTML = '<div class="empty" style="padding:1.5rem"><div class="empty-icon">🔌</div><div style="font-size:0.85rem">Sin equipos conectados</div></div>';
      return;
    }
    el.innerHTML = equipos.map(e => {
      const status = '<span class="badge badge-ok" style="font-size:0.65rem">● Conectado</span>';
      return '<div class="equipo-row">' +
        '<div><div class="equipo-ip">' + e.ip + ':' + e.puerto + '</div>' +
        '<div class="equipo-meta">Tramas: ' + e.tramasRecibidas + ' · Desde ' + fmtHora(e.conectadoDesde) + '</div></div>' +
        status +
      '</div>';
    }).join('');
    document.getElementById('equipos-badge').textContent = equipos.length + ' equipo(s)';
  }

  function renderLogs() {
    const el = document.getElementById('log-list');
    if (logs.length === 0) {
      el.innerHTML = '<div class="empty" style="padding:1.5rem"><div class="empty-icon">📋</div><div style="font-size:0.85rem">Sin eventos</div></div>';
      return;
    }
    el.innerHTML = logs.slice(0, 30).map(l => {
      const cls = l.tipo === 'conectado' ? 'log-msg-ok' : 'log-msg-warn';
      const icon = l.tipo === 'conectado' ? '↑' : '↓';
      return '<div class="log-row"><span class="log-time">' + fmtHora(l.timestamp) + '</span> ' +
        '<span class="' + cls + '">' + icon + ' ' + l.ip + '</span></div>';
    }).join('');
  }

  async function loadStats() {
    try {
      const r = await fetch('/api/stats');
      if (r.ok) {
        const s = await r.json();
        document.getElementById('stats').innerHTML = [
          { l: 'Total hoy', v: s.totalHoy, c: '' },
          { l: 'Entradas', v: s.entradasHoy, c: 'ok' },
          { l: 'Salidas', v: s.salidasHoy, c: 'err' },
          { l: 'Refrigerio', v: s.refrigerioHoy, c: 'warn' },
          { l: 'Trabajo', v: s.trabajoHoy, c: '' },
          { l: 'Inválidas', v: s.tramasInvalidasHoy, c: 'err' },
          { l: 'Trabajadores', v: s.totalTrabajadores, c: '' },
          { l: 'Equipos totales', v: s.totalEquipos, c: '' },
        ].map(x => '<div class="stat-card"><div class="label">' + x.l + '</div><div class="value ' + x.c + '">' + x.v + '</div></div>').join('');
      }
    } catch {}
  }

  async function loadEquiposConectados() {
    try {
      const r = await fetch('/api/equipos/conectados');
      if (r.ok) renderEquipos(await r.json());
    } catch {}
  }

  async function loadMarcacionesIniciales() {
    try {
      const r = await fetch('/api/marcaciones?pageSize=20');
      if (r.ok) {
        const d = await r.json();
        marcaciones = (d.items || []).reverse().map(m => ({
          id: m.id, tramaHex: m.tramaHex, codTarjeta: m.codTarjeta,
          trabajador: m.trabajador?.nombre || ('Cod ' + m.codTarjeta),
          fechaHora: m.fechaHora, recibidoEn: m.recibidoEn,
          tipoMarcacion: m.tipoMarcacion, ipEquipo: m.equipo?.ip || m.ipEquipo || '—',
          checksumValido: !!m.checksumValido, errores: [],
        }));
        renderMarcaciones();
      }
    } catch {}
  }

  async function simularUna() {
    await fetch('/api/simular', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ codTarjeta: Math.floor(Math.random()*20)+1, tipo: 'TRABAJO-ENTRADA' }) });
  }
  async function simularRafaga() {
    const cods = [1,2,3,5,7];
    const tipos = ['TRABAJO-ENTRADA','TRABAJO-ENTRADA','REFRIGERIO-SALIDA','TRABAJO-SALIDA','TRABAJO-ENTRADA'];
    for (let i = 0; i < cods.length; i++) {
      await fetch('/api/simular', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ codTarjeta: cods[i], tipo: tipos[i] }) });
      await new Promise(r => setTimeout(r, 300));
    }
  }

  // SSE para push en tiempo real
  const es = new EventSource('/api/events');
  es.onopen = () => { document.getElementById('ws-badge').classList.remove('badge-warn'); document.getElementById('ws-badge').classList.add('badge-ok'); };
  es.onerror = () => { document.getElementById('ws-badge').classList.remove('badge-ok'); document.getElementById('ws-badge').classList.add('badge-warn'); };

  es.addEventListener('marcacion:nueva', (e) => {
    try {
      const m = JSON.parse(e.data);
      marcaciones.unshift(m);
      if (marcaciones.length > 100) marcaciones.pop();
      renderMarcaciones();
      loadStats();
    } catch {}
  });
  es.addEventListener('equipo:conectado', (e) => {
    try {
      const d = JSON.parse(e.data);
      logs.unshift({ tipo: 'conectado', ip: d.ip, timestamp: d.timestamp });
      renderLogs();
      loadEquiposConectados();
    } catch {}
  });
  es.addEventListener('equipo:desconectado', (e) => {
    try {
      const d = JSON.parse(e.data);
      logs.unshift({ tipo: 'desconectado', ip: d.ip, timestamp: d.timestamp });
      renderLogs();
      loadEquiposConectados();
    } catch {}
  });

  // Init
  loadStats();
  loadMarcacionesIniciales();
  loadEquiposConectados();
  setInterval(loadStats, 10000);
  setInterval(loadEquiposConectados, 5000);
</script>
</body>
</html>`;
}
