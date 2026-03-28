const db = require('./db');

async function seed() {
  console.log('--- SEEDING ADMIN DATA ---');

  // 1. Routines Globales
  const routines = [
    { slug: 'matinale', name: 'Réveil Visuel', description: 'Une routine douce pour commencer la journée.', exs: '[1,2,3]', dur: 120 },
    { slug: 'intense', name: 'Détox Numérique', description: 'Soulagement profond après une longue session.', exs: '[4,5,6,7]', dur: 300 },
    { slug: 'focus', name: 'Concentration Optique', description: 'Améliorez votre focus et votre acuité.', exs: '[8,9,10]', dur: 180 }
  ];

  for (const r of routines) {
    try {
      await db.query(
        'INSERT IGNORE INTO global_routines (slug, name, description, exs, dur, is_active) VALUES (?, ?, ?, ?, ?, 1)',
        [r.slug, r.name, r.description, r.exs, r.dur]
      );
      console.log(`Routine [${r.name}] insérée.`);
    } catch (e) { console.error(e); }
  }

  // 2. Tarifs Afrique
  const countries = [
    {cc:"GA", n:"Gabon", cur:"XAF"}, {cc:"CM", n:"Cameroun", cur:"XAF"}, 
    {cc:"CI", n:"Côte d'Ivoire", cur:"XOF"}, {cc:"SN", n:"Sénégal", cur:"XOF"}, 
    {cc:"BJ", n:"Bénin", cur:"XOF"}, {cc:"TG", n:"Togo", cur:"XOF"}, 
    {cc:"BF", n:"Burkina Faso", cur:"XOF"}, {cc:"ML", n:"Mali", cur:"XOF"}, 
    {cc:"NE", n:"Niger", cur:"XOF"}, {cc:"TD", n:"Tchad", cur:"XAF"},
    {cc:"NG", n:"Nigeria", cur:"NGN"}, {cc:"GH", n:"Ghana", cur:"GHS"},
    {cc:"KE", n:"Kenya", cur:"KES"}, {cc:"RW", n:"Rwanda", cur:"RWF"},
    {cc:"ZA", n:"Afrique du Sud", cur:"ZAR"}
  ];

  const plans = [
    {type: 'premium', price: 5000}, // Prix base CFA
    {type: 'pro', price: 25000}
  ];

  for (const c of countries) {
    for (const p of plans) {
       // On garde 5000/25000 comme base pour les pays CFA, sinon on convertit à la louche ou laisse l'admin ajuster
       let finalPrice = p.price;
       if (c.cur === 'NGN') finalPrice = p.price * 2;
       if (c.cur === 'KES') finalPrice = p.price * 0.2;
       
       try {
         await db.query(
          'INSERT IGNORE INTO pricing_rules (country_code, plan_type, price, currency, vat_rate) VALUES (?, ?, ?, ?, 18)',
          [c.cc, p.type, finalPrice, c.cur]
         );
       } catch (e) { }
    }
  }
  console.log('Tarifs africains insérés.');

  console.log('--- SEEDING TERMINÉ ---');
  process.exit();
}

seed();
