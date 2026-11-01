// The arithmetic of the Budget tab: what was spent this month in each category, against the monthly limits. No page code, so it can be
// tested: node --test money-app/budget.test.cjs
const Budget = (() => {
  const r2 = (n) => Math.round(n * 100) / 100;
  // the categories you can set a limit on (the bank function sorts operations into these, see supabase/functions/bank/sync.ts)
  const SPEND = ['Groceries', 'Eating out', 'Fuel', 'Transport', 'Shopping', 'Bills', 'Health', 'Leisure', 'Home', 'Other'];
  // money in, moves between your own accounts and the app's own corrections are not spending
  const NOT_SPENT = new Set(['Income', 'Transfers', 'Pending', 'Balance edit']);

  const monthStart = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  const daysLeft = (d = new Date()) => new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate() - d.getDate() + 1;   // today included

  // what was spent per category (positive numbers); an operation sorted before categories existed ("Bank") counts as Other
  function spentBy(txs) {
    const out = {};
    for (const t of txs || []) {
      if (!(t.amount < 0) || NOT_SPENT.has(t.category)) continue;
      const c = SPEND.includes(t.category) ? t.category : 'Other';
      out[c] = r2((out[c] || 0) + -t.amount);
    }
    return out;
  }

  // the rows of the card: every category with a limit, how much is spent and left, and how it is going
  function summary(txs, limits) {
    const spent = spentBy(txs), rows = [];
    let limit = 0, used = 0;
    for (const c of SPEND) {
      const lim = limits[c];
      if (!(lim > 0)) continue;
      const s = spent[c] || 0;
      rows.push({ category: c, limit: lim, spent: s, left: r2(lim - s), pct: s / lim, state: s > lim ? 'over' : s / lim >= 0.8 ? 'warn' : 'ok' });
      limit += lim; used += s;
    }
    const unbudgeted = r2(SPEND.filter((c) => !(limits[c] > 0)).reduce((a, c) => a + (spent[c] || 0), 0));
    return { rows, limit: r2(limit), spent: r2(used), left: r2(limit - used), pct: limit ? used / limit : 0, unbudgeted };
  }
  // the merchant's name, simplified: the same as merchantKey in supabase/functions/bank/sync.ts, so a correction made here is found there
  const merchantKey = (note) => String(note).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/^(CB|PAIEMENT CB|PAIEMENT PAR CARTE|ACHAT CB)\s+/, '').replace(/[0-9/.:*-]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40);
  // a readable name: the bank's text has the card's masked number, an invoice date and padding in it (the same as cleanNote in
  // supabase/functions/bank/sync.ts; done here too so names look right even before the next sync)
  const cleanNote = (raw) => String(raw || '').replace(/\d{4,6}\*+\d*/g, ' ').replace(/\bFACT\s*\d{4,8}\b/gi, ' ').replace(/^\s*(CB|PAIEMENT CB|PAIEMENT PAR CARTE|ACHAT CB)\s+/i, '').replace(/\s+/g, ' ').trim().split(' ').map((w) => (w.length <= 3 ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())).join(' ');
  return { r2, SPEND, NOT_SPENT, monthStart, daysLeft, spentBy, summary, merchantKey, cleanNote };
})();
if (typeof module !== 'undefined') module.exports = Budget; else window.Budget = Budget;
