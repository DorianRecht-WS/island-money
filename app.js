// Island Money: the island's Money card on the web. Sign in with an emailed code (the same Supabase account the island uses), then
// click the balance to change it. A change is stored as an adjustment on today, and the database rebuilds balance_history
// (migration 0003), which is what the line and the island's Money tab show.
//
// Speed: the page is drawn as a skeleton before any script runs (body.loading), the last balance is kept on this device and shown at
// once while the real one is fetched, and the blob is loaded after everything else so it never delays the numbers.
const { url, anonKey } = window.MONEY_CONFIG;
const sb = window.supabase.createClient(url, anonKey, { auth: { persistSession: true, autoRefreshToken: true } });
const $ = (id) => document.getElementById(id);
const RISE = 'cubic-bezier(.2, .9, .3, 1)';
const CACHE_KEY = 'money.last';

// first visit: the island's Lilac palette, light or dark like the device (the island's own settings live in the island)
if (!localStorage.getItem('island.settings')) window.islandTheme.set({ theme: 'auto', palette: 'lilac' });

const round2 = (n) => Math.round(n * 100) / 100;
const eur = (n) => (n < 0 ? '−' : '') + '€' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });   // exact, to the cent: the number your bank shows
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fail = (e) => (e && e.message) || String(e);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

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
const store = {
  get() { try { return JSON.parse(localStorage.getItem(CACHE_KEY)); } catch { return null; } },
  set(v) { try { localStorage.setItem(CACHE_KEY, JSON.stringify(v)); } catch { /* private mode: no cache */ } },
  clear() { try { localStorage.removeItem(CACHE_KEY); } catch { /* ignore */ } },
};

// ---- the blob (engine from github.com/jeremy-prt/bloub), drawn in the theme's ink on the island's colour. Loaded last.
let mb = null;
const blobCall = (f) => { if (mb) f(mb); };
function mood(expression, back, ms) { blobCall((b) => b.setExpression(expression)); if (back) setTimeout(() => blobCall((b) => b.setExpression(back)), ms); }
function paintBlob() {
  const cs = getComputedStyle(document.documentElement);
  blobCall((b) => b.setColors(cs.getPropertyValue('--blob-ink').trim(), cs.getPropertyValue('--bg').trim()));
}
const loadBlob = (tries = 3) => import('./bloub/view.js').then(({ createBlob }) => {
  mb = createBlob($('mBlob'), { color: 'creme', paper: '#000000', facing: 'right' });
  paintBlob(); mb.setExpression('money'); mb.look(null); blobRuns();
  window.islandTheme.onChange(paintBlob);
  document.addEventListener('mousemove', (e) => mb.look(e.clientX, e.clientY));
  document.addEventListener('mouseleave', () => mb.look(null));
  $('mBlob').addEventListener('click', () => mb.play('wink', 1.2));   // a tap on it winks
  if (!reduced && tab === 'money') blobEntrance($('mBlob'));
}).catch((e) => { console.error('blob', e); if (tries > 1) setTimeout(() => loadBlob(tries - 1), 1500); });   // no blob: the numbers still work
loadBlob();

// the blob draws 30 times a second: only while the Money tab is on screen
const blobRuns = () => { if (mb) { if (tab === 'money' && !document.hidden) mb.start(); else mb.stop(); } };
document.addEventListener('visibilitychange', blobRuns);

// ---- the island's entrance: things rise in turn, the blob pops in, the number counts up, the line draws itself
const rise = (els, delay = 0, gap = 55) => { if (!reduced) els.forEach((el, i) => el.animate([{ opacity: 0, transform: 'translateY(16px)' }, { opacity: 1, transform: 'none' }], { duration: 560, delay: delay + i * gap, easing: RISE, fill: 'backwards' })); };
const blobEntrance = (host) => host.animate([{ opacity: 0, transform: 'translateY(22px) scale(.55)' }, { opacity: 1, transform: 'translateY(-4px) scale(1.07)', offset: .62 }, { opacity: 1, transform: 'none' }], { duration: 680, easing: RISE });
function countUp(el, to, dur = 1000, delay = 0, from = 0) {
  cancelAnimationFrame(el._raf);
  if (reduced) { el.textContent = eur(to); return; }
  el.textContent = eur(from);
  const t0 = performance.now() + delay;
  const step = (now) => {
    const p = Math.max(0, Math.min(1, (now - t0) / dur));
    el.textContent = eur(from + (to - from) * (1 - (1 - p) ** 3));
    if (p < 1) el._raf = requestAnimationFrame(step); else el.textContent = eur(to);
  };
  el._raf = requestAnimationFrame(step);
}
function drawIn() {
  if (reduced) return;
  const bl = $('mbLine'), blen = bl.getTotalLength();
  bl.style.strokeDasharray = blen;
  bl.animate([{ strokeDashoffset: blen }, { strokeDashoffset: 0 }], { duration: 1300, delay: 320, easing: 'cubic-bezier(.35, .1, .2, 1)', fill: 'backwards' });
  $('mbArea').animate([{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0 0 0)' }], { duration: 1300, delay: 320, easing: 'cubic-bezier(.35, .1, .2, 1)', fill: 'backwards' });
  for (const id of ['mbDot', 'mbHalo']) $(id).animate([{ opacity: 0, transform: 'scale(.2)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 520, delay: 1500, easing: 'cubic-bezier(.2, 1.4, .3, 1)', fill: 'backwards' });
}
// the cards of a screen spring open when it comes into view
const notchIn = (root) => { if (!reduced && window.notchReplay) root.querySelectorAll('.notch').forEach((el, i) => setTimeout(() => notchReplay(el), 60 + i * 80)); };
function enter(view, withNotch = false) {
  if (withNotch) notchIn($('v-' + view));
  if (view === 'money') {
    rise([$('mBal'), $('mChart')], 30, 80);
    if (mb) blobEntrance($('mBlob'));
    countUp($('mBalance'), data.balance, 1000, 200); drawIn();
  } else if (view === 'pay') rise([$('payCard')], 30);
  else if (view === 'wealth') rise([$('nwCard'), $('invCard'), $('projCard')], 30, 80);
  else rise([...document.querySelectorAll('#v-settings .group')], 30, 70);
}

// ---- the balance line: the island's plain line, drawn at the real size of its card (one svg unit is one pixel)
let BW = 300, BH = 130;
const BP = 8;
let data = { balance: 0, history: [0, 0], accounts: 0, thin: true };
const bx = (i) => BP + (i / (data.history.length - 1)) * (BW - BP * 2);
const by = (v) => { const h = data.history, lo = Math.min(...h), hi = Math.max(...h); if (hi === lo) return BH / 2; return BP + ((hi - v) / (hi - lo || 1)) * (BH - BP * 2); };
function smooth(pts) {
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], m = (x0 + x1) / 2; d += ` C${m.toFixed(1)} ${y0.toFixed(1)} ${m.toFixed(1)} ${y1.toFixed(1)} ${x1.toFixed(1)} ${y1.toFixed(1)}`; }
  return d;
}
function mark(i, hover) {
  const h = data.history, x = bx(i), y = by(h[i]);
  for (const id of ['mbDot', 'mbHalo']) { $(id).setAttribute('cx', x); $(id).setAttribute('cy', y); }
  $('mbCross').setAttribute('x1', x); $('mbCross').setAttribute('x2', x);
  $('mbCross').setAttribute('y1', 2); $('mbCross').setAttribute('y2', BH - 2);
  $('mbChart').classList.toggle('hov', hover);
  const note = $('mbNote'), d = h[h.length - 1] - h[0];
  if (!user) { note.textContent = ''; return; }
  if (data.thin) { note.textContent = data.accounts ? 'No history yet' : ''; return; }
  note.innerHTML = hover ? `Day ${i + 1} · ${eur(h[i])}` : `<em class="${d >= 0 ? 'up' : 'down'}">${d >= 0 ? '▲ +' : '▼ −'}${eur(Math.abs(d))}</em> in ${h.length} days`;
}
function drawChart() {
  const h = data.history, pts = h.map((v, i) => [bx(i), by(v)]), line = smooth(pts);
  $('mbLine').setAttribute('d', line);
  $('mbArea').setAttribute('d', data.thin ? '' : `${line} L${pts[pts.length - 1][0].toFixed(1)} ${BH} L${BP} ${BH} Z`);   // a flat line has nothing under it to fill
  mark(h.length - 1, false);
}
function sizeChart() {
  const r = $('mbChart').getBoundingClientRect();
  if (!r.width || !r.height) return;
  BW = r.width; BH = r.height;
  $('mbChart').setAttribute('viewBox', `0 0 ${BW.toFixed(1)} ${BH.toFixed(1)}`);
  drawChart();
}
new ResizeObserver(sizeChart).observe($('mbChart'));
$('mbChart').addEventListener('pointermove', (e) => {
  const r = $('mbChart').getBoundingClientRect(), x = e.clientX - r.left;
  mark(Math.max(0, Math.min(data.history.length - 1, Math.round(((x - BP) / (BW - BP * 2)) * (data.history.length - 1)))), true);
});
$('mbChart').addEventListener('pointerleave', () => mark(data.history.length - 1, false));
$('mbChart').addEventListener('pointerup', () => mark(data.history.length - 1, false));

// ---- the tabs: the bottom bar, with the island's sliding indicator
const TABS = ['money', 'pay', 'wealth', 'settings'];
let tab = '', user = null, editing = false, pending = true;   // pending: the saved session has not been read yet
function moveInd() {
  const ind = $('dockInd'), b = document.querySelector('#dock > button.on');
  if (b) { ind.style.left = b.offsetLeft + 'px'; ind.style.width = b.offsetWidth + 'px'; }
}
function showTab(t) {
  if (t === tab) return;
  const first = !tab;
  document.documentElement.style.setProperty('--tab-dx', (TABS.indexOf(t) > TABS.indexOf(tab) ? 18 : -18) + 'px');
  tab = t;
  for (const b of document.querySelectorAll('#dock button')) b.classList.toggle('on', b.dataset.t === t);
  for (const v of document.querySelectorAll('.view')) v.classList.toggle('on', v.id === 'v-' + t);
  moveInd();
  if (t === 'money') sizeChart();
  if (t === 'wealth') loadRates();
  if (t === 'pay') payEnter();
  if (t !== 'pay') payRelock();
  blobRuns();
  if (!first) { enter(t, true); if (t === 'money' && user) refresh(); }
}
$('dock').addEventListener('click', (e) => { const b = e.target.closest('[data-t]'); if (b) showTab(b.dataset.t); });
new ResizeObserver(moveInd).observe($('dock'));
document.fonts && document.fonts.ready.then(moveInd);

// ---- settings: how it looks (the island's own theme and palette code)
const themeButtons = [...document.querySelectorAll('#setTheme button')];
function renderLook() {
  const st = window.islandTheme.get();
  for (const b of themeButtons) b.classList.toggle('on', b.dataset.v === st.theme);
  for (const b of document.querySelectorAll('#setPalette button')) b.classList.toggle('on', b.dataset.v === st.palette);
  const meta = document.querySelector('meta[name=theme-color]');
  if (meta) meta.content = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#08080d';   // the phone's status bar follows
}
$('setPalette').innerHTML = Object.entries(window.islandTheme.palettes).map(([k, p]) => `<button data-v="${k}" type="button" title="${p.name}" aria-label="${p.name}" style="--a:${p.a[0]};--b:${p.b[0]}"></button>`).join('');
$('setTheme').addEventListener('click', (e) => { const b = e.target.closest('[data-v]'); if (b) { window.islandTheme.set({ theme: b.dataset.v }); renderLook(); } });
$('setPalette').addEventListener('click', (e) => { const b = e.target.closest('[data-v]'); if (b) { window.islandTheme.set({ palette: b.dataset.v }); renderLook(); mood('heureux', 'money', 1200); } });
window.islandTheme.onChange(renderLook);
renderLook();

// ---- settings: the account. Signing in is your email, then the one-time code that is emailed to you ('idle' | 'email' | 'code')
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let accStep = 'idle', accEmail = '', accErr = '', accBusy = false;
function accSet(step, err = '') { accStep = step; accErr = err; renderAccount(); if (step !== 'idle') setTimeout(() => $('accIn').focus(), 60); }
function renderAccount() {
  const signedIn = !!user, inp = $('accIn');
  if (signedIn && accStep !== 'idle') accStep = 'idle';
  $('accAv').hidden = !signedIn;
  if (signedIn) $('accAv').textContent = ((user.email || '?')[0] || '?').toUpperCase();
  $('accForm').hidden = signedIn || accStep === 'idle';
  $('accBtn').classList.toggle('primary', !signedIn && accStep === 'idle');
  if (window.Keypad && inp._kpOpts) queueMicrotask(() => Keypad.refresh(inp));
  $('accGo').disabled = accBusy;
  const small = (text, bad) => `<small${bad ? ' class="err"' : ''}>${esc(text)}</small>`;
  if (signedIn) {
    $('accText').innerHTML = `${esc(user.email || 'Signed in')}${small('Connected · same balance as the island')}`;
    $('accBtn').textContent = 'Sign out';
  } else if (accStep === 'email') {
    $('accText').innerHTML = `Sign in with your email${small(accErr || 'We will email you a one-time code', !!accErr)}`;
    $('accBtn').textContent = 'Cancel';
    inp.type = 'email'; inp.placeholder = 'you@example.com'; inp.className = 'field'; inp.maxLength = 254; inp.inputMode = 'email'; inp.autocomplete = 'email';
    $('accGo').textContent = accBusy ? 'Sending' : 'Send code';
  } else if (accStep === 'code') {
    $('accText').innerHTML = `Check your email${small(accErr || `Code sent to ${accEmail}`, !!accErr)}`;
    $('accBtn').textContent = 'Back';
    inp.type = 'text'; inp.placeholder = '123456'; inp.className = 'field code'; inp.maxLength = 10; inp.inputMode = 'numeric'; inp.autocomplete = 'one-time-code';
    $('accGo').textContent = accBusy ? 'Checking' : 'Verify';
  } else {
    $('accText').innerHTML = `Not signed in${small('Sign in to see and change your balance')}`;
    $('accBtn').textContent = 'Sign in';
  }
}
$('accBtn').addEventListener('click', () => {
  if (user) sb.auth.signOut();
  else if (accStep === 'idle') { $('accIn').value = ''; accSet('email'); }
  else if (accStep === 'code') { $('accIn').value = accEmail; accSet('email'); }
  else { $('accIn').value = ''; accSet('idle'); }
});
$('accForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (accBusy) return;
  const value = $('accIn').value.trim();
  if (!value) return;
  accBusy = true; accErr = ''; renderAccount();
  try {
    if (accStep === 'email') {
      const { error } = await sb.auth.signInWithOtp({ email: value, options: { shouldCreateUser: true } });
      if (error) throw error;
      accEmail = value.toLowerCase(); $('accIn').value = ''; accBusy = false; accSet('code');
    } else {
      const { error } = await sb.auth.verifyOtp({ email: accEmail, token: value, type: 'email' });
      if (error) throw error;   // success: the session listener below turns the page to "signed in"
      accBusy = false; $('accIn').value = ''; accSet('idle');
    }
  } catch (err) { accBusy = false; accSet(accStep, fail(err)); }
});

// ---- the balance: the total is the last day of balance_history, which the database keeps up to date
let link = null;   // the connected bank (a bank_links row), or null
let pendingAdj = 0;   // the typed-in difference between the bank's balance and "after pending operations" (the bank does not list those)
let lastBal = [];   // what the bank answered at the last sync: which balances it gave and which one is shown
let shared = [];   // the accounts the bank shared (bank_accounts rows that came from the link)
async function load(animate) {
  const [a, h, l] = await Promise.all([
    sb.from('bank_accounts').select('*').order('created_at'),   // (all columns: works before and after the account-kind migration)
    sb.from('balance_history').select('day,balance').order('day'),
    sb.from('bank_links').select('id,bank_name,valid_until,synced_at,last_error').order('created_at', { ascending: false }).limit(1),
  ]);
  const err = a.error || h.error;
  if (err) { data.loaded = true; render(false); say(fail(err), true); return; }
  link = (l.data && l.data[0]) || null;   // (no table yet, before the bank migration: no bank)
  renderBank();
  const history = h.data.map((x) => Number(x.balance));
  const before = data.balance, had = !!data.fromCache;   // had: the saved balance was already on screen
  // current accounts make up the balance; livrets, investment accounts and loans from the bank are listed on the Wealth tab
  shared = a.data.filter((x) => x.bank_link_id);
  renderBank();
  const cash = a.data.filter((x) => !x.kind || x.kind === 'cash');
  bankAssets = a.data.filter((x) => x.kind && x.kind !== 'cash').map((x) => ({ id: 'bank:' + x.id, kind: x.kind, name: x.name, invested: 0, value: Math.abs(Number(x.balance) || 0), since: null, fromBank: true }));
  const bankCash = cash.filter((x) => x.bank_link_id).reduce((s, x) => s + (Number(x.balance) || 0), 0);
  data = { accounts: cash.length, accountId: cash[0] && cash[0].id, balance: history.length ? history[history.length - 1] : 0, history: history.length > 1 ? history : [history[0] || 0, history[0] || 0], loaded: true };
  pendingAdj = link && cash.some((x) => x.bank_link_id && x.balance != null) ? round2(data.balance - bankCash) : 0;
  data.thin = history.length < 2 || history.every((v) => v === history[0]);
  store.set({ uid: user.id, email: user.email || '', accounts: data.accounts, balance: data.balance, history: data.history, thin: data.thin });
  loadAssets();   // (not awaited: the balance is already on screen)
  render(animate && !had);
  if (had && before !== data.balance && tab === 'money') { countUp($('mBalance'), data.balance, 700, 0, before); drawIn(); }   // the cached number was out of date
}
// the app comes back to the front: fetch again, so a change made on another device shows (at most once every 3 s)
let lastLoad = 0;
function refresh() {
  if (!user || editing || Date.now() - lastLoad < 3000) return;
  lastLoad = Date.now();
  const before = data.balance;
  const shown = () => { if (tab === 'money' && data.balance !== before) countUp($('mBalance'), data.balance, 600, 0, before); };
  load(false).then(() => { shown(); return bankSync(false); }).then((fresh) => fresh && load(false)).then(shown);
}
document.addEventListener('visibilitychange', () => { if (!document.hidden && tab === 'money') refresh(); });
window.addEventListener('focus', () => { if (tab === 'money') refresh(); });

function say(text, bad) { $('mIO').textContent = text; $('mIO').classList.toggle('err', !!bad); }
function render(animate) {
  const body = document.body;
  body.classList.toggle('out', !user && !pending);
  body.classList.toggle('loading', !data.loaded);   // the skeleton shows until real (or saved) numbers exist
  $('mTag').textContent = pending ? '' : user ? (link ? 'Live · bank' : 'Live') : 'Signed out'; $('mTag').classList.toggle('live', !!user);
  $('mBalance').title = user ? 'Click to change' : 'Sign in';
  if (!user && !pending) { $('mBalance').textContent = '€-'; say('Tap here to sign in'); drawChart(); return; }
  if (!animate) $('mBalance').textContent = eur(data.balance);
  say(link ? (pendingAdj ? `Includes ${signed(pendingAdj)} not yet in your bank's data` : '') : data.accounts ? 'Click the amount to change it' : 'Click the amount to set your balance');
  drawChart();
  if (animate && tab === 'money') enter('money');
}
// click the amount to change it: Enter saves, Escape cancels
function startEdit() {
  if (pending) return;
  if (!user) { showTab('settings'); if (accStep === 'idle') accSet('email'); return; }
  if (editing) return;
  editing = true;
  const inp = $('mEdit');
  inp.value = data.accounts ? String(round2(data.balance)) : '';
  $('mBalance').hidden = true; inp.hidden = false; inp.focus(); inp.select();
  mood('curieux');
}
function endEdit() { editing = false; $('mEdit').hidden = true; $('mBalance').hidden = false; mood('money'); }
async function saveEdit() {
  if (!editing) return;
  const target = parseMoney($('mEdit').value);
  if (target === null) { $('mEdit').focus(); say('Type an amount like 4820.50', true); mood('surpris', 'curieux', 1500); return; }
  endEdit();
  if (link) {   // the bank does not list the pending operations: what you type is kept as an adjustment on top of the bank's balance
    try { await bankCall('/adjust', 'POST', { amount: target }); mood('heureux', 'money', 1600); }
    catch (e) { say(fail(e), true); mood('surpris', 'money', 1500); }
    const before = data.balance; await load(false); countUp($('mBalance'), data.balance, 700, 0, before);
    return;
  }
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
  if (error) { say(fail(error), true); mood('surpris', 'money', 1500); }
  else mood('heureux', 'money', 1600);
  await load(false);
  countUp($('mBalance'), data.balance, 700, 0);
  drawIn();
}
$('mBalance').addEventListener('click', startEdit);
$('mIO').addEventListener('click', () => { if (!user) startEdit(); });
$('mBalance').addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); startEdit(); } });
$('mEdit').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); saveEdit(); }
  else if (e.key === 'Escape') { e.preventDefault(); endEdit(); }
});
$('mEdit').addEventListener('blur', () => { if (editing) saveEdit(); });
$('mEdit').addEventListener('kpdone', () => { if (editing) saveEdit(); });

// ---- settings: the bank (Enable Banking through the `bank` Edge Function). The balance and transactions then come from the bank.
const BANK_API = `${url}/functions/v1/bank`;
async function bankCall(path, method = 'POST', body = {}) {
  const { data: d } = await sb.auth.getSession();
  if (!d.session) throw new Error('Sign in first');
  const res = await fetch(BANK_API + path, { method, headers: { Authorization: `Bearer ${d.session.access_token}`, 'Content-Type': 'application/json' }, body: method === 'GET' ? undefined : JSON.stringify(body) });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(out.error === 'not_configured' ? 'The bank service is not set up yet' : out.error === 'login_required' ? 'Sign in again' : 'The bank did not answer, try again');
  return out;
}
const bankReturn = new URLSearchParams(location.search).get('bank');   // set by the function when the bank sends you back
if (bankReturn) history.replaceState(null, '', location.pathname);
let bankNote = { ok: 'Bank connected. Loading your balance...', cancelled: 'The connection was cancelled', error: 'The connection did not work, try again' }[bankReturn] || '', bankBad = bankReturn === 'error', bankBusy = false;
const ago = (iso) => { const m = Math.round((Date.now() - Date.parse(iso)) / 60000); return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`; };
function renderBank() {
  const expired = link && (link.last_error === 'expired' || Date.parse(link.valid_until) < Date.now());
  const small = (text, bad) => `<small${bad ? ' class="err"' : ''}>${esc(text)}</small>`;
  $('bankBtn').disabled = !user || bankBusy;
  $('bankSync').hidden = !link || expired;
  $('bankSync').disabled = bankBusy;
  if (!user) { $('bankText').innerHTML = `No bank connected${small('Sign in first')}`; $('bankBtn').textContent = 'Connect'; $('bankBtn').classList.add('primary'); $('bankForm').hidden = true; return; }
  if (!link) {
    $('bankText').innerHTML = `No bank connected${small(bankNote || 'Your real balance and transactions', bankBad)}`;
    $('bankBtn').textContent = $('bankForm').hidden ? 'Connect' : 'Cancel'; $('bankBtn').classList.toggle('primary', $('bankForm').hidden);
  } else if (expired) {
    $('bankText').innerHTML = `${esc(link.bank_name)}${small(bankNote || 'Your approval ended: connect again to keep syncing', true)}`;
    $('bankBtn').textContent = 'Reconnect'; $('bankBtn').classList.add('primary'); $('bankForm').hidden = true;
  } else {
    const until = new Date(link.valid_until).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    $('bankText').innerHTML = `${esc(link.bank_name)}${small(bankNote || (link.last_error ? 'The last sync failed, try again' : `${link.synced_at ? 'Synced ' + ago(link.synced_at) : 'Syncing...'} · approved until ${until}`), !!link.last_error || bankBad)}`;
    $('bankBtn').textContent = 'Disconnect'; $('bankBtn').classList.remove('primary'); $('bankForm').hidden = true;
  }
  // which balance is shown: the one after all operations if the bank gives it; the others are listed so you can compare with your bank's app
  const BAL = { XPCD: 'expected (after pending operations)', 'BOOKED+PENDING': 'booked plus the pending operations', 'CLBD+LATER': 'day-end balance plus the operations since', ITBD: 'booked', CLBD: 'booked at day end', OPBD: 'opening', CLAV: 'available', ITAV: 'available now' };
  const cashBal = lastBal.find((d) => d.kind === 'cash') || lastBal[0];
  $('bankBal').hidden = !link || expired || !cashBal;
  if (cashBal) {
    const others = cashBal.balances.filter((b) => b.type !== cashBal.used), p = cashBal.pending || { count: 0, sum: 0 };
    $('bankBal').textContent = `Your balance (${eur(cashBal.amount)}) is the ${BAL[cashBal.used] || cashBal.used} one. ` +
      (p.count ? `It counts ${p.count} pending operation${p.count > 1 ? 's' : ''} (${signed(p.sum)}). ` : `Your bank lists no pending operations${cashBal.statuses && Object.keys(cashBal.statuses).length ? ' (it sent: ' + Object.entries(cashBal.statuses).map(([k, v]) => v + ' ' + k.toLowerCase()).join(', ') + ')' : ''}, so purchases still on their way are not in it. Tap your balance and type what your bank shows after them: it is kept until your bank's balance moves. `) +
      (others.length ? 'Your bank also gives: ' + others.map((b) => `${BAL[b.type] || b.type} ${eur(b.amount)}${b.date ? ' as of ' + b.date : ''}`).join(', ') + '.' : '');
  }
  // which accounts the bank shared: if a livret is missing here, the bank did not share it (tick it at the bank and share again)
  const KIND = { cash: 'current', savings: 'savings', investment: 'investment', debt: 'loan' };
  $('bankMore').hidden = !link || expired;
  $('bankMore').textContent = shared.length ? `Shared: ${shared.map((x) => `${x.iban_hint ? '····' + x.iban_hint + ' ' : ''}${KIND[x.kind || 'cash']}`).join(', ')}. Share more accounts` : 'Share more accounts';
}
// asks the function to read the bank (it keeps its own pace: banks only allow a few reads a day); true when something was read
async function bankSync(force) {
  if (!link || bankBusy || link.last_error === 'expired') return false;
  bankBusy = true; renderBank();
  try { const r = await bankCall('/sync', 'POST', { force }); if (r.details && r.details.length) lastBal = r.details; return r.synced > 0; }
  catch (e) { bankNote = fail(e); bankBad = true; return false; }
  finally { bankBusy = false; renderBank(); }
}
async function bankConnect(bank) {
  if (!link && data.accounts && !confirm('Connecting replaces the balance you typed with your bank’s real one. Continue?')) return;
  bankBusy = true; bankNote = 'Opening your bank...'; bankBad = false; renderBank();
  try { const r = await bankCall('/connect', 'POST', { bank }); location.href = r.url; }
  catch (e) { bankBusy = false; bankNote = fail(e); bankBad = true; renderBank(); }
}
$('bankBtn').addEventListener('click', async () => {
  bankNote = ''; bankBad = false;
  const expired = link && (link.last_error === 'expired' || Date.parse(link.valid_until) < Date.now());
  if (link && !expired) {
    if (!confirm('Disconnect your bank? Its accounts and transactions are removed from the app.')) return;
    bankBusy = true; renderBank();
    try { await bankCall('/disconnect'); link = null; await load(false); } catch (e) { bankNote = fail(e); bankBad = true; }
    bankBusy = false; renderBank(); return;
  }
  if (expired) return bankConnect(link.bank_name);
  $('bankForm').hidden = !$('bankForm').hidden;   // the bank picker
  renderBank();
  if (!$('bankForm').hidden && !$('bankSel').options.length) {
    $('bankSel').innerHTML = '<option>Loading banks...</option>'; $('bankGo').disabled = true;
    try {
      let { banks } = await bankCall('/banks?q=Epargne', 'GET');
      if (!banks.length) ({ banks } = await bankCall('/banks?q=', 'GET'));   // nothing under that name: show every French bank
      $('bankSel').innerHTML = banks.map((b) => `<option>${esc(b)}</option>`).join('') || '<option value="">No bank found</option>';
      $('bankGo').disabled = !banks.length;
    } catch (e) { $('bankSel').innerHTML = ''; $('bankForm').hidden = true; bankNote = fail(e); bankBad = true; renderBank(); }
  }
});
window.addEventListener('pageshow', (e) => { if (e.persisted && bankBusy) { bankBusy = false; bankNote = ''; renderBank(); } });   // back from the bank's page without finishing
$('bankForm').addEventListener('submit', (e) => { e.preventDefault(); if ($('bankSel').value) bankConnect($('bankSel').value); });
$('bankMore').addEventListener('click', () => { if (link && confirm('You will go back to your bank to choose the accounts to share. Tick every account you want here, including your livrets.')) bankConnect(link.bank_name); });
$('bankSync').addEventListener('click', async () => { bankNote = ''; bankBad = false; if (await bankSync(true)) await load(false); });

// ---- the Wealth tab: net worth, investments with their returns, and the growth calculator (the arithmetic is in wealth.js)
let assets = [];   // the user's own assets rows (investments, savings, property, debts), typed in
let bankAssets = [];   // the same kinds of thing, but read from the bank's accounts (a livret, a PEA, a loan)
// what each typed-in item is worth today: a rate makes it grow by itself from the day it was typed in (debts do not grow here)
const grown = (a) => (a.kind === 'debt' || !a.rate ? a.value : Wealth.grow(a.value, a.rate, a.updated));
const allAssets = () => bankAssets.concat(assets.map((a) => ({ ...a, value: grown(a) })));
const KIND_COLOR = { cash: 'var(--accent)', investment: 'var(--accent-2)', savings: 'var(--ok)', property: 'var(--warn)', debt: 'var(--danger)' };
const signed = (n) => (n > 0 ? '+' : n < 0 ? '−' : '') + eur(Math.abs(n));
const pct = (x, digits = 1) => (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x * 100).toFixed(digits) + '%';
let editingAsset = null;   // the asset being edited, or 'new'

function renderWealth() {
  const all = allAssets(), t = Wealth.totals(data.balance, all);
  document.body.classList.toggle('out', !user && !pending);
  $('wTag').textContent = user ? (all.length ? `${all.length} item${all.length > 1 ? 's' : ''}` : '') : 'Signed out';
  $('nwAmount').textContent = user || pending ? eur(t.net) : '€-';
  $('nwNote').textContent = user ? `Balance ${eur(t.cash)}${t.inv ? ` · investments ${eur(t.inv)}` : ''}${t.sav ? ` · savings ${eur(t.sav)}` : ''}${t.debt ? ` · debts −${eur(t.debt)}` : ''}` : 'Sign in to see your net worth';
  // the same number on the Money tab: tap it to open Wealth
  $('mNwAmount').textContent = user || pending ? eur(t.net) : '€-';
  $('mNwNote').textContent = user ? `Savings ${eur(t.sav)} · investments ${eur(t.inv)}${t.debt ? ` · debts −${eur(t.debt)}` : ''}` : 'Sign in to see it';
  // the split of what you own, as one bar (debts are shown in the legend: they are not part of what you own)
  const parts = [['cash', 'Balance', Math.max(0, t.cash)], ['investment', 'Investments', t.inv], ['savings', 'Savings', t.sav], ['property', 'Property', t.prop]].filter((p) => p[2] > 0);
  const own = parts.reduce((s, p) => s + p[2], 0) || 1;
  $('nwBar').innerHTML = parts.map((p) => `<i style="flex:${(p[2] / own).toFixed(4)};background:${KIND_COLOR[p[0]]}"></i>`).join('');
  $('nwLegend').innerHTML = parts.concat(t.debt ? [['debt', 'Debts', t.debt]] : []).map((p) => `<span><i style="background:${KIND_COLOR[p[0]]}"></i>${p[1]} ${eur(p[2])}</span>`).join('');

  $('assetList').innerHTML = all.map((a) => {
    const gn = a.kind === 'investment' ? Wealth.gain(a.invested, a.value) : null, yr = a.kind === 'investment' && a.since ? Wealth.yearly(a.invested, a.value, a.since) : null;
    const sub = gn ? `${pct(gn.pct)}${yr !== null ? ` · ${pct(yr)}/yr` : ''}` : a.fromBank ? `${Wealth.KINDS[a.kind]} · from your bank` : `${Wealth.KINDS[a.kind]}${a.rate ? ` · ${a.rate}%/yr` : ''}`;
    return `<li${a.fromBank ? ' class="bank"' : ` data-id="${esc(a.id)}" tabindex="0"`}><i style="background:${KIND_COLOR[a.kind]}"></i><div class="main"><b>${esc(a.name)}</b><small${gn ? ` class="${gn.amount >= 0 ? 'up' : 'down'}"` : ''}>${sub}</small></div><span class="amt">${a.kind === 'debt' ? '−' : ''}${eur(a.value)}${a.rate && a.kind !== 'debt' ? `<em class="rt"> + ${a.rate}%</em>` : ''}</span></li>`;
  }).join('') || '<li class="empty">Add an investment, a savings account, property or a debt to see your net worth.</li>';
  renderGrowth(all);
}

// the yearly growth card: each account at its own rate, added up
function renderGrowth(all) {
  const g = Wealth.growth(all);
  $('gwAmount').textContent = user ? `${signed(g.perYear)} a year` : '€-';
  $('gwAmount').className = g.perYear < 0 ? 'down' : '';
  $('gwPct').textContent = !user ? '' : g.items.length ? pct(g.pct) : 'add a rate to a saving';
  $('gwPct').className = !g.items.length ? 'none' : g.pct < 0 ? 'down' : '';
}

// ---- adding and editing: tap a row to change what it is worth today
function openAssetForm(a) {
  editingAsset = a || 'new';
  const wasHidden = $('sheet').hidden;
  $('sheet').hidden = false; $('sheetTitle').textContent = a ? 'Edit' : 'New saving or investment';
  if (wasHidden && !reduced) { $('assetForm').animate([{ transform: 'translateY(100%)' }, { transform: 'none' }], { duration: 420, easing: 'cubic-bezier(.2, .9, .3, 1)' }); $('sheetBg').animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260 }); }
  $('asName').value = a ? a.name : ''; $('asKind').value = a ? a.kind : 'savings'; syncKind();
  $('asInvested').value = a ? String(a.invested) : ''; $('asValue').value = a ? String(grown(a)) : '';
  $('asRate').value = a && a.rate ? String(a.rate) : '';
  rateAuto = false;
  $('asSince').value = a ? a.since : ymd(new Date());
  $('asErr').textContent = ''; $('asCancel').textContent = a ? 'Delete' : 'Cancel'; $('asCancel').classList.toggle('danger', !!a);
  renderRates(); loadRates();
}
function closeAssetForm() {
  editingAsset = null;
  if ($('sheet').hidden) return;
  if (reduced) { $('sheet').hidden = true; return; }
  const out = $('assetForm').animate([{ transform: 'none' }, { transform: 'translateY(100%)' }], { duration: 260, easing: 'cubic-bezier(.4, 0, 1, 1)' });
  $('sheetBg').animate([{ opacity: 1 }, { opacity: 0 }], { duration: 260 });
  out.onfinish = () => { if (!editingAsset) $('sheet').hidden = true; };
}
// the type switch: the highlighted pill, "put in" only for an investment, and the rates that fit the type
function syncKind() {
  const kind = $('asKind').value;
  for (const b of document.querySelectorAll('#asKindSeg button')) b.classList.toggle('on', b.dataset.k === kind);
  $('asInvestedBox').hidden = kind !== 'investment';
  if ($('asName').value && !NAMES[kind].includes($('asName').value) && !(editingAsset && editingAsset !== 'new' && editingAsset.kind === kind && editingAsset.name === $('asName').value)) $('asName').value = '';
  renderNames(); renderRates();
}
let rateAuto = false;   // the rate in the form came from an official name (so it goes when the name or type changes), not from you
$('asKindSeg').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { $('asKind').value = b.dataset.k; if (rateAuto) { $('asRate').value = ''; rateAuto = false; } syncKind(); } });
$('asRate').addEventListener('input', () => { rateAuto = false; });
$('mNw').addEventListener('click', () => showTab('wealth'));
$('assetAdd').addEventListener('click', () => { if (!user) { showTab('settings'); if (accStep === 'idle') accSet('email'); return; } openAssetForm(null); });
$('sheetBg').addEventListener('click', closeAssetForm);
$('sheetX').addEventListener('click', closeAssetForm);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('sheet').hidden) closeAssetForm(); });
$('assetList').addEventListener('click', (e) => { const li = e.target.closest('li[data-id]'); if (li && user) openAssetForm(assets.find((a) => a.id === li.dataset.id)); });
$('assetList').addEventListener('keydown', (e) => { if (e.key === 'Enter') { const li = e.target.closest('li[data-id]'); if (li && user) openAssetForm(assets.find((a) => a.id === li.dataset.id)); } });
// the name is always one of these (no free text); the official ones bring their official rate with them
const NAMES = {
  savings: ['Livret A', 'Livret Jeune', 'LDDS', 'LEP', 'PEL', 'CEL', 'Savings account', 'Term deposit'],
  investment: ['PEA', 'PEA-PME', 'CTO', 'Assurance vie', 'PER', 'Crypto', 'SCPI', 'Stocks', 'ETF', 'Gold'],
  property: ['Main home', 'Rental property', 'Land', 'Parking'],
  debt: ['Mortgage', 'Car loan', 'Student loan', 'Consumer credit', 'Credit card'],
};
const OFFICIAL = { 'Livret A': 'livret-a', 'Livret Jeune': 'livret-jeune', LDDS: 'ldds', LEP: 'lep', PEL: 'pel', CEL: 'cel' };
function renderNames() {
  const kind = $('asKind').value, cur = $('asName').value;
  const list = NAMES[kind].slice();
  if (cur && !list.includes(cur) && editingAsset && editingAsset !== 'new' && editingAsset.kind === kind) list.unshift(cur);   // an older item keeps the name it already has
  $('asNames').innerHTML = list.map((n) => `<button type="button" role="option" data-n="${esc(n)}" aria-selected="${n === cur}"${n === cur ? ' class="on"' : ''}>${esc(n)}</button>`).join('');
  $('asNameShow').textContent = cur || 'Choose one';
  $('asNameShow').classList.toggle('none', !cur);
}
$('asNames').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  $('asName').value = b.dataset.n; renderNames(); $('asErr').textContent = '';
  const known = rates && OFFICIAL[b.dataset.n] && rates.savings.rates.find((r) => r.id === OFFICIAL[b.dataset.n]);
  if (known) { $('asRate').value = String(known.rate); rateAuto = true; }
  else if (rateAuto) { $('asRate').value = ''; rateAuto = false; }   // a rate that came with the previous name does not stay
  $('asValue').focus();
});
$('asRates').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { $('asRate').value = b.dataset.r; rateAuto = false; } });
$('assetForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const value = parseMoney($('asValue').value), invText = $('asInvested').value.trim(), invested = invText ? parseMoney(invText) : 0;
  const kind = $('asKind').value;
  if (!$('asName').value) { $('asErr').textContent = 'Choose a name from the list'; return; }
  if (value === null || value < 0 || invested === null || invested < 0) { $('asErr').textContent = 'Amounts must be positive numbers like 1250.50'; return; }
  const rateText = $('asRate').value.trim().replace(',', '.'), rate = rateText ? Number(rateText) : 0;
  if (!Number.isFinite(rate) || rate < 0 || rate > 100) { $('asErr').textContent = 'The interest rate is a percent a year, like 1.7'; return; }
  const row = { name: $('asName').value.trim(), kind, value, invested: kind === 'investment' ? invested : 0, since: $('asSince').value || ymd(new Date()) };
  if (rate > 0 || (editingAsset && editingAsset.rate)) row.rate = rate;   // (left out when there is none: works before the rate column exists)
  $('asSave').disabled = true;
  const { error } = editingAsset && editingAsset !== 'new'
    ? await sb.from('assets').update(row).eq('id', editingAsset.id)
    : await sb.from('assets').insert({ ...row, user_id: user.id });
  $('asSave').disabled = false;
  if (error) { $('asErr').textContent = fail(error); return; }
  closeAssetForm(); await loadAssets();
});
$('asCancel').addEventListener('click', async () => {
  if (editingAsset && editingAsset !== 'new') {
    if (!confirm(`Delete "${editingAsset.name}"?`)) return;
    const { error } = await sb.from('assets').delete().eq('id', editingAsset.id);
    if (error) { $('asErr').textContent = fail(error); return; }
    closeAssetForm(); await loadAssets();
  } else closeAssetForm();
});
async function loadAssets() {
  const r = await sb.from('assets').select('*').order('created_at');   // (all columns: works before and after the rate column)
  assets = (r.data || []).map((a) => ({ ...a, invested: Number(a.invested), value: Number(a.value), rate: Number(a.rate) || 0, updated: a.updated_at || a.created_at }));   // (no table yet, before its migration: none)
  renderWealth();
}

// ---- the rates: what savings pay (set by the State) and how a few markets did, from the public `rates` function; shown as buttons in the add form
const RATES_API = `${url}/functions/v1/rates`, RATES_KEY = 'money.rates';
let rates = null;
try { const c = JSON.parse(localStorage.getItem(RATES_KEY)); if (c && c.body) rates = c.body; } catch { /* none saved */ }
const ratesAge = () => { try { return JSON.parse(localStorage.getItem(RATES_KEY)).at; } catch { return 0; } };
// the rates live where you add something: official savings rates for a savings item, five-year market averages for an investment
function renderRates() {
  const kind = $('asKind').value, wrap = $('asRates');
  let list = [], note = '';
  if (rates && kind === 'savings') {
    list = rates.savings.rates.map((r) => [r.name.replace(' (opened in 2026)', ''), r.rate]);
    const until = new Date(rates.savings.until).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    note = rates.savings.outdated ? `These rates may have changed since ${until}.` : `Official rates, until ${until}. Livret Jeune: at least this, your bank sets it.`;
  } else if (rates && kind === 'investment') {
    list = rates.markets.filter((m) => m.ret5y != null).map((m) => [m.name.split(' (')[0] + ', 5-year average', Math.round(m.ret5y * 1000) / 10]);
    note = 'Average per year over five years, price only. Past results promise nothing.';
  }
  wrap.innerHTML = list.map(([n, r]) => `<button type="button" data-r="${r}">${esc(n)} ${r}%</button>`).join('');
  $('asRatesNote').textContent = note;
}
async function loadRates(force) {
  if (!force && rates && Date.now() - ratesAge() < 30 * 60 * 1000) { renderRates(); return; }
  renderRates();
  try {
    const res = await fetch(RATES_API);
    if (!res.ok) throw new Error('rates ' + res.status);
    rates = await res.json();
    try { localStorage.setItem(RATES_KEY, JSON.stringify({ at: Date.now(), body: rates })); } catch { /* not saved */ }
    renderRates();
  } catch (e) { console.error(e); }   // no rates: the form just has no rate buttons
}
// ---- the app lock (lock.js): your device's fingerprint, face or screen-lock code opens the app.
// While locked the app is still there behind a blur; the device is asked by itself, and a tap anywhere asks again (some phones only
// show their prompt after a tap).
const root = document.documentElement;
let unlockCtl = null, hiddenAt = 0, unlockedAt = 0;   // unlockCtl: the attempt in progress (a new one replaces it)
const AWAY_MS = 3000;   // away from the app for longer than this: locked when you come back
const lockSay = (t) => { $('lockMsg').textContent = t; };
async function tryUnlock() {
  if (!root.classList.contains('locked')) return;
  if (unlockCtl) unlockCtl.abort();
  const ctl = unlockCtl = new AbortController();
  lockSay('Unlocking...');
  try { await AppLock.verify(ctl.signal); if (ctl !== unlockCtl) return; unlockedAt = Date.now(); hiddenAt = 0; root.classList.remove('locked'); blobRuns(); sizeChart(); }
  catch (e) { if (ctl === unlockCtl) lockSay(e && e.name === 'NotAllowedError' ? 'Tap anywhere to unlock' : 'Could not unlock, tap anywhere to try again'); }
}
function lockNow() {
  if (!AppLock.enabled() || root.classList.contains('locked')) return;
  closeAssetForm(); if (editing) endEdit(); if (window.Keypad) Keypad.hide();
  lockSay('Unlocking...');
  root.classList.add('locked');
  setTimeout(tryUnlock, 150);
}
$('lock').addEventListener('pointerdown', (e) => { if (!e.target.closest('#lockOut')) tryUnlock(); });
$('lockOut').addEventListener('click', async () => { AppLock.disable(); root.classList.remove('locked'); await sb.auth.signOut(); renderLock(); });   // signed out: nothing of yours is on screen
// leaving the app starts the clock; coming back after more than a few seconds locks it (the device's own prompt does not count as leaving)
const leave = () => { if (!hiddenAt && !unlockCtl && Date.now() - unlockedAt > 1500) hiddenAt = Date.now(); };
const back = () => { if (hiddenAt && Date.now() - hiddenAt > AWAY_MS) lockNow(); hiddenAt = 0; };
document.addEventListener('visibilitychange', () => (document.hidden ? leave() : back()));
window.addEventListener('pagehide', leave);
window.addEventListener('pageshow', (e) => { if (e.persisted && AppLock.enabled()) { hiddenAt = hiddenAt || Date.now() - AWAY_MS - 1; back(); } });   // brought back from the browser's page cache
async function renderLock() {
  const ok = await AppLock.supported(), on = AppLock.enabled();
  $('lockSw').classList.toggle('on', on); $('lockSw').setAttribute('aria-checked', String(on));
  $('lockSw').disabled = !ok && !on;
  $('lockSmall').textContent = on ? 'On: it asks for your fingerprint, face or phone code' : ok ? 'Ask for your fingerprint, face or phone code' : 'This device or browser cannot do it';
  $('lockSmall').classList.remove('err');
}
$('lockSw').addEventListener('click', async () => {
  $('lockSw').disabled = true;
  try {
    if (AppLock.enabled()) { await AppLock.verify(); AppLock.disable(); }   // turning it off needs you too
    else await AppLock.enable(user && user.email);
    await renderLock();
  } catch (e) {
    await renderLock();
    $('lockSmall').textContent = e && e.name === 'NotAllowedError' ? 'Cancelled, nothing changed' : 'It did not work on this device';
    $('lockSmall').classList.add('err');
  }
  $('lockSw').disabled = false;
});

// ---- Pay: your card, unlocked with your fingerprint, face or phone code; then your phone's wallet opens, ready to tap.
// Honest limit: a web page cannot hold or read your Google Pay card, and it cannot make a contactless payment: those belong to the wallet app
// and the phone's secure chip. This tab unlocks (the device checks it is you), then opens the wallet app; holding the phone to the reader is done there.
let payUnlocked = false, payCtl = null;
const walletLink = () => {
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) return 'intent://#Intent;package=com.google.android.apps.walletnfcrel;S.browser_fallback_url=' + encodeURIComponent('https://wallet.google.com/') + ';end';   // the Google Wallet app, or its web page if it is not installed
  if (/iphone|ipad|ipod/i.test(ua)) return 'shoebox://';   // Apple Wallet
  return 'https://wallet.google.com/';
};
function renderPay() {
  const cash = shared.find((x) => (!x.kind || x.kind === 'cash') && x.bank_link_id);
  $('payCard').classList.toggle('open', payUnlocked);
  $('payWallet').href = walletLink();
  $('payWallet').textContent = /iphone|ipad|ipod/i.test(navigator.userAgent) ? 'Open Wallet' : 'Open Google Wallet';
  $('payBank').textContent = link ? link.bank_name : user ? 'Connect your bank in Settings' : 'Signed out';
  $('payNum').textContent = payUnlocked && cash && cash.iban_hint ? `Account ···· ${cash.iban_hint}` : '···· ···· ···· ····';
  $('payHolder').textContent = payUnlocked && cash ? cash.name : 'Your card';
  $('payState').textContent = payUnlocked ? 'Unlocked' : 'Locked';
  $('payGo').hidden = payUnlocked; $('payWallet').hidden = !payUnlocked;
}
async function payGo() {
  if (!(await PayLock.supported())) { $('payNote').textContent = 'This device or browser cannot check your fingerprint or face here, so the card stays locked.'; return; }
  if (payCtl) payCtl.abort();
  const ctl = payCtl = new AbortController();
  $('payNote').textContent = 'Waiting for your fingerprint, face or phone code...';
  try {
    if (!PayLock.enabled()) await PayLock.enable(user && user.email);   // the first time: the device makes the key for this card
    await PayLock.verify(ctl.signal);
    if (ctl !== payCtl) return;
    payUnlocked = true; renderPay();
    $('payNote').textContent = 'Hold your phone to the reader. Your wallet opens ready to tap, with the card you chose as default there.';
    location.href = walletLink();   // opens the wallet app (if the browser holds the tap back, the button below does it)
  } catch (e) {
    if (ctl === payCtl) $('payNote').textContent = e && e.name === 'NotAllowedError' ? 'Not unlocked. Tap Unlock to try again.' : 'Could not unlock. Tap Unlock to try again.';
  }
}
$('payGo').addEventListener('click', payGo);
function payEnter() { payUnlocked = false; renderPay(); $('payNote').textContent = 'Unlocks with your fingerprint, face or phone code.'; setTimeout(() => { if (tab === 'pay') payGo(); }, 350); }   // it asks by itself when you open the tab
function payRelock() { if (payCtl) { payCtl.abort(); payCtl = null; } if (payUnlocked) { payUnlocked = false; renderPay(); } }
document.addEventListener('visibilitychange', () => { if (document.hidden && tab === 'pay') { payUnlocked = false; renderPay(); } });   // coming back from the wallet: locked again

// ---- who is signed in
function onSession(session) {
  const next = session ? session.user : null;
  const changed = (next && next.id) !== (user && user.id) || pending;
  user = next; pending = false;
  renderAccount();
  if (!changed) return;
  if (user) {
    showTab('money');
    // not inside the auth callback: it holds the auth lock. Then, with a bank connected, read it (the function paces itself) and show what it found.
    setTimeout(() => load(true).then(() => bankSync(false)).then((fresh) => fresh && load(false)), 0);
  } else {
    store.clear(); link = null; renderBank(); assets = []; bankAssets = []; closeAssetForm(); renderWealth();
    data = { balance: 0, history: [0, 0], accounts: 0, thin: true, loaded: true };
    accStep = 'idle'; renderAccount(); render(false);
  }
}

// ---- settings: install the app (Chrome offers a prompt; iPhones only have Share > Add to Home Screen)
let installEv = null;
const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
function renderInstall() {
  const show = !standalone && (installEv || ios);
  $('appGroup').hidden = !show;
  $('appBtn').hidden = !installEv;
  if (show && !installEv) $('appSmall').textContent = 'Tap Share, then Add to Home Screen';
}
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEv = e; renderInstall(); });
window.addEventListener('appinstalled', () => { installEv = null; renderInstall(); });
$('appBtn').addEventListener('click', async () => { if (!installEv) return; installEv.prompt(); await installEv.userChoice.catch(() => {}); installEv = null; renderInstall(); });
renderInstall();

// ---- pull down to reload: start a downward swipe in the upper half of the screen (with the page scrolled to the top) and let go
const PTR_AT = 64;   // how far to pull (px, after resistance) before letting go reloads
const ptr = $('ptr'), views = $('views');
let pull = null;
const ptrSet = (p, snap) => {
  const y = Math.min(p, 120);
  ptr.style.transition = snap ? 'transform .38s cubic-bezier(.3, 1.35, .45, 1), opacity .2s' : 'none';
  ptr.style.opacity = Math.min(1, p / 36).toFixed(2);
  ptr.style.transform = `translate(-50%, ${(y - 56).toFixed(1)}px) rotate(${(p * 4).toFixed(0)}deg) scale(${(0.6 + Math.min(1, p / PTR_AT) * 0.4).toFixed(2)})`;
  views.style.transition = snap ? 'transform .38s cubic-bezier(.3, 1.35, .45, 1)' : 'none';
  views.style.transform = p > 0 ? `translateY(${(y * 0.55).toFixed(1)}px)` : '';
};
const content = $('content');
content.addEventListener('touchstart', (e) => {
  const t = e.touches[0];
  pull = !editing && e.touches.length === 1 && t.clientY < window.innerHeight * 0.5 && views.scrollTop <= 0 ? { x: t.clientX, y: t.clientY, p: 0, on: false } : null;
}, { passive: true });
content.addEventListener('touchmove', (e) => {
  if (!pull) return;
  const t = e.touches[0], dx = t.clientX - pull.x, dy = t.clientY - pull.y;
  if (!pull.on) {
    if (Math.abs(dx) > Math.abs(dy) || dy < -6) { pull = null; return; }   // sideways or upward: not a pull
    if (dy < 8) return;
    pull.on = true;
  }
  pull.p = Math.max(0, (dy - 8) * 0.55);
  ptr.classList.remove('spin');
  ptrSet(pull.p, false);
}, { passive: true });   // passive: a listener that may cancel makes the browser wait for it on every touch, which made scrolling feel laggy
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Letting go reloads the whole page, like a browser refresh: new code from the site arrives too, and the saved balance is shown at once.
async function reloadNow() {
  if ('serviceWorker' in navigator) navigator.serviceWorker.getRegistration().then((r) => r && r.update()).catch(() => {});
  await sleep(450);   // the spinner is seen for a moment first
  try { sessionStorage.setItem('money.reload', String(Date.now())); } catch { /* ignore */ }   // a reload you asked for does not lock the app again
  location.reload();
}
function endPull() {
  const p = pull; pull = null;
  if (!p || !p.on) return;
  if (p.p >= PTR_AT) { ptr.classList.add('spin'); ptrSet(PTR_AT * 0.8, true); reloadNow(); }
  else ptrSet(0, true);
}
content.addEventListener('touchend', endPull, { passive: true });
content.addEventListener('touchcancel', endPull, { passive: true });

// ---- start: draw what we know right away (the last balance on this device), then ask for the real one
(() => {
  const c = store.get();
  if (c && c.uid) {
    data = { accounts: c.accounts, balance: c.balance, history: c.history, thin: c.thin, fromCache: true, loaded: true };
    $('mBalance').textContent = eur(c.balance);
    say(c.accounts ? 'Click the amount to change it' : 'Click the amount to set your balance');
    $('mTag').textContent = ''; document.body.classList.remove('loading');
  }
})();
renderAccount();
renderBank();
renderWealth();
renderRates();
// numbers come from the app's own keypad (the sign-in code too, but not the email)
Keypad.attach($('mEdit'), { decimal: true });
Keypad.attach($('asValue'), { decimal: true });
Keypad.attach($('asInvested'), { decimal: true });
Keypad.attach($('asRate'), { decimal: true, max: 5 });
Keypad.attach($('accIn'), { decimal: false, max: 10, when: () => accStep === 'code' });
renderPay();
renderLock();
if (root.classList.contains('locked')) setTimeout(tryUnlock, 500);   // the cover is already up (lock.js ran first)
showTab('money');
setTimeout(() => loadRates(), 1500);   // after the first paint
if (bankReturn) showTab('settings');   // coming back from the bank: show the result where it was started
sizeChart();
sb.auth.onAuthStateChange((_event, session) => onSession(session));
sb.auth.getSession().then(({ data: d }) => onSession(d.session));
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => { /* the app works without it */ });
