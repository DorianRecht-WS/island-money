// The arithmetic of the Goals tab: how far along a goal is, when it will be reached, and what it needs each month. No page code, so it
// can be tested: node --test money-app/goals.test.cjs
const Goals = (() => {
  const r2 = (n) => Math.round(n * 100) / 100;
  const addMonths = (d, n) => { const x = new Date(d.getFullYear(), d.getMonth() + n, d.getDate()); return x; };
  const monthsBetween = (from, to) => Math.max(1, Math.ceil((to - from) / (1000 * 60 * 60 * 24 * 30.4375)));

  // saved: what is there now; target: what is wanted; monthly: what is added each month; rate: yearly interest in percent;
  // deadline: a date (or null). Interest is added monthly (rate / 12).
  function plan({ saved, target, monthly = 0, rate = 0, deadline = null, today = new Date() }) {
    saved = Math.max(0, saved); monthly = Math.max(0, monthly);
    const i = rate / 1200, out = { pct: target > 0 ? Math.min(1, saved / target) : 0, remaining: r2(Math.max(0, target - saved)), done: saved >= target, months: null, reach: null, need: null, status: 'open' };
    if (out.done) { out.status = 'done'; return out; }
    // months until the goal is reached, month by month (at most 50 years)
    if (monthly > 0 || i > 0) {
      let v = saved;
      for (let n = 1; n <= 600; n++) { v = v * (1 + i) + monthly; if (v >= target) { out.months = n; out.reach = addMonths(today, n); break; } }
    }
    if (deadline) {
      const n = monthsBetween(today, deadline), g = (1 + i) ** n;
      out.need = r2(Math.max(0, i > 0 ? (target - saved * g) * i / (g - 1) : (target - saved) / n));
      out.status = monthly + 0.005 >= out.need ? 'ontrack' : 'behind';
    }
    return out;
  }

  // what a goal counts, from the items (each { id, kind, value, rate }): all savings, all investments, or one item; the rate is the average weighted by value
  function source(g, items) {
    if (g.source === 'savings' || g.source === 'investments') {
      const kind = g.source === 'savings' ? 'savings' : 'investment', list = items.filter((a) => a.kind === kind), total = list.reduce((s, a) => s + a.value, 0);
      return { saved: r2(total), rate: total > 0 ? list.reduce((s, a) => s + a.value * (a.rate || 0), 0) / total : 0, found: true };
    }
    if (g.source && g.source !== 'manual') {
      const a = items.find((x) => String(x.id) === String(g.source));
      return a ? { saved: r2(a.value), rate: a.rate || 0, found: true } : { saved: 0, rate: 0, found: false };
    }
    return { saved: Number(g.saved) || 0, rate: 0, found: true };
  }
  // "account is over value": how far along it is, whether it is over already, and by how much (or how much is missing)
  function over(now, target) {
    return { pct: target > 0 ? Math.max(0, Math.min(1, now / target)) : 0, reached: now >= target, diff: r2(Math.abs(now - target)) };
  }
  return { r2, addMonths, plan, source, over };
})();
if (typeof module !== 'undefined') module.exports = Goals; else window.Goals = Goals;
