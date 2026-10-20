// A stand-in for the e-Filing portal, built from the owner's screenshots of
// 20 Oct 2026: the two-step login with the secure access message, the
// "logged in elsewhere" prompt, Pending Actions → E-Proceedings with its two
// tabs, proceeding cards, "View Notices/Orders (n)", and a notices view with
// PDF downloads. Accounts and their proceedings come from a JSON state file
// that the end-to-end test rewrites between runs, the way the real portal
// changes overnight.
//
//   node test/mock-portal/server.mjs <state.json> [port]

import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';

const [stateFile, port = 8790] = process.argv.slice(2);
const state = () => JSON.parse(readFileSync(stateFile, 'utf8'));

const page = /* html */ `<!doctype html>
<html><head><meta charset="utf-8"><title>e-Filing (stand-in)</title>
<style>
body{font-family:sans-serif;margin:0} nav{background:#2a3a8c;color:#fff;padding:10px;display:flex;gap:20px;position:relative}
nav span{cursor:pointer} .dd{position:absolute;top:40px;left:300px;background:#fff;color:#000;border:1px solid #ccc;display:none;z-index:5}
.dd div{padding:8px;cursor:pointer} main{padding:20px} .card{border:1px solid #ccc;margin:10px 0;padding:10px}
#pm{display:none;position:absolute;right:10px;top:60px;background:#fff;border:1px solid #ccc;padding:8px;z-index:10}
.badge{border:1px solid #36c;font-size:11px;padding:1px 4px;margin-left:6px}
</style></head><body>
<header style="display:flex;justify-content:space-between;padding:10px"><b>e-Filing</b>
<div id="prof" style="display:none;cursor:pointer"><div id="who"></div><div>Individual</div></div>
<div id="pm"><div id="lo" style="cursor:pointer">Logout</div></div></header>
<div id="app"></div>
<script>
const app = document.getElementById('app');
let S = null, pan = null, logged = false, tab = 'action', viewing = null;
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
async function load(){ S = await (await fetch('/state.json', { cache: 'no-store' })).json(); }
const nav = '<nav><span>Dashboard</span><span>e-File</span><span id="pa">Pending Actions</span><span>Help</span><div class="dd" id="dd"><div>Worklist</div><div id="ep">E-Proceedings</div></div></nav>';
function wire(){
  document.getElementById('pa').onclick = () => { const d = document.getElementById('dd'); d.style.display = d.style.display === 'block' ? 'none' : 'block'; };
  document.getElementById('ep').onclick = () => { location.hash = '#/dashboard/eProceedings'; };
}
function card(p, i){
  const dates = p.dates.map(([d, s]) => '<div>' + d + '</div><div>' + s + '</div>').join('');
  return '<div class="card"><div>Proceeding Name : ' + esc(p.name) + (p.isNew ? ' <span class="badge">New</span>' : '') + '</div>'
    + '<div>Assessment Year : ' + esc(p.ay) + '</div><div>PAN</div><div>' + pan + '</div><div>Name of Assessee</div><div>' + esc(S.accounts[pan].name) + '</div>'
    + dates + '<div>Financial Year : ' + esc(p.fy) + '</div><div>Applicable Act : Income Tax Act 1961</div>'
    + '<button class="v" data-i="' + i + '">View Notices/Orders (' + p.notices.length + ')</button> <button>+ Add / View Authorised Representative</button></div>';
}
async function render(){
  await load();
  const r = location.hash;
  document.getElementById('prof').style.display = logged ? 'block' : 'none';
  document.getElementById('who').textContent = logged ? S.accounts[pan].name : '';
  if (r.startsWith('#/dashboard') && !logged) { location.hash = '#/login'; return; }
  if (r === '#/login' || r === '') {
    app.innerHTML = '<main><h1>Login</h1><label>Enter your User ID</label><input id="u" placeholder="PAN/ AADHAAR/ OTHER USER ID"><button id="c">Continue</button><div id="err"></div></main>';
    document.getElementById('c').onclick = () => {
      const u = document.getElementById('u').value.trim().toUpperCase();
      if (!S.accounts[u]) { document.getElementById('err').textContent = 'User ID does not exist'; return; }
      pan = u; setTimeout(() => { location.hash = '#/login/password'; }, 300);
    };
  } else if (r === '#/login/password') {
    const a = S.accounts[pan];
    if (a.otpFirst) { app.innerHTML = '<main><h1>Login</h1><p>Enter the OTP sent to your registered mobile</p><input></main>'; return; }
    app.innerHTML = '<main><h1>Login</h1><p>PAN : ' + pan + '</p><div>Login</div><label><input type="checkbox" id="cb"> Please confirm your secure access message displayed above</label><br><label>Password</label><input type="password" id="p"><button id="c">Continue</button><div id="dlg"></div></main>';
    document.getElementById('c').onclick = () => {
      if (!document.getElementById('cb').checked) return;
      if (document.getElementById('p').value !== a.password) { document.getElementById('dlg').textContent = 'Invalid Password, please retry.'; return; }
      if (a.otpAfter) { app.innerHTML = '<main><p>Enter the OTP sent to your registered mobile number</p><input></main>'; return; }
      const go = () => { logged = true; setTimeout(() => { location.hash = '#/dashboard'; }, 400); };
      if (a.elsewhere) { document.getElementById('dlg').innerHTML = 'You are already logged in on another device <button id="lh">Login Here</button>'; document.getElementById('lh').onclick = () => { a.elsewhere = false; go(); }; }
      else go();
    };
  } else if (r === '#/dashboard') {
    app.innerHTML = nav + '<main><h2>Welcome</h2></main>'; wire();
  } else if (r === '#/dashboard/eProceedings') {
    const a = S.accounts[pan];
    app.innerHTML = nav + '<main><h1>e-Proceeding</h1><span id="ta">For your Action (' + a.action.length + ')</span> | <span id="ti">For your Information (' + a.information.length + ')</span> <button>Excel Download</button><div id="list"></div></main>';
    wire();
    const show = () => {
      const list = a[tab];
      document.getElementById('list').innerHTML = list.map(card).join('');
      document.querySelectorAll('.v').forEach((b) => b.onclick = () => { viewing = { tab, i: Number(b.dataset.i) }; location.hash = '#/dashboard/eProceedings/notices'; });
    };
    show();
    document.getElementById('ta').onclick = () => { tab = 'action'; show(); };
    document.getElementById('ti').onclick = () => { tab = 'information'; show(); };
  } else if (r === '#/dashboard/eProceedings/notices') {
    const p = S.accounts[pan][viewing.tab][viewing.i];
    const rows = p.notices.map((n) => '<tr><td>' + esc(n.din) + '</td><td>Notice u/s ' + esc(n.section) + '</td><td>Issued on ' + n.issued + '</td><td>Response Due Date ' + n.due + '</td><td><a href="/pdf/' + encodeURIComponent(n.din) + '" download="' + esc(n.din.replace(/\\W+/g, '_')) + '.pdf">Download PDF</a></td></tr>').join('');
    app.innerHTML = nav + '<main><h1>Notices/Orders</h1><p>' + esc(p.name) + '</p><table>' + rows + '</table><button id="bk">Back</button></main>';
    wire(); document.getElementById('bk').onclick = () => history.back();
  }
}
document.getElementById('prof').onclick = () => { document.getElementById('pm').style.display = 'block'; };
document.getElementById('lo').onclick = () => { logged = false; pan = null; document.getElementById('pm').style.display = 'none'; location.hash = '#/login'; };
window.onhashchange = render; render();
</script></body></html>`;

createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/state.json') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(state()));
  }
  if (url.pathname.startsWith('/pdf/')) {
    const din = decodeURIComponent(url.pathname.slice(5));
    res.writeHead(200, { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${din.replace(/\W+/g, '_')}.pdf"` });
    return res.end(`%PDF-1.4\n% stand-in notice ${din}\n%%EOF\n`);
  }
  if (url.pathname.startsWith('/iec/foservices')) {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(page);
  }
  res.writeHead(404).end();
}).listen(Number(port), () => console.log(`stand-in portal on http://localhost:${port}/iec/foservices/`));
