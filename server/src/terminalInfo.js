// Página HTML autónoma (servida por el servidor) con instrucciones para las terminales.
// No usa el SPA: es una guía simple para configurar el acceso desde cada PC de la LAN.
export function paginaTerminalInfo(ips, puerto) {
  const urls = (ips.length ? ips : [{ interfaz: 'local', ip: 'localhost' }]).map(
    ({ interfaz, ip }) => ({ interfaz, ip, url: `http://${ip}:${puerto}` })
  );
  const principal = urls[0].url;

  const filas = urls
    .map(
      (u) => `
      <div class="url-row">
        <div>
          <div class="url">${u.url}</div>
          <div class="iface">Interfaz: ${u.interfaz}</div>
        </div>
        <button class="copy" data-url="${u.url}">Copiar</button>
      </div>`
    )
    .join('');

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>LavaTrack — Acceso desde terminales</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin:0; font-family: Inter, system-ui, -apple-system, sans-serif; background:#f8fafc; color:#1e293b; }
  .wrap { max-width: 720px; margin: 0 auto; padding: 40px 20px; }
  .brand { display:flex; align-items:center; gap:10px; margin-bottom:8px; }
  .logo { width:34px; height:34px; border-radius:9px; background:#0d9488; color:#fff; display:flex; align-items:center; justify-content:center; font-weight:700; }
  h1 { font-size: 20px; margin: 0; }
  .sub { color:#64748b; font-size: 14px; margin: 2px 0 24px; }
  .card { background:#fff; border:1px solid #e2e8f0; border-radius:12px; padding:18px 20px; margin-bottom:16px; box-shadow: 0 1px 2px rgba(0,0,0,.04); }
  .card h2 { font-size: 14px; margin:0 0 12px; color:#0f172a; }
  .url-row { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:10px 0; border-top:1px solid #f1f5f9; }
  .url-row:first-of-type { border-top:0; }
  .url { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size:15px; color:#0d9488; font-weight:600; }
  .iface { font-size:12px; color:#94a3b8; }
  button.copy { background:#0d9488; color:#fff; border:0; border-radius:8px; padding:8px 14px; font-size:13px; font-weight:600; cursor:pointer; }
  button.copy:hover { background:#0f766e; }
  ol { margin:8px 0 0; padding-left: 20px; line-height: 1.7; font-size: 14px; }
  code { background:#f1f5f9; padding:2px 6px; border-radius:5px; font-size:13px; }
  .cmd { background:#0f172a; color:#e2e8f0; padding:12px 14px; border-radius:8px; font-family: ui-monospace, monospace; font-size:13px; overflow-x:auto; white-space:nowrap; }
  .foot { color:#94a3b8; font-size:12px; text-align:center; margin-top:24px; }
</style>
</head>
<body>
  <div class="wrap">
    <div class="brand"><div class="logo">LT</div><div><h1>LavaTrack</h1></div></div>
    <p class="sub">Acceso desde las terminales de la red local — sin instalar nada.</p>

    <div class="card">
      <h2>Dirección de acceso</h2>
      ${filas}
    </div>

    <div class="card">
      <h2>Cómo conectar una terminal</h2>
      <ol>
        <li>Conectá la PC a la <b>misma red</b> que el servidor LavaTrack.</li>
        <li>Abrí Chrome o Edge e ingresá la dirección de arriba (ej. <code>${principal}</code>).</li>
        <li>Listo: ya podés operar. Guardala en favoritos para el acceso diario.</li>
      </ol>
    </div>

    <div class="card">
      <h2>Modo aplicación (pantalla completa, sin barra del navegador)</h2>
      <p class="sub" style="margin:0 0 10px">Crear un acceso directo con este comando (Chrome/Edge):</p>
      <div class="cmd" id="appcmd">chrome --app=${principal}</div>
    </div>

    <p class="foot">LavaTrack · BPSG Sistemas</p>
  </div>

<script>
  document.querySelectorAll('button.copy').forEach((b) => {
    b.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(b.dataset.url); const t=b.textContent; b.textContent='¡Copiado!'; setTimeout(()=>b.textContent=t,1500); }
      catch { alert(b.dataset.url); }
    });
  });
</script>
</body>
</html>`;
}
