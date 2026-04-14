/**
 * migrate_team.js — Add team management columns and tables
 * Run: node backend/migrate_team.js
 */
const db = require('./db');

async function migrate() {
  console.log('--- Team Management Migration ---');

  // 1. Add first_name, last_name, department to users
  const cols = [
    { name: 'first_name', type: 'VARCHAR(100) NULL' },
    { name: 'last_name', type: 'VARCHAR(100) NULL' },
    { name: 'department', type: 'VARCHAR(100) NULL' }
  ];

  for (const col of cols) {
    try {
      await db.query(`ALTER TABLE users ADD COLUMN ${col.name} ${col.type}`);
      console.log(`[OK] Added ${col.name} to users.`);
    } catch (e) {
      if (e.code === 'ER_DUP_FIELDNAME') console.log(`[SKIP] ${col.name} already exists.`);
      else console.error(`[ERR] ${col.name}:`, e.message);
    }
  }

  // 2. Create team_settings table
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS team_settings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        manager_id INT NOT NULL UNIQUE,
        fixed_times JSON DEFAULT NULL,
        days JSON DEFAULT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (manager_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    console.log('[OK] Created team_settings table.');
  } catch (e) {
    console.log('[INFO] team_settings:', e.message);
  }

  console.log('--- Migration complete! ---');
  process.exit(0);
}

migrate();
