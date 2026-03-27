const db = require('./db');

async function migrate() {
  console.log('Migrating: Creating eye_tests table...');
  try {
    const sql = `
      CREATE TABLE IF NOT EXISTS eye_tests (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        test_type VARCHAR(50) DEFAULT 'contrast',
        score INT NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB;
    `;
    await db.query(sql);
    console.log('Migration successful: eye_tests table created.');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrate();
