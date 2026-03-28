const express = require('express');
const db = require('./db');
const auth = require('./middleware/auth');
const router = express.Router();

// Middleware de sécurité Admin
const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ error: 'Accès refusé. Droits administrateur requis.' });
  }
};

// LISTER TOUS LES UTILISATEURS
router.get('/users', auth, isAdmin, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, email, is_premium, role, created_at FROM users ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la récupération des utilisateurs.' });
  }
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
    const sessionsByDay = await db.query(
      'SELECT DATE(timestamp) as day, count(*) as count FROM sessions GROUP BY day ORDER BY day DESC LIMIT 14'
    );
    // On extrait les exercices les plus pratiqués
    const popularExs = await db.query(
      'SELECT ex_id, count(*) as usage FROM sessions, JSON_TABLE(exercises, "$[*]" COLUMNS (ex_id INT PATH "$")) as jt GROUP BY ex_id ORDER BY usage DESC LIMIT 5'
    );
    // Revenu par jour (basé sur subscriptions)
    const revenueByDay = await db.query(
      'SELECT DATE(start_date) as day, SUM(price) as total FROM subscriptions WHERE status = "active" GROUP BY day ORDER BY day DESC LIMIT 14'
    );
    
    res.json({ 
      sessionsByDay: sessionsByDay.rows, 
      popularExs: popularExs.rows,
      revenueByDay: revenueByDay.rows
    });
  } catch (err) { res.status(500).json({ error: 'Erreur analytics.' }); }
});

// 📊 GLOBAL STATS : Résumé pour le dashboard
router.get('/stats', auth, isAdmin, async (req, res) => {
  try {
    const usersCount = await db.query('SELECT COUNT(*) as count FROM users');
    const premiumCount = await db.query('SELECT COUNT(*) as count FROM users WHERE is_premium = 1 AND role != "pro"');
    const proCount = await db.query('SELECT COUNT(*) as count FROM users WHERE role = "pro"');
    
    // Revenu total et ARR (Revenu Mensuel x 12)
    const totalRev = await db.query('SELECT SUM(price) as total FROM subscriptions WHERE status = "active"');
    const revLastMonth = await db.query('SELECT SUM(price) as total FROM subscriptions WHERE start_date > DATE_SUB(NOW(), INTERVAL 30 DAY) AND status = "active"');
    
    const arr = (revLastMonth.rows[0].total || 0) * 12;

    res.json({
      totalUsers: usersCount.rows[0].count,
      premiumUsers: premiumCount.rows[0].count,
      proUsers: proCount.rows[0].count,
      totalRevenue: totalRev.rows[0].total || 0,
      arr: arr,
      sessionsToday: (await db.query('SELECT COUNT(*) as count FROM sessions WHERE DATE(timestamp) = CURDATE()')).rows[0].count
    });
  } catch (err) { res.status(500).json({ error: 'Erreur stats.' }); }
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

// ⚙️ CMS : Gérer les Routines Globales
router.get('/routines', auth, isAdmin, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM global_routines ORDER BY id ASC');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Erreur CMS.' }); }
});

router.post('/routines', auth, isAdmin, async (req, res) => {
  const { name, description, exs, dur, is_active } = req.body;
  const slug = name.toLowerCase().replace(/ /g, '-').replace(/[^\w-]/g, '');
  try {
    const result = await db.query(
      'INSERT INTO global_routines (slug, name, description, exs, dur, is_active) VALUES (?, ?, ?, ?, ?, ?)',
      [slug, name, description, JSON.stringify(exs), dur, is_active]
    );
    await logAction(req.user.id, 'CREATE_ROUTINE', result.insertId, { name });
    res.status(201).json({ message: 'Routine créée.' });
  } catch (err) { 
    console.error(err);
    res.status(500).json({ error: 'Erreur création routine.' }); 
  }
});

router.put('/routines/:id', auth, isAdmin, async (req, res) => {
  const { name, description, exs, dur, is_active } = req.body;
  try {
    await db.query(
      'UPDATE global_routines SET name=?, description=?, exs=?, dur=?, is_active=? WHERE id=?',
      [name, description, JSON.stringify(exs), dur, is_active, req.params.id]
    );
    await logAction(req.user.id, 'MODIFY_ROUTINE', req.params.id, { name });
    res.json({ message: 'Routine mise à jour.' });
  } catch (err) { res.status(500).json({ error: 'Erreur mise à jour routine.' }); }
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

router.post('/partners', auth, isAdmin, async (req, res) => {
  const { name, manager, city, phone, address, email, website, logo_url, country_code } = req.body;
  try {
    const result = await db.query(
      'INSERT INTO partners (name, manager, city, phone, address, email, website, logo_url, country_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [name, manager, city, phone, address, email, website, logo_url, country_code]
    );
    await logAction(req.user.id, 'CREATE_PARTNER', result.insertId, { name });
    res.status(201).json({ message: 'Partenaire ajouté.' });
  } catch (err) { res.status(500).json({ error: 'Erreur ajout partenaire.' }); }
});

router.put('/partners/:id', auth, isAdmin, async (req, res) => {
  const { name, manager, city, phone, address, email, website, logo_url, country_code } = req.body;
  try {
    await db.query(
      'UPDATE partners SET name=?, manager=?, city=?, phone=?, address=?, email=?, website=?, logo_url=?, country_code=? WHERE id=?',
      [name, manager, city, phone, address, email, website, logo_url, country_code, req.params.id]
    );
    await logAction(req.user.id, 'UPDATE_PARTNER', req.params.id, { name });
    res.json({ message: 'Partenaire mis à jour.' });
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
  const { name, icon, slug, description, category } = req.body;
  try {
    const result = await db.query(
      'INSERT INTO movements (name, icon, slug, description, category) VALUES (?, ?, ?, ?, ?)',
      [name, icon, slug, description, category]
    );
    await logAction(req.user.id, 'CREATE_MOVEMENT', result.insertId, { name });
    res.status(201).json({ message: 'Mouvement ajouté.' });
  } catch (err) { res.status(500).json({ error: 'Erreur ajout mouvement.' }); }
});

router.put('/movements/:id', auth, isAdmin, async (req, res) => {
  const { name, icon, slug, description, category } = req.body;
  try {
    await db.query(
      'UPDATE movements SET name=?, icon=?, slug=?, description=?, category=? WHERE id=?',
      [name, icon, slug, description, category, req.params.id]
    );
    await logAction(req.user.id, 'MODIFY_MOVEMENT', req.params.id, { name });
    res.json({ message: 'Mouvement mis à jour.' });
  } catch (err) { res.status(500).json({ error: 'Erreur modification mouvement.' }); }
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
    res.status(201).json({ message: 'Tip ajouté.' });
  } catch (err) { res.status(500).json({ error: 'Erreur ajout tip.' }); }
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

module.exports = router;
