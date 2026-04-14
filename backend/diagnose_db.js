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
    const tableList = tables.map(t => Object.values(t)[0]);
    console.log('Tables trouvées:', tableList);

    const expectedTables = [
      'users', 'pricing_rules', 'partners', 'clubs', 'subscriptions', 
      'sessions', 'user_routines', 'admin_logs', 'global_routines', 
      'eye_tests', 'testimonials', 'ai_config', 'team_settings', 
      'tips', 'movements', 'password_resets'
    ];

    expectedTables.forEach(table => {
      if (tableList.includes(table)) {
        console.log(`✅ Table '${table}' est présente.`);
      } else {
        console.warn(`❌ Table '${table}' MANQUANTE.`);
      }
    });

    const [desc] = await connection.execute('DESCRIBE users');
    const userCols = desc.map(c => c.Field);
    console.log('Colonnes table users:', userCols);
    
    ['first_name', 'last_name', 'department'].forEach(col => {
      if (userCols.includes(col)) {
        console.log(`✅ Colonne '${col}' présente dans users.`);
      } else {
        console.warn(`❌ Colonne '${col}' MANQUANTE dans users.`);
      }
    });

    await connection.end();
  } catch (err) {
    console.error('❌ Erreur de diagnostic :', err.message);
  }
}

diagnose();
