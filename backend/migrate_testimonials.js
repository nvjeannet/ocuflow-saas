const db = require('./db');

async function migrate() {
  console.log('--- Testimonials Migration ---');
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS testimonials (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        email VARCHAR(255),
        content TEXT NOT NULL,
        status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    console.log('[OK] Created testimonials table.');
  } catch (e) {
    console.error('[ERR] testimonials table:', e.message);
  }
  process.exit(0);
}

migrate();
