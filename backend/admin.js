const express = require('express');
const db = require('./db');
const auth = require('./middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();

// Configuration Multer pour les logos
const uploadDir = path.join(__dirname, '..', 'uploads', 'logos');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, `logo-${Date.now()}${path.extname(file.originalname)}`)
});
const upload = multer({ storage });

console.log("[Admin] Initializing Admin Routes...");

// Middleware de sécurité Admin
const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ error: 'Accès refusé. Droits administrateur requis.' });
  }
};

// LISTER TOUS LES UTILISATEURS (AVEC FILTRES)
router.get('/users', auth, isAdmin, async (req, res) => {
  const { plan, country, parent_id, search } = req.query;
  let query = 'SELECT id, email, is_premium, role, country_code, parent_id, created_at, last_login FROM users WHERE 1=1';
  const params = [];

  if (plan) {
    if (plan === 'pro') { query += ' AND role = "pro"'; }
    else if (plan === 'premium') { query += ' AND is_premium = 1 AND role != "pro"'; }
    else { query += ' AND is_premium = 0'; }
  }
  if (country) { query += ' AND country_code = ?'; params.push(country); }
  if (parent_id) { query += ' AND parent_id = ?'; params.push(parent_id); }
  if (search) { query += ' AND email LIKE ?'; params.push(`%${search}%`); }

  query += ' ORDER BY created_at DESC LIMIT 100';

  try {
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la récupération des utilisateurs.' });
  }
});

// LISTER LES PAYS DISPONIBLES (POUR DROPDOWNS)
router.get('/countries', auth, isAdmin, async (req, res) => {
  try {
    const result = await db.query('SELECT DISTINCT country_code FROM pricing_rules ORDER BY country_code ASC');
    res.json(result.rows.map(r => r.country_code));
  } catch (err) { res.status(500).json({ error: 'Erreur pays.' }); }
});

// ENVOYER UN EMAIL À UN UTILISATEUR
router.post('/users/:id/email', auth, isAdmin, async (req, res) => {
  const { subject, message } = req.body;
  const { sendEmail } = require('./utils/email'); // Ensure utility exists or use nodemailer directly
  try {
    const userRes = await db.query('SELECT email FROM users WHERE id = ?', [req.params.id]);
    if (userRes.rows.length === 0) return res.status(404).json({ error: 'Utilisateur non trouvé.' });
    
    // Envoi de l'email réel
    await sendEmail(userRes.rows[0].email, subject, message); 
    
    await logAction(req.user.id, 'SEND_EMAIL_USER', req.params.id, { subject });
    res.json({ message: 'Email envoyé avec succès.' });
  } catch (err) { res.status(500).json({ error: 'Erreur envoi email.' }); }
});

// Aide pour logger une action
async function logAction(adminId, action, targetId, details) {
  try {
    await db.query(
      'INSERT INTO admin_logs (admin_id, action, target_id, details) VALUES (?, ?, ?, ?)',
      [adminId, action, targetId, JSON.stringify(details)]
    );
  } catch(err) { console.error('Erreur audit log:', err); }
}

// 📈 ANALYTICS : Croissance et Exercices Populaires
router.get('/analytics', auth, isAdmin, async (req, res) => {
  try {
    // 1. Sessions par jour
    let sessionsByDay = { rows: [] };
    try {
      sessionsByDay = await db.query(
        'SELECT DATE(timestamp) as day, count(*) as count FROM sessions GROUP BY day ORDER BY day DESC LIMIT 14'
      );
    } catch (e) { console.error('[Analytics] sessionsByDay failed:', e.message); }

    // 2. Top Exercices
    let allExs = { rows: [] };
    try {
      allExs = await db.query('SELECT exercises FROM sessions ORDER BY timestamp DESC LIMIT 200');
    } catch (e) { console.error('[Analytics] allExs failed:', e.message); }
    
    const exCount = {};
    allExs.rows.forEach(r => {
      try {
        let exs = r.exercises;
        if (typeof exs === 'string' && exs.trim()) {
          exs = JSON.parse(exs);
        }
        if (Array.isArray(exs)) {
          exs.forEach(id => {
            if (id !== null && id !== undefined) exCount[id] = (exCount[id] || 0) + 1;
          });
        }
      } catch (parseErr) {
        console.warn('[Analytics] Fail to parse exercises for row:', r.id, parseErr.message);
      }
    });
    const popularExs = Object.entries(exCount)
      .map(([id, usage]) => ({ ex_id: parseInt(id), usage }))
      .sort((a,b) => b.usage - a.usage)
      .slice(0, 5);

    // 3. Revenu par jour
    let revenueByDay = { rows: [] };
    try {
      revenueByDay = await db.query(
        'SELECT DATE(start_date) as day, SUM(amount) as total FROM subscriptions WHERE status = "active" GROUP BY day ORDER BY day DESC LIMIT 14'
      );
    } catch (e) { console.error('[Analytics] revenueByDay failed:', e.message); }

    // 4. Top Routines
    let popularRoutines = { rows: [] };
    try {
      popularRoutines = await db.query(`
        SELECT r.name, COUNT(*) as \`usage\` 
        FROM sessions s 
        JOIN global_routines r ON s.routine_id = r.id 
        GROUP BY r.name 
        ORDER BY \`usage\` DESC 
        LIMIT 5
      `);
    } catch (e) { console.error('[Analytics] popularRoutines failed:', e.message); }

    res.json({ 
      sessionsByDay: sessionsByDay.rows || [],
      popularExs: popularExs || [],
      revenueByDay: revenueByDay.rows || [],
      popularRoutines: popularRoutines.rows || []
    });
  } catch (err) { 
    console.error('[Admin Analytics Error Details]:', {
      message: err.message,
      stack: err.stack,
      sql: err.sql
    }); 
    res.status(500).json({ error: 'Erreur analytics.', details: err.message }); 
  }
});

// 📊 GLOBAL STATS : Résumé pour le dashboard
router.get('/stats', auth, isAdmin, async (req, res) => {
  try {
    const usersCount = await db.query('SELECT COUNT(*) as count FROM users');
    const premiumCount = await db.query('SELECT COUNT(*) as count FROM users WHERE is_premium = 1 AND role != "pro"');
    const proCount = await db.query('SELECT COUNT(*) as count FROM users WHERE role = "pro"');
    
    // Revenu total et ARR (Revenu Mensuel x 12)
    const totalRev = await db.query('SELECT SUM(amount) as total FROM subscriptions WHERE status = "active"');
    const revLastMonth = await db.query('SELECT SUM(amount) as total FROM subscriptions WHERE start_date > DATE_SUB(NOW(), INTERVAL 30 DAY) AND status = "active"');
    
    const arr = (revLastMonth.rows[0].total || 0) * 12;

    const dauRes = await db.query('SELECT COUNT(DISTINCT user_id) as dau FROM sessions WHERE DATE(timestamp) = CURDATE()');
    const healthRes = await db.query('SELECT AVG(score) as avg_score FROM eye_tests');

    res.json({
      totalUsers: usersCount.rows[0].count,
      premiumUsers: premiumCount.rows[0].count,
      proUsers: proCount.rows[0].count,
      totalRevenue: totalRev.rows[0].total || 0,
      arr: arr,
      sessionsToday: (await db.query('SELECT COUNT(*) as count FROM sessions WHERE DATE(timestamp) = CURDATE()')).rows[0].count,
      dau: dauRes.rows[0].dau,
      avgHealth: Math.round(healthRes.rows[0].avg_score || 0)
    });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erreur stats.' }); }
});

// 🧾 TRANSACTIONS : Liste des derniers abonnements
router.get('/transactions', auth, isAdmin, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT s.*, u.email 
      FROM subscriptions s 
      JOIN users u ON s.user_id = u.id 
      ORDER BY s.start_date DESC 
      LIMIT 50
    `);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Erreur transactions.' }); }
});

// 🛡️ SÉCURITÉ & AUDIT : Liste des logs
router.get('/logs', auth, isAdmin, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT l.*, u.email as admin_email FROM admin_logs l JOIN users u ON l.admin_id = u.id ORDER BY l.timestamp DESC LIMIT 50'
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Erreur logs.' }); }
});



// CHANGER LE PLAN D'UN UTILISATEUR
router.put('/users/:id/plan', auth, isAdmin, async (req, res) => {
  const { plan_type } = req.body; // 'free', 'premium', 'pro'
  const is_premium = (plan_type !== 'free' ? 1 : 0);
  try {
    await db.query('UPDATE users SET is_premium = ?, role = ? WHERE id = ?', [is_premium, plan_type === 'pro' ? 'pro' : 'user', req.params.id]);
    await logAction(req.user.id, 'UPDATE_USER_PLAN', req.params.id, { plan_type });
    res.json({ message: 'Plan mis à jour.' });
  } catch (err) { res.status(500).json({ error: 'Erreur mise à jour plan.' }); }
});

// 🤝 GESTION DES PARTENAIRES
router.get('/partners', auth, isAdmin, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM partners ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Erreur partenaires.' }); }
});

// 🤝 GESTION DES PARTENAIRES (AVEC UPLOAD LOGO)
router.post('/partners', auth, isAdmin, upload.single('logo'), async (req, res) => {
  const { name, manager, city, phone, address, email, website, country_code } = req.body;
  const logo_url = req.file ? `/backend/uploads/logos/${req.file.filename}` : req.body.logo_url;
  
  try {
    const result = await db.query(
      'INSERT INTO partners (name, manager, city, phone, address, email, website, logo_url, country_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [name, manager, city, phone, address, email, website, logo_url, country_code]
    );
    await logAction(req.user.id, 'CREATE_PARTNER', result.insertId, { name });
    res.status(201).json({ message: 'Partenaire ajouté.', logo_url });
  } catch (err) { res.status(500).json({ error: 'Erreur ajout partenaire.' }); }
});

router.put('/partners/:id', auth, isAdmin, upload.single('logo'), async (req, res) => {
  const { name, manager, city, phone, address, email, website, country_code } = req.body;
  let logo_url = req.body.logo_url;
  if (req.file) {
    logo_url = `/backend/uploads/logos/${req.file.filename}`;
  }

  try {
    await db.query(
      'UPDATE partners SET name=?, manager=?, city=?, phone=?, address=?, email=?, website=?, logo_url=?, country_code=? WHERE id=?',
      [name, manager, city, phone, address, email, website, logo_url, country_code, req.params.id]
    );
    await logAction(req.user.id, 'UPDATE_PARTNER', req.params.id, { name });
    res.json({ message: 'Partenaire mis à jour.', logo_url });
  } catch (err) { res.status(500).json({ error: 'Erreur mise à jour partenaire.' }); }
});

router.delete('/partners/:id', auth, isAdmin, async (req, res) => {
  try {
    await db.query('DELETE FROM partners WHERE id = ?', [req.params.id]);
    await logAction(req.user.id, 'DELETE_PARTNER', req.params.id, {});
    res.json({ message: 'Partenaire supprimé.' });
  } catch (err) { res.status(500).json({ error: 'Erreur suppression partenaire.' }); }
});

// ⭐ MODÉRATION DES AVIS
router.get('/testimonials', auth, isAdmin, async (req, res) => {
  try {
    const result = await db.query('SELECT t.*, u.email FROM testimonials t LEFT JOIN users u ON t.user_id = u.id ORDER BY t.created_at DESC');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Erreur avis.' }); }
});

router.put('/testimonials/:id/status', auth, isAdmin, async (req, res) => {
  const { status } = req.body; // 'approved', 'rejected'
  try {
    await db.query('UPDATE testimonials SET status = ? WHERE id = ?', [status, req.params.id]);
    await logAction(req.user.id, 'MODERATE_TESTIMONIAL', req.params.id, { status });
    res.json({ message: 'Avis modéré.' });
  } catch (err) { res.status(500).json({ error: 'Erreur modération avis.' }); }
});

router.delete('/testimonials/:id', auth, isAdmin, async (req, res) => {
  try {
    await db.query('DELETE FROM testimonials WHERE id = ?', [req.params.id]);
    await logAction(req.user.id, 'DELETE_TESTIMONIAL', req.params.id, {});
    res.json({ message: 'Avis supprimé.' });
  } catch (err) { res.status(500).json({ error: 'Erreur suppression avis.' }); }
});

// 💰 GESTION DES TARIFS
router.get('/pricing', auth, isAdmin, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM pricing_rules ORDER BY country_code ASC');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Erreur tarifs.' }); }
});

router.put('/pricing/:id', auth, isAdmin, async (req, res) => {
  const { price, vat_rate, plan_type, currency } = req.body;
  try {
    await db.query('UPDATE pricing_rules SET price = ?, vat_rate = ?, plan_type = ?, currency = ? WHERE id = ?', [price, vat_rate, plan_type, currency, req.params.id]);
    await logAction(req.user.id, 'MODIFY_PRICING', req.params.id, { price, vat_rate });
    res.json({ message: 'Tarif mis à jour.' });
  } catch (err) { res.status(500).json({ error: 'Erreur mise à jour tarif.' }); }
});

router.post('/pricing', auth, isAdmin, async (req, res) => {
  const { country_code, plan_type, price, currency, vat_rate } = req.body;
  try {
    const result = await db.query(
      'INSERT INTO pricing_rules (country_code, plan_type, price, currency, vat_rate) VALUES (?, ?, ?, ?, ?)',
      [country_code, plan_type, price, currency, vat_rate]
    );
    await logAction(req.user.id, 'CREATE_PRICING', result.insertId, { country_code, plan_type });
    res.status(201).json({ message: 'Tarif ajouté.' });
  } catch (err) { res.status(500).json({ error: 'Erreur ajout tarif.' }); }
});

router.delete('/pricing/:id', auth, isAdmin, async (req, res) => {
  try {
    await db.query('DELETE FROM pricing_rules WHERE id = ?', [req.params.id]);
    await logAction(req.user.id, 'DELETE_PRICING', req.params.id, {});
    res.json({ message: 'Tarif supprimé.' });
  } catch (err) { res.status(500).json({ error: 'Erreur suppression tarif.' }); }
});

// 🏋️ CMS : Gestion de la Bibliothèque de Mouvements
router.get('/movements', auth, isAdmin, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM movements ORDER BY id ASC');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Erreur CMS mouvements.' }); }
});

router.post('/movements', auth, isAdmin, async (req, res) => {
  const { name, icon, slug, description, category, default_duration } = req.body;
  try {
    const result = await db.query(
      'INSERT INTO movements (name, icon, slug, description, category, default_duration) VALUES (?, ?, ?, ?, ?, ?)',
      [name, icon, slug, description, category, default_duration || 30]
    );
    await logAction(req.user.id, 'CREATE_MOVEMENT', result.insertId, { name });
    res.status(201).json({ message: 'Mouvement ajouté.' });
  } catch (err) { res.status(500).json({ error: 'Erreur ajout mouvement.' }); }
});

router.put('/movements/:id', auth, isAdmin, async (req, res) => {
  const { name, icon, slug, description, category, default_duration } = req.body;
  try {
    await db.query(
      'UPDATE movements SET name=?, icon=?, slug=?, description=?, category=?, default_duration=? WHERE id=?',
      [name, icon, slug, description, category, default_duration || 30, req.params.id]
    );
    await logAction(req.user.id, 'UPDATE_MOVEMENT', req.params.id, { name });
    res.json({ message: 'Mouvement mis à jour.' });
  } catch (err) { res.status(500).json({ error: 'Erreur mise à jour mouvement.' }); }
});

// 💡 CMS : Gestion des Tips
router.get('/tips', auth, isAdmin, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM tips ORDER BY id DESC');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Erreur tips.' }); }
});

router.post('/tips', auth, isAdmin, async (req, res) => {
  const { content, category } = req.body;
  try {
    const result = await db.query('INSERT INTO tips (content, category) VALUES (?, ?)', [content, category]);
    await logAction(req.user.id, 'CREATE_TIP', result.insertId, { content });
    res.status(201).json({ message: 'Conseil ajouté.' });
  } catch (err) { res.status(500).json({ error: 'Erreur ajout tip.' }); }
});

router.put('/tips/:id', auth, isAdmin, async (req, res) => {
  const { content, category } = req.body;
  try {
    await db.query('UPDATE tips SET content=?, category=? WHERE id=?', [content, category, req.params.id]);
    await logAction(req.user.id, 'UPDATE_TIP', req.params.id, { content });
    res.json({ message: 'Conseil mis à jour.' });
  } catch (err) { res.status(500).json({ error: 'Erreur mise à jour tip.' }); }
});

// ⭐ RÉPONDRE AUX AVIS
router.put('/testimonials/:id/reply', auth, isAdmin, async (req, res) => {
  const { reply_text } = req.body;
  try {
    await db.query('UPDATE testimonials SET reply_text = ?, replied_at = NOW() WHERE id = ?', [reply_text, req.params.id]);
    await logAction(req.user.id, 'REPLY_TESTIMONIAL', req.params.id, { reply_text });
    res.json({ message: 'Réponse envoyée.' });
  } catch (err) { res.status(500).json({ error: 'Erreur réponse avis.' }); }
});

router.delete('/movements/:id', auth, isAdmin, async (req, res) => {
  try {
    await db.query('DELETE FROM movements WHERE id = ?', [req.params.id]);
    await logAction(req.user.id, 'DELETE_MOVEMENT', req.params.id, {});
    res.json({ message: 'Mouvement supprimé.' });
  } catch (err) { res.status(500).json({ error: 'Erreur suppression mouvement.' }); }
});

router.delete('/tips/:id', auth, isAdmin, async (req, res) => {
  try {
    await db.query('DELETE FROM tips WHERE id = ?', [req.params.id]);
    await logAction(req.user.id, 'DELETE_TIP', req.params.id, {});
    res.json({ message: 'Conseil supprimé.' });
  } catch (err) { res.status(500).json({ error: 'Erreur suppression tip.' }); }
});

// 🌀 CMS : Gestion des Routines Globales
router.get('/routines', auth, isAdmin, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM global_routines ORDER BY id ASC');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Erreur CMS routines.' }); }
});

router.post('/routines', auth, isAdmin, async (req, res) => {
  const { name, description, exs, dur, is_active } = req.body;
  const slug = name.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '');
  try {
    const result = await db.query(
      'INSERT INTO global_routines (slug, name, description, exs, dur, is_active) VALUES (?, ?, ?, ?, ?, ?)',
      [slug, name, description, exs, dur, is_active || 1]
    );
    await logAction(req.user.id, 'CREATE_ROUTINE', result.insertId, { name });
    res.status(201).json({ message: 'Routine ajoutée.' });
  } catch (err) { res.status(500).json({ error: 'Erreur ajout routine.' }); }
});

router.put('/routines/:id', auth, isAdmin, async (req, res) => {
  const { name, description, exs, dur, is_active } = req.body;
  try {
    await db.query(
      'UPDATE global_routines SET name=?, description=?, exs=?, dur=?, is_active=? WHERE id=?',
      [name, description, exs, dur, is_active, req.params.id]
    );
    await logAction(req.user.id, 'UPDATE_ROUTINE', req.params.id, { name });
    res.json({ message: 'Routine mise à jour.' });
  } catch (err) { res.status(500).json({ error: 'Erreur mise à jour routine.' }); }
});

router.delete('/routines/:id', auth, isAdmin, async (req, res) => {
  try {
    await db.query('DELETE FROM global_routines WHERE id = ?', [req.params.id]);
    await logAction(req.user.id, 'DELETE_ROUTINE', req.params.id, {});
    res.json({ message: 'Routine supprimée.' });
  } catch (err) { res.status(500).json({ error: 'Erreur suppression routine.' }); }
});

// 🧪 CONFIG IA
router.get('/ai-config', auth, isAdmin, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM ai_config');
    const config = {};
    result.rows.forEach(r => {
      config[r.param_key] = typeof r.param_value === 'string' ? JSON.parse(r.param_value) : r.param_value;
    });
    res.json(config);
  } catch (err) { res.status(500).json({ error: 'Erreur config IA.' }); }
});

router.put('/ai-config/:key', auth, isAdmin, async (req, res) => {
  const { value } = req.body;
  try {
    const valStr = JSON.stringify(value);
    await db.query('UPDATE ai_config SET param_value = ? WHERE param_key = ?', [valStr, req.params.key]);
    await logAction(req.user.id, 'UPDATE_AI_CONFIG', null, { key: req.params.key });
    res.json({ message: 'Configuration IA mise à jour.' });
  } catch (err) { res.status(500).json({ error: 'Erreur mise à jour config IA.' }); }
});

module.exports = router;
