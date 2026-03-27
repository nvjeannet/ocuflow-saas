const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db');
const auth = require('./middleware/auth');
const router = express.Router();

const { sendEmail } = require('./utils/email');

const SECRET_KEY = process.env.JWT_SECRET || 'votre_cle_secrete_super_sure';

// INSCRIPTION
router.post('/register', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email et mot de passe requis.' });
  }

  try {
    const userExists = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (userExists.rows.length > 0) {
      return res.status(400).json({ error: 'Cet email est déjà utilisé.' });
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const country = req.country || 'GA';
    const insertResult = await db.query(
      'INSERT INTO users (email, password_hash, country_code) VALUES (?, ?, ?)',
      [email, passwordHash, country]
    );

    // ENVOYER EMAIL DE BIENVENUE
    await sendEmail(email, 'Bienvenue sur OcuFlow ! 👁️', `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:40px;border:1px solid #eee;border-radius:20px;">
        <h1 style="color:#0ea5e9;">Bienvenue dans le futur de la santé visuelle !</h1>
        <p>Merci de rejoindre OcuFlow. Préparez-vous à dire adieu à la fatigue oculaire.</p>
        <a href="https://ocuflow.com" style="display:inline-block;background:#0ea5e9;color:white;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:bold;margin-top:20px;">Commencer mes exercices</a>
      </div>
    `);

    res.status(201).json({ 
      message: 'Compte créé avec succès ! Connectez-vous maintenant.', 
      user: { id: insertResult.rows.insertId, email, is_premium: false, plan_type: 'free' } 
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de l\'inscription.' });
  }
});

// AJOUTER UN MEMBRE DE L'ÉQUIPE (PRO UNIQUEMENT)
router.post('/team/add', auth, async (req, res) => {
  const { email, password } = req.body;
  const masterId = req.user?.id; // Authenitfied via middleware later?

  // Mocking auth middleware check for now or assuming it's part of the master's request
  if (!masterId) return res.status(401).json({ error: 'Non autorisé.' });

  try {
    const master = await db.query('SELECT plan_type FROM users WHERE id = ?', [masterId]);
    if (master.rows[0].plan_type !== 'pro') {
      return res.status(403).json({ error: 'Réservé aux comptes PRO.' });
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const insertResult = await db.query(
      'INSERT INTO users (email, password_hash, parent_id, is_premium, plan_type) VALUES (?, ?, ?, ?, ?)',
      [email, passwordHash, masterId, true, 'pro']
    );

    res.status(201).json({ message: 'Membre ajouté avec succès !' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de l\'ajout du membre.' });
  }
});

// LISTER LES MEMBRES DE L'ÉQUIPE
router.get('/team/members', auth, async (req, res) => {
  const masterId = req.user?.id;
  try {
    const result = await db.query(
      'SELECT id, email, xp, level, created_at, last_login FROM users WHERE parent_id = ?', 
      [masterId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la récupération des membres.' });
  }
});

// SOUMETTRE UN AVIS (UTILISATEUR CONNECTÉ)
router.post('/testimonials', auth, async (req, res) => {
  const { content } = req.body;
  try {
    await db.query('INSERT INTO testimonials (user_id, content, status) VALUES (?, ?, \'pending\')', [req.user.id, content]);
    res.status(201).json({ message: 'Merci ! Votre avis est en cours de modération.' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de l\'envoi de l\'avis.' });
  }
});

// MOT DE PASSE OUBLIÉ (ENVOI CODE)
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  try {
    const user = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (user.rows.length === 0) return res.json({ message: 'Si cet email existe, un code a été envoyé.' });

    const token = Math.floor(100000 + Math.random() * 900000).toString(); // Code à 6 chiffres
    await db.query('DELETE FROM password_resets WHERE email = ?', [email]);
    await db.query('INSERT INTO password_resets (email, token, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 1 HOUR))', [email, token]);

    await sendEmail(email, 'Code de réinitialisation OcuFlow 🔐', `
      <div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:32px;border:1px solid #ddd;border-radius:15px;">
        <h2>Réinitialisation de votre mot de passe</h2>
        <p>Utilisez le code suivant pour changer votre mot de passe (valide 1 heure) :</p>
        <div style="background:#f1f5f9;padding:20px;text-align:center;font-size:2rem;font-weight:800;letter-spacing:0.2em;color:#0ea5e9;border-radius:10px;">${token}</div>
      </div>
    `);
    res.json({ message: 'Code envoyé !' });
  } catch (err) { res.status(500).json({ error: 'Erreur.' }); }
});

// RÉINITIALISATION MOT DE PASSE
router.post('/reset-password', async (req, res) => {
  const { email, token, newPassword } = req.body;
  try {
    const result = await db.query('SELECT * FROM password_resets WHERE email = ? AND token = ? AND expires_at > NOW()', [email, token]);
    if (result.rows.length === 0) return res.status(400).json({ error: 'Code invalide ou expiré.' });

    const passHash = await bcrypt.hash(newPassword, 10);
    await db.query('UPDATE users SET password_hash = ? WHERE email = ?', [passHash, email]);
    await db.query('DELETE FROM password_resets WHERE email = ?', [email]);
    res.json({ message: 'Mot de passe modifié avec succès !' });
  } catch (err) { res.status(500).json({ error: 'Erreur reset.' }); }
});

// OBTENIR LES PARTENAIRES LOCAUX
router.get('/partners/local', async (req, res) => {
  const country = req.country || 'GA';
  try {
    const result = await db.query('SELECT name, city, logo_url, website FROM partners WHERE country_code = ? AND is_active = TRUE', [country]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Erreur partenaires.' });
  }
});

// OBTENIR LES AVIS APPROUVÉS
router.get('/testimonials/approved', async (req, res) => {
  try {
    const result = await db.query('SELECT users.email, testimonials.content FROM testimonials LEFT JOIN users ON testimonials.user_id = users.id WHERE status = \'approved\' ORDER BY testimonials.created_at DESC LIMIT 3');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Erreur avis.' });
  }
});

// OBTENIR LES TARIFS SELON LE PAYS DÉTECTÉ
router.get('/pricing', async (req, res) => {
  const country = req.country || 'GA';
  try {
    const result = await db.query('SELECT * FROM pricing_rules WHERE country_code = ?', [country]);
    // Si pas de prix spécifique pour ce pays, on renvoie les prix par défaut (FR)
    if (result.rows.length === 0) {
      const fallback = await db.query('SELECT * FROM pricing_rules WHERE country_code = \'GA\'');
      return res.json(fallback.rows);
    }
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la récupération des tarifs.' });
  }
});

// CONNEXION
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const country = req.country || 'GA';

  if (!email || !password) {
    return res.status(400).json({ error: 'Email et mot de passe requis.' });
  }

  try {
    const result = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Identifiants invalides.' });
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Identifiants invalides.' });
    }

    // Mettre à jour le pays et la dernière connexion
    await db.query('UPDATE users SET last_login = NOW(), role = IFNULL(role, \'user\') WHERE id = ?', [user.id]);
    
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, SECRET_KEY, { expiresIn: '24h' });
    
    res.json({ 
      token, 
      user: { 
        id: user.id, 
        email: user.email, 
        is_premium: user.is_premium,
        plan_type: user.plan_type || 'free',
        role: user.role || 'user',
        country: country
      } 
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la connexion.' });
  }
});

module.exports = router;
