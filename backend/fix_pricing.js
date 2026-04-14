/**
 * fix_pricing.js — Clean up duplicate pricing entries
 * Run: node backend/fix_pricing.js
 */
const db = require('./db');

async function fix() {
  console.log('--- Fixing Pricing Rules ---');

  // Remove all existing data and re-seed cleanly
  await db.query('DELETE FROM pricing_rules');
  console.log('[OK] Cleared pricing_rules table.');

  // Correct pricing for all countries: free + premium + pro
  const countries = [
    // Zone XAF (Gabon, Cameroun, Tchad, Centrafrique, Congo)
    { cc: 'GA', cur: 'XAF', premium: 2000, pro: 10000 },
    { cc: 'CM', cur: 'XAF', premium: 2000, pro: 10000 },
    { cc: 'TD', cur: 'XAF', premium: 2000, pro: 10000 },
    { cc: 'CF', cur: 'XAF', premium: 2000, pro: 10000 },
    { cc: 'CG', cur: 'XAF', premium: 2000, pro: 10000 },
    { cc: 'GQ', cur: 'XAF', premium: 2000, pro: 10000 },

    // Zone XOF (Sénégal, Côte d'Ivoire, Bénin, Togo, Burkina, Mali, Niger, Guinée-Bissau)
    { cc: 'SN', cur: 'XOF', premium: 2000, pro: 10000 },
    { cc: 'CI', cur: 'XOF', premium: 2000, pro: 10000 },
    { cc: 'BJ', cur: 'XOF', premium: 2000, pro: 10000 },
    { cc: 'TG', cur: 'XOF', premium: 2000, pro: 10000 },
    { cc: 'BF', cur: 'XOF', premium: 2000, pro: 10000 },
    { cc: 'ML', cur: 'XOF', premium: 2000, pro: 10000 },
    { cc: 'NE', cur: 'XOF', premium: 2000, pro: 10000 },

    // Autres pays africains
    { cc: 'CD', cur: 'CDF', premium: 5000, pro: 25000 },
    { cc: 'GN', cur: 'GNF', premium: 20000, pro: 100000 },
    { cc: 'MG', cur: 'MGA', premium: 10000, pro: 50000 },
    { cc: 'KM', cur: 'KMF', premium: 2000, pro: 10000 },
    { cc: 'DJ', cur: 'DJF', premium: 1000, pro: 5000 },
    { cc: 'NG', cur: 'NGN', premium: 3000, pro: 15000 },
    { cc: 'GH', cur: 'GHS', premium: 50, pro: 250 },
    { cc: 'KE', cur: 'KES', premium: 500, pro: 2500 },
    { cc: 'RW', cur: 'RWF', premium: 5000, pro: 25000 },
    { cc: 'ZA', cur: 'ZAR', premium: 100, pro: 500 },
    { cc: 'MU', cur: 'MUR', premium: 200, pro: 1000 },
    { cc: 'SC', cur: 'SCR', premium: 100, pro: 500 },

    // Europe (fallback)
    { cc: 'FR', cur: 'EUR', premium: 4.99, pro: 14.99 },
  ];

  let count = 0;
  for (const c of countries) {
    // Free plan
    await db.query(
      'INSERT INTO pricing_rules (country_code, plan_type, price, currency, vat_rate) VALUES (?, ?, ?, ?, ?)',
      [c.cc, 'free', 0, c.cur, 0]
    );
    // Premium
    await db.query(
      'INSERT INTO pricing_rules (country_code, plan_type, price, currency, vat_rate) VALUES (?, ?, ?, ?, ?)',
      [c.cc, 'premium', c.premium, c.cur, 0]
    );
    // Pro
    await db.query(
      'INSERT INTO pricing_rules (country_code, plan_type, price, currency, vat_rate) VALUES (?, ?, ?, ?, ?)',
      [c.cc, 'pro', c.pro, c.cur, 0]
    );
    count++;
  }

  console.log(`[OK] Seeded ${count} countries × 3 plans = ${count * 3} pricing rules.`);

  // Verify GA specifically
  const { rows: ga } = await db.query("SELECT plan_type, price, currency FROM pricing_rules WHERE country_code='GA' ORDER BY plan_type");
  console.log('GA pricing:', ga);

  process.exit(0);
}

fix();
