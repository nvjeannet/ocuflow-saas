/**
 * Script de Migration Unique — OcuFlow
 * 
 * Usage: node migrate.js
 * 
 * Exécute dans l'ordre :
 * 1. Le schéma principal (schema.sql)
 * 2. Les migrations incrémentales
 * 3. Les seeds (pricing, admin)
 */

const fs = require('fs');
const path = require('path');
const db = require('./db');

async function runSQL(filePath) {
  const label = path.basename(filePath);
  try {
    const sql = fs.readFileSync(filePath, 'utf8');
    // Split par ';' pour exécuter instruction par instruction
    const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 0 && !s.startsWith('--'));
    for (const stmt of statements) {
      try {
        await db.query(stmt);
      } catch (e) {
        // Ignorer les erreurs "already exists" / "duplicate"
        if (e.code === 'ER_TABLE_EXISTS_ERROR' || e.code === 'ER_DUP_ENTRY' || e.code === 'ER_DUP_KEYNAME') {
          // Silently skip
        } else {
          console.warn(`  ⚠️  [${label}] ${e.message}`);
        }
      }
    }
    console.log(`  ✅ ${label}`);
  } catch (e) {
    console.error(`  ❌ ${label}: ${e.message}`);
  }
}

async function runJS(filePath) {
  const label = path.basename(filePath);
  try {
    const mod = require(filePath);
    if (typeof mod === 'function') await mod();
    console.log(`  ✅ ${label}`);
  } catch (e) {
    console.warn(`  ⚠️  ${label}: ${e.message}`);
  }
}

async function migrate() {
  console.log('');
  console.log('══════════════════════════════════════════════════');
  console.log('  OcuFlow — Migration de la Base de Données');
  console.log('══════════════════════════════════════════════════');
  console.log('');

  // 1. Schéma principal
  console.log('📐 Schéma principal...');
  await runSQL(path.join(__dirname, 'schema.sql'));

  // 2. Migrations incrémentales (dans l'ordre)
  console.log('\n📦 Migrations...');
  const migrations = [
    'migrate_testimonials.js',
    'migrate_clubs.js',
    'migrate_team.js',
    'migrate_admin_v2.js',
    'migrate_tests.js',
  ];
  for (const file of migrations) {
    const filePath = path.join(__dirname, file);
    if (fs.existsSync(filePath)) {
      await runJS(filePath);
    }
  }

  // 3. Seeds
  console.log('\n🌱 Seeds...');
  const seeds = [
    'seed_admin.js',
    'seed_pricing_africa.js',
  ];
  for (const file of seeds) {
    const filePath = path.join(__dirname, file);
    if (fs.existsSync(filePath)) {
      await runJS(filePath);
    }
  }

  console.log('\n══════════════════════════════════════════════════');
  console.log('  ✅ Migration terminée !');
  console.log('══════════════════════════════════════════════════');
  console.log('');
  
  process.exit(0);
}

migrate().catch(err => {
  console.error('❌ Erreur fatale:', err);
  process.exit(1);
});
