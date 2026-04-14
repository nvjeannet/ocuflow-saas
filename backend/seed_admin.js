/**
 * seed_admin.js — Migration + Seeding script for Admin HQ V2
 * Run: node backend/seed_admin.js
 */
const db = require('./db');

async function run() {
  console.log('--- Admin HQ Migration & Seeding ---');

  // 1. Add routine_id to sessions (if missing)
  try {
    await db.query('ALTER TABLE sessions ADD COLUMN routine_id INT NULL');
    console.log('[OK] Added routine_id to sessions.');
  } catch (e) {
    if (e.code === 'ER_DUP_FIELDNAME') console.log('[SKIP] routine_id already exists.');
    else console.error('[ERR] sessions migration:', e.message);
  }

  // 2. Seed movements
  const movements = [
    { cat: 'pursuit', name: 'Horizontal', icon: '↔', slug: 'horizontal', desc: 'Améliore la coordination horizontale des yeux.' },
    { cat: 'pursuit', name: 'Vertical', icon: '↕', slug: 'vertical', desc: 'Renforce les muscles supérieurs et inférieurs.' },
    { cat: 'pursuit', name: 'Diagonale ↗', icon: '↗', slug: 'diag-ur', desc: 'Coordination des muscles obliques.' },
    { cat: 'pursuit', name: 'Diagonale ↖', icon: '↖', slug: 'diag-ul', desc: 'Souplesse des obliques.' },
    { cat: 'pursuit', name: 'Rotation ↻', icon: '↻', slug: 'rotation-cw', desc: 'Exercice complet de rotation.' },
    { cat: 'pursuit', name: 'Rotation ↺', icon: '↺', slug: 'rotation-ccw', desc: 'Fluidité binoculaire.' },
    { cat: 'pursuit', name: 'Lemniscate H', icon: '∞', slug: 'lemni-h', desc: 'Le 8 couché horizontal.' },
    { cat: 'pursuit', name: 'Lemniscate V', icon: '∞', slug: 'lemni-v', desc: 'Fluidité verticale.' },
    { cat: 'pursuit', name: 'Spirale', icon: '⊛', slug: 'spiral', desc: 'Focus précis et convergence.' },
    { cat: 'pursuit', name: 'Zigzag', icon: '≋', slug: 'zigzag', desc: 'Lecture rapide et suivi.' },
    { cat: 'saccade', name: 'Saccades H', icon: '⇔', slug: 'saccades-h', desc: 'Améliore la rapidité du regard.' },
    { cat: 'saccade', name: 'Saccades V', icon: '⇕', slug: 'saccades-v', desc: 'Balayage visuel vertical.' },
    { cat: 'saccade', name: 'Aléatoire', icon: '⁂', slug: 'random', desc: 'Réactivité oculaire aléatoire.' },
    { cat: 'saccade', name: 'Grille 3x3', icon: '⊞', slug: 'grid', desc: 'Fixation précise en quadrillage.' },
    { cat: 'accommodation', name: 'Zoom', icon: '⊙', slug: 'zoom', desc: 'Assouplit le cristallin.' },
    { cat: 'accommodation', name: 'Convergence', icon: '⊕', slug: 'convergence', desc: 'Lutte contre l\'insuffisance de convergence.' },
    { cat: 'accommodation', name: 'Profondeur', icon: '◎', slug: 'depth', desc: 'Flexibilité focale.' },
    { cat: 'relaxation', name: '20-20-20', icon: '👁', slug: 'relax-20', desc: 'Méthode standard de repos visuel.' },
    { cat: 'relaxation', name: 'Palmage', icon: '🤲', slug: 'palming', desc: 'Repos complet de la rétine.' }
  ];

  try {
    await db.query('DELETE FROM movements');
    for (const m of movements) {
      await db.query(
        'INSERT INTO movements (slug, name, icon, description, category, default_duration) VALUES (?, ?, ?, ?, ?, 30)',
        [m.slug, m.name, m.icon, m.desc, m.cat]
      );
    }
    console.log(`[OK] Seeded ${movements.length} movements.`);
  } catch (e) { console.error('[ERR] movements seed:', e.message); }

  // 3. Seed tips
  const tips = [
    { cat: 'santé', content: 'La règle du 20-20-20 : fixez un objet à 20 pieds pendant 20 secondes toutes les 20 minutes.' },
    { cat: 'ergonomie', content: 'Placez votre écran à une distance de bras (environ 50-70 cm) pour éviter la fatigue.' },
    { cat: 'ambiance', content: 'Évitez les reflets sur votre écran en ajustant l\'éclairage de votre pièce.' },
    { cat: 'sommeil', content: 'Réduisez la lumière bleue 1h avant de dormir pour un meilleur repos oculaire.' },
    { cat: 'nutrition', content: 'Les carottes et les épinards sont excellents pour la santé de votre rétine.' },
    { cat: 'gym', content: 'Clignez des yeux volontairement pour bien hydrater la cornée.' }
  ];

  try {
    await db.query('DELETE FROM tips');
    for (const t of tips) {
      await db.query('INSERT INTO tips (content, category) VALUES (?, ?)', [t.content, t.cat]);
    }
    console.log(`[OK] Seeded ${tips.length} tips.`);
  } catch (e) { console.error('[ERR] tips seed:', e.message); }

  // 4. Seed global routines
  const routines = [
    { slug: 'office', name: 'Bureau (Pause)', icon: '💻', desc: 'Soulage la fatigue numérique rapidement.', exs: '[1,2,15,18]', dur: 120 },
    { slug: 'wakeup', name: 'Réveil Matin', icon: '🌅', desc: 'Réveille vos muscles pour la journée.', exs: '[5,6,9,10,14]', dur: 180 },
    { slug: 'night', name: 'Repos du Soir', icon: '🌙', desc: 'Détend vos yeux avant de dormir.', exs: '[18,19,2,16,17]', dur: 300 },
    { slug: 'focus', name: 'Focus Intense', icon: '🎯', desc: 'Améliore la concentration et la vue.', exs: '[11,12,13,15,17]', dur: 240 }
  ];

  try {
    await db.query('DELETE FROM global_routines');
    for (const r of routines) {
      await db.query(
        'INSERT INTO global_routines (slug, name, icon, description, exs, dur, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)',
        [r.slug, r.name, r.icon, r.desc, r.exs, r.dur]
      );
    }
    console.log(`[OK] Seeded ${routines.length} global routines.`);
  } catch (e) { console.error('[ERR] routines seed:', e.message); }

  console.log('--- Seeding complete! ---');
  process.exit(0);
}

run();
