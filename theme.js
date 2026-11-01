// Theme and palette: read before the first paint so the island never flashes the wrong colours.
// Every palette shares one very dark base; a palette is only its accent colours, which show up as bright pastel chips,
// the play button, the active tab and the switches. Light keeps its own neutrals and takes the deeper accent tones.
(() => {
  const KEY = 'island.settings';
  const BASE = { // the shared dark base (near-black, a hint of blue)
    '--bg': '#08080d', '--card': '#1c1c27', '--card-line': '#262634', '--surface': '#232330', '--surface-2': '#2b2b3b', '--line': '#14141c', '--line-2': '#2a2b3a',
    '--text-hi': '#ffffff', '--text': '#eceef4', '--text-2': '#b4b8c8', '--text-3': '#7b8094', '--text-4': '#50546a',
  };
  // a / b: the two accents, each [on dark, on light]
  const PALETTES = {
    lime:   { name: 'Lime',   a: ['#d4f24a', '#6f8f00'], b: ['#ff8a5c', '#ff5a36'] },
    lilac:  { name: 'Lilac',  a: ['#c4a8ff', '#7a4fe0'], b: ['#8ec5ff', '#3b82d9'] },
    ember:  { name: 'Ember',  a: ['#ff9a5a', '#e0561f'], b: ['#ffd166', '#d99a1c'] },
    aurora: { name: 'Aurora', a: ['#7ae8d0', '#14a39a'], b: ['#8da2ff', '#5566e6'] },
    coral:  { name: 'Coral',  a: ['#ff7b72', '#e5483b'], b: ['#ffb86b', '#d9822b'] },
    sky:    { name: 'Sky',    a: ['#8ec5ff', '#3b82d9'], b: ['#c9a6ff', '#8a5fe0'] },
  };
  // hues for the cards' chips (Money): each kind of card has its own, so neighbours never match; [on dark, on light]
  const HUES = {
    lime: ['#d4f24a', '#6f8f00'], orange: ['#f5a76c', '#d9822b'], green: ['#7fe0b4', '#2f9d6b'], red: ['#ff8c82', '#e5483b'], sky: ['#7fd6f0', '#2a9fc4'],
    yellow: ['#f1d764', '#c9a21e'], pink: ['#f391b8', '#d9558a'], violet: ['#c9a6ff', '#8a5fe0'], blue: ['#82a8ec', '#4f7fd0'],
  };
  const s = { theme: 'dark', palette: 'lime' };
  try { Object.assign(s, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { /* no storage: defaults */ }
  if (!PALETTES[s.palette]) s.palette = 'lime';   // palettes saved by older versions
  const light = matchMedia('(prefers-color-scheme: light)');
  const listeners = [];
  const resolved = () => (s.theme === 'auto' ? (light.matches ? 'light' : 'dark') : s.theme);
  function apply() {
    const root = document.documentElement, r = resolved(), p = PALETTES[s.palette], dark = r === 'dark';
    root.dataset.theme = r;
    for (const [k, v] of Object.entries(BASE)) dark ? root.style.setProperty(k, v) : root.style.removeProperty(k);
    root.style.setProperty('--accent', p.a[dark ? 0 : 1]);
    root.style.setProperty('--accent-2', p.b[dark ? 0 : 1]);
    for (const [k, v] of Object.entries(HUES)) root.style.setProperty('--c-' + k, v[dark ? 0 : 1]);
    for (const f of listeners) f(r);
  }
  light.addEventListener('change', () => { if (s.theme === 'auto') apply(); });
  window.islandTheme = {
    get: () => ({ ...s }),
    palettes: PALETTES,
    set(patch) {
      Object.assign(s, patch);
      try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ }
      apply();
    },
    onChange: (f) => listeners.push(f),
  };
  apply();
})();
