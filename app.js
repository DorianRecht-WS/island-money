// Island Money: the island's Money card on the web. Sign in with an emailed code (the same Supabase account the island uses), then
// click the balance to change it. A change is stored as an adjustment on today, and the database rebuilds balance_history
// (migration 0003), which is what the line below the balance and the island's Money tab show.
import { createBlob } from './bloub/view.js';

const { url, anonKey } = window.MONEY_CONFIG;
const sb = window.supabase.createClient(url, anonKey, { auth: { persistSession: true, autoRefreshToken: true } });
const $ = (id) => document.getElementById(id);
const RISE = 'cubic-bezier(.2, .9, .3, 1)';

// first visit: the island's Lilac palette, light or dark like the device (the island's own settings live in the island)
if (!localStorage.getItem('island.settings')) window.islandTheme.set({ theme: 'auto', palette: 'lilac' });

const round2 = (n) => Math.round(n * 100) / 100;
const eur = (n) => (n < 0 ? '−' : '') + '€' + Math.abs(Math.round(n)).toLocaleString('en-US');
const eurExact = (n) => (n < 0 ? '−' : '') + '€' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fail = (e) => (e && e.message) || String(e);

// "4820", "4,820.50", "4 820,5", "-120": a number with at most two decimals; anything else is refused
function parseMoney(text) {
  let t = String(text).replace(/[\s€]/g, '').replace('−', '-');
  const neg = t.startsWith('-'); if (neg) t = t.slice(1);
  if (t.includes(',') && t.includes('.')) t = t.replace(/,/g, '');
  else if (/^\d+,\d{1,2}$/.test(t)) t = t.replace(',', '.');
  else t = t.replace(/,/g, '');
  if (!/^\d{1,11}(\.\d{1,2})?$/.test(t)) return null;
  return (neg ? -1 : 1) * parseFloat(t);
}

// ---- the blobs (engine from github.com/jeremy-prt/bloub), drawn in the theme's ink on the island's colour
const BLOB = { color: 'creme', paper: '#000000', facing: 'right' };
const mb = createBlob($('mBlob'), BLOB), ab = createBlob($('aBlob'), BLOB);
function paintBlobs() {
  const cs = getComputedStyle(document.documentElement);
  for (const b of [mb, ab]) b.setColors(cs.getPropertyValue('--blob-ink').trim(), cs.getPropertyValue('--bg').trim());
}
paintBlobs();
window.islandTheme.onChange(paintBlobs);
mb.start(); ab.start();
mb.setExpression('money'); ab.setExpression('neutre');
document.addEventListener('mousemove', (e) => { mb.look(e.clientX, e.clientY); ab.look(e.clientX, e.clientY); });
document.addEventListener('mouseleave', () => { mb.look(null); ab.look(null); });
function mood(blob, expression, back, ms) { blob.setExpression(expression); if (back) setTimeout(() => blob.setExpression(back), ms); }

// ---- the island's entrance: things rise in turn, the blob pops in, the number counts up, the line draws itself
const rise = (els, delay = 0, gap = 55) => els.forEach((el, i) => el.animate([{ opacity: 0, transform: 'translateY(16px)' }, { opacity: 1, transform: 'none' }], { duration: 560, delay: delay + i * gap, easing: RISE, fill: 'backwards' }));
const blobEntrance = (host) => host.animate([{ opacity: 0, transform: 'translateY(22px) scale(.55)' }, { opacity: 1, transform: 'translateY(-4px) scale(1.07)', offset: .62 }, { opacity: 1, transform: 'none' }], { duration: 680, easing: 'cubic-bezier(.2, .9, .3, 1)' });
function countUp(el, to, dur = 1000, delay = 0) {
  cancelAnimationFrame(el._raf);
  el.textContent = eur(0);
  const t0 = performance.now() + delay;
  const step = (now) => {
    const p = Math.max(0, Math.min(1, (now - t0) / dur));
    el.textContent = eur(to * (1 - (1 - p) ** 3));
    if (p < 1) el._raf = requestAnimationFrame(step); else el.textContent = eur(to);
  };
  el._raf = requestAnimationFrame(step);
}
function drawIn() {
  const bl = $('mbLine'), blen = bl.getTotalLength();
  bl.style.strokeDasharray = blen;
  bl.animate([{ strokeDashoffset: blen }, { strokeDashoffset: 0 }], { duration: 1300, delay: 320, easing: 'cubic-bezier(.35, .1, .2, 1)', fill: 'backwards' });
  $('mbArea').animate([{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0 0 0)' }], { duration: 1300, delay: 320, easing: 'cubic-bezier(.35, .1, .2, 1)', fill: 'backwards' });
  for (const id of ['mbDot', 'mbHalo']) $(id).animate([{ opacity: 0, transform: 'scale(.2)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 520, delay: 1500, easing: 'cubic-bezier(.2, 1.4, .3, 1)', fill: 'backwards' });
}
function enter(view) {
  const host = view === 'money' ? $('mBal') : $('authCard');
  rise([host], 30);
  blobEntrance(view === 'money' ? $('mBlob') : $('aBlob'));
  if (view === 'money') { countUp($('mBalance'), data.balance, 1000, 200); drawIn(); }
}

// ---- the balance line: the same plain 30-day line as the island's Money tab
const BW = 170, BH = 60, BP = 6;
let data = { balance: 0, history: [0, 0], accounts: 0, thin: true };
const bx = (i) => (i / (data.history.length - 1)) * (BW - 6);
const by = (v) => { const h = data.history, lo = Math.min(...h), hi = Math.max(...h); return BP + ((hi - v) / (hi - lo || 1)) * (BH - BP * 2); };
function smooth(pts) {
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], m = (x0 + x1) / 2; d += ` C${m.toFixed(1)} ${y0.toFixed(1)} ${m.toFixed(1)} ${y1.toFixed(1)} ${x1.toFixed(1)} ${y1.toFixed(1)}`; }
  return d;
}
function mark(i, hover) {
  const h = data.history, x = bx(i), y = by(h[i]);
  for (const id of ['mbDot', 'mbHalo']) { $(id).setAttribute('cx', x); $(id).setAttribute('cy', y); }
  $('mbCross').setAttribute('x1', x); $('mbCross').setAttribute('x2', x);
  $('mbChart').classList.toggle('hov', hover);
  const note = $('mbNote'), d = h[h.length - 1] - h[0];
  if (data.thin) { note.textContent = data.accounts ? 'No history yet' : ''; return; }
  note.innerHTML = hover ? `Day ${i + 1} · ${eur(h[i])}` : `<em class="${d >= 0 ? 'up' : 'down'}">${d >= 0 ? '▲ +' : '▼ −'}${eur(Math.abs(d))}</em> in ${h.length} days`;
}
function drawChart() {
  const h = data.history, pts = h.map((v, i) => [bx(i), by(v)]), line = smooth(pts);
  $('mbLine').setAttribute('d', line);
  $('mbArea').setAttribute('d', `${line} L${pts[pts.length - 1][0].toFixed(1)} ${BH} L0 ${BH} Z`);
  mark(h.length - 1, false);
}
$('mbChart').addEventListener('pointermove', (e) => {
  const r = $('mbChart').getBoundingClientRect(), k = Math.min(r.width / BW, r.height / BH), left = r.right - BW * k;
  const x = (e.clientX - left) / k;
  mark(Math.max(0, Math.min(data.history.length - 1, Math.round((x / (BW - 6)) * (data.history.length - 1)))), true);
});
$('mbChart').addEventListener('pointerleave', () => mark(data.history.length - 1, false));

// ---- sign in
let user = null, view = '', authStep = 'email', authEmail = '';
function renderAuth(err = '') {
  const code = authStep === 'code', inp = $('authIn');
  inp.type = code ? 'text' : 'email'; inp.className = code ? 'field code' : 'field';
  inp.placeholder = code ? '123456' : 'you@example.com'; inp.maxLength = code ? 10 : 254; inp.inputMode = code ? 'numeric' : 'email';
  inp.autocomplete = code ? 'one-time-code' : 'email';
  $('authK').textContent = code ? 'Check your email' : 'Your email';
  $('authHint').textContent = err || (code ? `Code sent to ${authEmail}` : 'We will email you a one-time code.');
  $('authHint').classList.toggle('err', !!err);
  $('authGo').textContent = code ? 'Verify' : 'Send code';
  $('authBack').hidden = !code;
  $('aTag').textContent = code ? 'Enter the code' : 'Sign in';
}
$('authForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const value = $('authIn').value.trim();
  if (!value) return;
  $('authGo').disabled = true;
  try {
    if (authStep === 'email') {
      const { error } = await sb.auth.signInWithOtp({ email: value, options: { shouldCreateUser: true } });
      if (error) throw error;
      authEmail = value.toLowerCase(); authStep = 'code'; $('authIn').value = ''; renderAuth(); mood(ab, 'curieux');
    } else {
      const { error } = await sb.auth.verifyOtp({ email: authEmail, token: value, type: 'email' });
      if (error) throw error;   // success: the auth listener below shows the balance
    }
  } catch (err) { renderAuth(fail(err)); mood(ab, 'surpris', 'curieux', 1500); }
  $('authGo').disabled = false;
  $('authIn').focus();
});
$('authBack').addEventListener('click', () => { authStep = 'email'; $('authIn').value = authEmail; renderAuth(); mood(ab, 'neutre'); $('authIn').focus(); });
$('signOut').addEventListener('click', () => sb.auth.signOut());

// ---- the balance: the total is the last day of balance_history, which the database keeps up to date
async function load(animate) {
  const [a, h] = await Promise.all([
    sb.from('bank_accounts').select('id,name,opening_balance,opened_on').order('created_at'),
    sb.from('balance_history').select('day,balance').order('day'),
  ]);
  const err = a.error || h.error;
  if (err) { say(fail(err), true); return; }
  const history = h.data.map((x) => Number(x.balance));
  data = { accounts: a.data.length, accountId: a.data[0] && a.data[0].id, balance: history.length ? history[history.length - 1] : 0, history: history.length > 1 ? history : [history[0] || 0, history[0] || 0] };
  data.thin = history.length < 2 || history.every((v) => v === history[0]);
  render(animate);
}
function say(text, bad) { $('mIO').textContent = text; $('mIO').classList.toggle('err', !!bad); }
function render(animate) {
  if (!animate) $('mBalance').textContent = eur(data.balance);
  say(data.accounts ? 'Click the amount to change it' : 'Click the amount to set your balance');
  drawChart();
  if (animate) { enter('money'); }
}
// click the amount to change it: Enter saves, Escape cancels
let editing = false;
function startEdit() {
  if (editing) return;
  editing = true;
  const inp = $('mEdit');
  inp.value = data.accounts ? String(round2(data.balance)) : '';
  $('mBalance').hidden = true; inp.hidden = false; inp.focus(); inp.select();
  mood(mb, 'curieux');
}
function endEdit() { editing = false; $('mEdit').hidden = true; $('mBalance').hidden = false; mb.setExpression('money'); }
async function saveEdit() {
  if (!editing) return;
  const target = parseMoney($('mEdit').value);
  if (target === null) { $('mEdit').focus(); say('Type an amount like 4820.50', true); mood(mb, 'surpris', 'curieux', 1500); return; }
  endEdit();
  const delta = round2(target - data.balance);
  if (data.accounts && delta === 0) { say('Click the amount to change it'); return; }
  $('mBalance').textContent = eur(target);   // right away; the real number comes back with the reload below
  let error;
  if (!data.accounts) {   // the first balance: it was already there for the whole line, so the line starts flat
    const from = new Date(); from.setDate(from.getDate() - 29);
    ({ error } = await sb.from('bank_accounts').insert({ user_id: user.id, name: 'Main', opening_balance: target, opened_on: ymd(from) }));
  } else {
    ({ error } = await sb.from('transactions').insert({ user_id: user.id, account_id: data.accountId, day: ymd(new Date()), amount: delta, category: 'Balance edit', note: '' }));
  }
  if (error) { say(fail(error), true); mood(mb, 'surpris', 'money', 1500); }
  else mood(mb, 'heureux', 'money', 1600);
  await load(false);
  countUp($('mBalance'), data.balance, 700, 0);
  drawIn();
}
$('mBalance').addEventListener('click', startEdit);
$('mBalance').addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); startEdit(); } });
$('mEdit').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); saveEdit(); }
  else if (e.key === 'Escape') { e.preventDefault(); endEdit(); }
});
$('mEdit').addEventListener('blur', () => { if (editing) saveEdit(); });

// ---- which screen
function showView(v) {
  if (v === view) return;
  view = v;
  $('v-auth').classList.toggle('on', v === 'auth');
  $('v-money').classList.toggle('on', v === 'money');
  $('signOut').hidden = v !== 'money';
  moveInd();
}
function moveInd() {
  const ind = $('tabInd'), b = document.querySelector('#tabs > button.on');
  ind.style.left = b.offsetLeft + 'px'; ind.style.width = b.offsetWidth + 'px';
}
function onSession(session) {
  const next = session ? session.user : null;
  const changed = (next && next.id) !== (user && user.id);
  user = next;
  $('who').textContent = user ? user.email || '' : '';
  if (user) {
    showView('money');
    if (changed) setTimeout(() => load(true), 0);   // not inside the auth callback: it holds the auth lock
  } else {
    data = { balance: 0, history: [0, 0], accounts: 0, thin: true };
    authStep = 'email'; renderAuth(); showView('auth'); enter('auth');
  }
}
renderAuth();
document.fonts && document.fonts.ready.then(moveInd);
sb.auth.onAuthStateChange((_event, session) => onSession(session));
sb.auth.getSession().then(({ data: d }) => onSession(d.session));
