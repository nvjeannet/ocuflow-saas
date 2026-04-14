const db = require('./db');

async function migrate() {
  console.log('--- Admin HQ Phase 2 Migration ---');

  // 1. Add updated_at to tips
  try {
    await db.query('ALTER TABLE tips ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');
    console.log('[OK] Added updated_at to tips.');
  } catch (e) {
    if (e.code === 'ER_DUP_FIELDNAME') console.log('[SKIP] updated_at already exists in tips.');
    else console.error('[ERR] tips updated_at:', e.message);
  }

  // 2. Create AI Config table
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS ai_config (
        id INT AUTO_INCREMENT PRIMARY KEY,
        param_key VARCHAR(100) UNIQUE NOT NULL,
        param_value JSON NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    console.log('[OK] Created ai_config table.');

    // Seed default config if empty
    const existing = await db.query('SELECT COUNT(*) as count FROM ai_config');
    if (existing.rows[0].count === 0) {
      const defaults = [
        { 
          key: 'thresholds', 
          value: { excellent: 80, fatigue: 50 } 
        },
        { 
          key: 'recommendations', 
          value: {
            excellent: ["Votre discipline porte ses fruits. Continuez ainsi !", "Essayez une routine de 'Musculation Oculaire'."],
            fatigue: ["Augmentez la fréquence de vos pauses 20-20-20.", "Une séance de palmage ce soir aiderait."],
            alert: ["Repos immédiat conseillé : éloignez-vous des écrans.", "Pratiquez la routine 'Relaxation Profonde'."]
          } 
        }
      ];
      for (const d of defaults) {
        await db.query('INSERT INTO ai_config (param_key, param_value) VALUES (?, ?)', [d.key, JSON.stringify(d.value)]);
      }
      console.log('[OK] Seeded default AI configuration.');
    }

  } catch (e) {
    console.error('[ERR] ai_config:', e.message);
  }

  console.log('--- Migration complete! ---');
  process.exit(0);
}

migrate();
