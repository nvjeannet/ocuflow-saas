const mysql = require('mysql2/promise');
require('dotenv').config();

async function diagnose() {
  console.log('--- Diagnostic Base de Données ---');
  console.log('Config:', {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT
  });

  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'ocuflow_db',
      port: process.env.DB_PORT || 3306
    });

    console.log('✅ Connexion réussie !');

    const [tables] = await connection.execute('SHOW TABLES');
    console.log('Tables trouvées:', tables.map(t => Object.values(t)[0]));

    const [desc] = await connection.execute('DESCRIBE users');
    console.log('Structure table users:', desc.map(c => c.Field));

    await connection.end();
  } catch (err) {
    console.error('❌ Erreur de diagnostic :', err.message);
  }
}

diagnose();
