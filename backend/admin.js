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
    // On extrait les exercices les plus pratiqués (MySQL 8.0+ JSON_TABLE)
    const popularExs = await db.query(
      'SELECT ex_id, count(*) as usage FROM sessions, JSON_TABLE(exercises, "$[*]" COLUMNS (ex_id INT PATH "$")) as jt GROUP BY ex_id ORDER BY usage DESC LIMIT 5'
    );
    res.json({ sessionsByDay: sessionsByDay.rows, popularExs: popularExs.rows });
  } catch (err) { res.status(500).json({ error: 'Erreur analytics.' }); }
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

router.put('/routines/:id', auth, isAdmin, async (req, res) => {
  const { name, description, exs, dur } = req.body;
  try {
    await db.query(
      'UPDATE global_routines SET name=?, description=?, exs=?, dur=? WHERE id=?',
      [name, description, JSON.stringify(exs), dur, req.params.id]
    );
    await logAction(req.user.id, 'MODIFY_ROUTINE', req.params.id, { name });
    res.json({ message: 'Routine mise à jour.' });
  } catch (err) { res.status(500).json({ error: 'Erreur mise à jour routine.' }); }
});

// CHANGER LE STATUT PREMIUM D'UN UTILISATEUR (Mis à jour avec log)
router.put('/users/:id/premium', auth, isAdmin, async (req, res) => {
  const { is_premium } = req.body;
  try {
    await db.query('UPDATE users SET is_premium = ? WHERE id = ?', [is_premium, req.params.id]);
    await logAction(req.user.id, 'UPDATE_USER_PREMIUM', req.params.id, { is_premium });
    res.json({ message: 'Statut Premium mis à jour.' });
  } catch (err) { res.status(500).json({ error: 'Erreur lors de la mise à jour du statut.' }); }
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

// 💰 GESTION DES TARIFS
router.get('/pricing', auth, isAdmin, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM pricing_rules ORDER BY country_code ASC');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Erreur tarifs.' }); }
});

router.put('/pricing/:id', auth, isAdmin, async (req, res) => {
  const { price, vat_rate } = req.body;
  try {
    await db.query('UPDATE pricing_rules SET price = ?, vat_rate = ? WHERE id = ?', [price, vat_rate, req.params.id]);
    await logAction(req.user.id, 'MODIFY_PRICING', req.params.id, { price, vat_rate });
    res.json({ message: 'Tarif mis à jour.' });
  } catch (err) { res.status(500).json({ error: 'Erreur mise à jour tarif.' }); }
});

module.exports = router;
