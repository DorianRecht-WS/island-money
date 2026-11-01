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

  // What a balance typed in on a given day is worth now if it earns ratePct a year (compounded daily, like a livret's interest builds up).
  function grow(value, ratePct, since, today = new Date()) {
    const days = (today - new Date(since)) / 864e5;
    if (!(ratePct > 0) || !(days > 0) || !Number.isFinite(days)) return r2(value);
    return r2(value * (1 + ratePct / 100) ** (days / 365.25));
  }

  // How much your savings and investments grow in a year, from the rate of each one: the rate you typed in, or for an investment
  // without one, the yearly return it has actually made. Items with neither (and debts) are left out and listed, so the total is honest.
  function growth(assets, today = new Date()) {
    const items = [], missing = [];
    let base = 0, perYear = 0;
    for (const a of assets || []) {
      if (a.kind === 'debt' || !(a.value > 0)) continue;
      const fromRate = a.rate > 0 ? a.rate / 100 : null;
      const rate = fromRate !== null ? fromRate : (a.kind === 'investment' && a.since ? yearly(a.invested, a.value, a.since, today) : null);
      if (rate === null) { if (!a.fromBank) missing.push(a.name); continue; }
      const per = a.value * rate;
      items.push({ name: a.name, kind: a.kind, value: a.value, rate, perYear: r2(per), from: fromRate !== null ? 'rate' : 'return' });
      base += a.value; perYear += per;
    }
    items.sort((x, y) => y.perYear - x.perYear);
    return { perYear: r2(perYear), base: r2(base), pct: base > 0 ? perYear / base : 0, items, missing };
  }

  return { r2, KINDS, totals, gain, yearly, grow, growth };
})();
if (typeof module !== 'undefined') module.exports = Wealth; else window.Wealth = Wealth;
