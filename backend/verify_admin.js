const db = require('./db');

async function verify() {
  console.log('--- Admin HQ Verification ---');
  
  // Check admin users
  const {rows: users} = await db.query("SELECT id, email, role FROM users WHERE role='admin' LIMIT 3");
  console.log('Admin users:', users);
  
  // Check data counts
  const {rows: m} = await db.query('SELECT COUNT(*) as c FROM movements');
  console.log('Movements count:', m[0].c);
  
  const {rows: t} = await db.query('SELECT COUNT(*) as c FROM tips');
  console.log('Tips count:', t[0].c);
  
  const {rows: r} = await db.query('SELECT COUNT(*) as c FROM global_routines');
  console.log('Routines count:', r[0].c);
  
  // Check sessions schema
  const {rows: cols} = await db.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='sessions' AND COLUMN_NAME='routine_id'");
  console.log('routine_id column exists:', cols.length > 0);
  
  // Sample data
  const {rows: sample} = await db.query('SELECT id, name, category FROM movements LIMIT 5');
  console.log('Sample movements:', sample);

  process.exit(0);
}

verify();
