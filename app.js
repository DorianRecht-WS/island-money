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
const eur = (n) => (n < 0 ? '−' : '') + '€' + Math.abs(Math.round(n)).toLocaleString('en-US');
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
  paintBlob(); mb.start(); mb.setExpression('money'); mb.look(null);
  window.islandTheme.onChange(paintBlob);
  document.addEventListener('mousemove', (e) => mb.look(e.clientX, e.clientY));
  document.addEventListener('mouseleave', () => mb.look(null));
  $('mBlob').addEventListener('click', () => mb.play('wink', 1.2));   // a tap on it winks
  if (!reduced && tab === 'money') blobEntrance($('mBlob'));
}).catch((e) => { console.error('blob', e); if (tries > 1) setTimeout(() => loadBlob(tries - 1), 1500); });   // no blob: the numbers still work
loadBlob();

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
function enter(view) {
  notchIn($('v-' + view));
  if (view === 'money') {
    rise([$('mBal'), $('mChart')], 30, 80);
    if (mb) blobEntrance($('mBlob'));
    countUp($('mBalance'), data.balance, 1000, 200); drawIn();
  } else rise([...document.querySelectorAll('#v-settings .group')], 30, 70);
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
const TABS = ['money', 'settings'];
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
  if (!first) { enter(t); if (t === 'money' && user) refresh(); }
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
async function load(animate) {
  const [a, h] = await Promise.all([
    sb.from('bank_accounts').select('id,name,opening_balance,opened_on').order('created_at'),
    sb.from('balance_history').select('day,balance').order('day'),
  ]);
  const err = a.error || h.error;
  if (err) { data.loaded = true; render(false); say(fail(err), true); return; }
  const history = h.data.map((x) => Number(x.balance));
  const before = data.balance, had = !!data.fromCache;   // had: the saved balance was already on screen
  data = { accounts: a.data.length, accountId: a.data[0] && a.data[0].id, balance: history.length ? history[history.length - 1] : 0, history: history.length > 1 ? history : [history[0] || 0, history[0] || 0], loaded: true };
  data.thin = history.length < 2 || history.every((v) => v === history[0]);
  store.set({ uid: user.id, email: user.email || '', accounts: data.accounts, balance: data.balance, history: data.history, thin: data.thin });
  render(animate && !had);
  if (had && before !== data.balance && tab === 'money') { countUp($('mBalance'), data.balance, 700, 0, before); drawIn(); }   // the cached number was out of date
}
// the app comes back to the front: fetch again, so a change made on another device shows (at most once every 3 s)
let lastLoad = 0;
function refresh() {
  if (!user || editing || Date.now() - lastLoad < 3000) return;
  lastLoad = Date.now();
  const before = data.balance;
  load(false).then(() => { if (tab === 'money' && data.balance !== before) countUp($('mBalance'), data.balance, 600, 0, before); });
}
document.addEventListener('visibilitychange', () => { if (!document.hidden && tab === 'money') refresh(); });
window.addEventListener('focus', () => { if (tab === 'money') refresh(); });

function say(text, bad) { $('mIO').textContent = text; $('mIO').classList.toggle('err', !!bad); }
function render(animate) {
  const body = document.body;
  body.classList.toggle('out', !user && !pending);
  body.classList.toggle('loading', !data.loaded);   // the skeleton shows until real (or saved) numbers exist
  $('mTag').textContent = pending ? '' : user ? 'Live' : 'Signed out'; $('mTag').classList.toggle('live', !!user);
  $('mBalance').title = user ? 'Click to change' : 'Sign in';
  if (!user && !pending) { $('mBalance').textContent = '€-'; say('Tap here to sign in'); drawChart(); return; }
  if (!animate) $('mBalance').textContent = eur(data.balance);
  say(data.accounts ? 'Click the amount to change it' : 'Click the amount to set your balance');
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

// ---- who is signed in
function onSession(session) {
  const next = session ? session.user : null;
  const changed = (next && next.id) !== (user && user.id) || pending;
  user = next; pending = false;
  renderAccount();
  if (!changed) return;
  if (user) {
    showTab('money'); setTimeout(() => load(true), 0);   // not inside the auth callback: it holds the auth lock
  } else {
    store.clear();
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
  if (e.cancelable) e.preventDefault();
  pull.p = Math.max(0, (dy - 8) * 0.55);
  ptr.classList.remove('spin');
  ptrSet(pull.p, false);
}, { passive: false });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Letting go reloads the whole page, like a browser refresh: new code from the site arrives too, and the saved balance is shown at once.
async function reloadNow() {
  if ('serviceWorker' in navigator) navigator.serviceWorker.getRegistration().then((r) => r && r.update()).catch(() => {});
  await sleep(450);   // the spinner is seen for a moment first
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
showTab('money');
sizeChart();
sb.auth.onAuthStateChange((_event, session) => onSession(session));
sb.auth.getSession().then(({ data: d }) => onSession(d.session));
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => { /* the app works without it */ });
