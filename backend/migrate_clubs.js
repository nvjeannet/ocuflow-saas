const db = require('./db');

async function migrate() {
  try {
    console.log('Adding settings column to clubs table...');
    await db.query('ALTER TABLE clubs ADD COLUMN settings JSON NULL AFTER logo_url');
    console.log('✅ Column added successfully.');
    process.exit(0);
  } catch (err) {
    if (err.code === 'ER_DUP_COLUMN_NAME') {
      console.log('⚠️ Column already exists.');
      process.exit(0);
    }
    console.error('❌ Error during migration:', err);
    process.exit(1);
  }
}

migrate();
