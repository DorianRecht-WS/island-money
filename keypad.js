// The app's own number keypad: a field that takes a number opens it from the bottom of the screen instead of the phone's keyboard.
// Fields stay ordinary <input>s: the keypad types into them and fires their "input" event. A computer's keyboard still works.
const Keypad = (() => {
  let el = null, target = null, opts = {}, fresh = false;

  function build() {
    el = document.createElement('div');
    el.id = 'kp'; el.hidden = true;
    el.setAttribute('role', 'group'); el.setAttribute('aria-label', 'Number keypad');
    const key = (k, label, cls = '') => `<button type="button" class="kpk ${cls}" data-k="${k}" aria-label="${k === 'back' ? 'Delete' : k === '.' ? 'Decimal point' : k}">${label}</button>`;
    el.innerHTML = ['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((n) => key(n, n)).join('')
      + key('.', '.', 'dot') + key('0', '0') + key('back', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9l-6-6z"/><path d="M12.5 10.5l4 4M16.5 10.5l-4 4"/></svg>', 'back')
      + '<button type="button" class="kpdone" data-k="done">Done</button>';
    // pressing a key must not take the focus away from the field it types into
    for (const ev of ['pointerdown', 'mousedown']) el.addEventListener(ev, (e) => { e.preventDefault(); if (ev === 'pointerdown') { const b = e.target.closest('button'); if (b) press(b.dataset.k); } });
    document.body.appendChild(el);
    // a tap anywhere else puts the keypad away
    document.addEventListener('pointerdown', (e) => { if (target && !e.target.closest('#kp') && !e.target.closest('[data-kp]')) target.blur(); });
  }

  function press(k) {
    if (!target) return;
    if (k === 'done') {
      const t = target;
      if (t.value.endsWith('.')) { t.value = t.value.slice(0, -1); t.dispatchEvent(new Event('input', { bubbles: true })); }   // "2450." means 2450
      hide(); t.dispatchEvent(new Event('kpdone')); t.blur(); return;   // 'kpdone': the field's owner can act on Done even if the browser sends no blur
    }
    let v = target.value;
    if (k === 'back') v = fresh ? '' : v.slice(0, -1);
    else if (k === '.') { if (!opts.decimal) return; v = fresh || v === '' ? '0.' : v.includes('.') ? v : v + '.'; }
    else {
      if (fresh) v = '';
      const dot = v.indexOf('.');
      if (dot >= 0 && v.length - dot - 1 >= (opts.decimals ?? 2)) return;   // two decimals, like money
      if (v === '0' && dot < 0) v = '';
      if (v.replace('.', '').length >= (opts.max ?? 12)) return;
      v += k;
    }
    fresh = false;
    target.value = v;
    target.dispatchEvent(new Event('input', { bubbles: true }));
    if (navigator.vibrate) navigator.vibrate(6);
  }

  function show(input, o) {
    if (!el) build();
    target = input; opts = o; fresh = !!input.value;   // the first digit replaces what was there
    el.hidden = false; document.body.classList.add('kp-open');
    setTimeout(() => input.scrollIntoView({ block: 'center', behavior: 'smooth' }), 60);
  }
  function hide() { if (el) el.hidden = true; document.body.classList.remove('kp-open'); target = null; }

  // the field takes numbers from the keypad (or a computer keyboard) and never opens the phone's own keyboard
  function attach(input, o = {}) {
    input.dataset.kp = '1';
    refresh(input, o);
    const open = () => { if (!o.when || o.when()) show(input, o); };
    input.addEventListener('focus', open);
    input.addEventListener('click', open);
    input.addEventListener('blur', () => setTimeout(() => { if (target === input && document.activeElement !== input) hide(); }, 60));
    input.addEventListener('keydown', (e) => {
      if (o.when && !o.when()) return;
      const map = { Backspace: 'back', Enter: 'done', ',': '.', '.': '.' };
      const k = /^[0-9]$/.test(e.key) ? e.key : map[e.key];
      if (!k || e.ctrlKey || e.metaKey) return;
      e.preventDefault();
      press(k);
    });
    input._kpOpts = o;
  }
  // (call again when a field changes between taking numbers and taking text, like the sign-in code and email)
  function refresh(input, o = input._kpOpts || {}) {
    const on = !o.when || o.when();
    input.readOnly = on; if (on) input.setAttribute('inputmode', 'none');   // (when off, the caller's own mode, like email, stays)
    if (!on && target === input) hide();
  }
  return { attach, refresh, hide, press };
})();
window.Keypad = Keypad;
