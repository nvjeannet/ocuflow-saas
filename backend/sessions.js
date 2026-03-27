const express = require('express');
const db = require('./db');
const auth = require('./middleware/auth');
const router = express.Router();

// RÉCUPÉRER TOUTES LES SESSIONS DE L'UTILISATEUR
router.get('/', auth, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, duration, exercises, timestamp FROM sessions WHERE user_id = ? ORDER BY timestamp DESC',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la récupération des sessions.' });
  }
});

// ENREGISTRER UNE NOUVELLE SESSION
router.post('/', auth, async (req, res) => {
  const { duration, exercises } = req.body;

  if (!duration || !exercises) {
    return res.status(400).json({ error: 'Données de session incomplètes.' });
  }

  try {
    const { xp, level } = req.body;
    
    // Premier : Enregistrer la session
    const insertResult = await db.query(
      'INSERT INTO sessions (user_id, duration, exercises) VALUES (?, ?, ?)',
      [req.user.id, duration, JSON.stringify(exercises)]
    );

    // Second : Synchroniser XP/Level si fournis
    if (xp !== undefined && level !== undefined) {
      await db.query('UPDATE users SET xp = ?, level = ? WHERE id = ?', [xp, level, req.user.id]);
    }

    res.status(201).json({ id: insertResult.rows.insertId, duration, exercises, xp, level });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de l\'enregistrement de la session.' });
  }
});

module.exports = router;
