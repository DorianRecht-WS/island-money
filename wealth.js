// The arithmetic of the Wealth tab (net worth, gains, yearly return, growth projection). No page code here, so it can be tested:
// node --test money-app/wealth.test.cjs
const Wealth = (() => {
  const r2 = (n) => Math.round(n * 100) / 100;
  const KINDS = { investment: 'Investment', savings: 'Savings', property: 'Property', debt: 'Debt' };

  // Everything in one place: cash (the bank balance) plus what you own, minus what you owe.
  function totals(cash, assets) {
    const t = { cash: r2(cash), inv: 0, invested: 0, sav: 0, prop: 0, debt: 0 };
    for (const a of assets || []) {
      if (a.kind === 'investment') { t.inv += a.value; t.invested += a.invested; }
      else if (a.kind === 'savings') t.sav += a.value;
      else if (a.kind === 'property') t.prop += a.value;
      else if (a.kind === 'debt') t.debt += a.value;
    }
    for (const k of ['inv', 'invested', 'sav', 'prop', 'debt']) t[k] = r2(t[k]);
    t.net = r2(t.cash + t.inv + t.sav + t.prop - t.debt);
    return t;
  }

  // Gain of one investment: how much, and how many percent of what was put in. Null when nothing was put in.
  function gain(invested, value) {
    if (!(invested > 0)) return null;
    return { amount: r2(value - invested), pct: (value - invested) / invested };
  }

  // The yearly rate that turns `invested` into `value` over the time since `since` (compound). Null under a month: too early to mean anything.
  function yearly(invested, value, since, today = new Date()) {
    const days = (today - new Date(since)) / 864e5;
    if (!(invested > 0) || !(value > 0) || !(days >= 30)) return null;
    return (value / invested) ** (365.25 / days) - 1;
  }

  // Growth with monthly compounding: start with `start`, add `monthly` every month, earn `ratePct` a year.
  // Returns one point per year: what it is worth and what you put in.
  function project(start, monthly, ratePct, years) {
    const m = (1 + ratePct / 100) ** (1 / 12) - 1;
    let v = start, put = start;
    const pts = [{ year: 0, value: r2(v), put: r2(put) }];
    for (let y = 1; y <= years; y++) {
      for (let i = 0; i < 12; i++) { v = v * (1 + m) + monthly; put += monthly; }
      pts.push({ year: y, value: r2(v), put: r2(put) });
    }
    return pts;
  }

  return { r2, KINDS, totals, gain, yearly, project };
})();
if (typeof module !== 'undefined') module.exports = Wealth; else window.Wealth = Wealth;
