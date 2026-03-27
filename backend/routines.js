const express = require('express');
const db = require('./db');
const auth = require('./middleware/auth');
const router = express.Router();

// RÉCUPÉRER TOUTES LES ROUTINES DE L'UTILISATEUR
router.get('/', auth, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, name, icon, description, config FROM user_routines WHERE user_id = ? ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la récupération des routines.' });
  }
});

// CRÉER OU METTRE À JOUR UNE ROUTINE
router.post('/', auth, async (req, res) => {
  const { id, name, icon, description, config } = req.body;

  if (!name || !config) {
    return res.status(400).json({ error: 'Nom et configuration requis.' });
  }

  try {
    let result;
    // Si un ID numérique est fourni, on tente une mise à jour
    if (id && !isNaN(id)) {
      await db.query(
        'UPDATE user_routines SET name = ?, icon = ?, description = ?, config = ? WHERE id = ? AND user_id = ?',
        [name, icon || '🎯', description, JSON.stringify(config), id, req.user.id]
      );
      res.status(200).json({ id, name, icon, description, config });
    } else {
      // Sinon, on crée une nouvelle routine
      const insertResult = await db.query(
        'INSERT INTO user_routines (user_id, name, icon, description, config) VALUES (?, ?, ?, ?, ?)',
        [req.user.id, name, icon || '🎯', description, JSON.stringify(config)]
      );
      res.status(201).json({ id: insertResult.rows.insertId, name, icon, description, config });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de l\'enregistrement de la routine.' });
    }
    });

    // SUPPRIMER UNE ROUTINE
    router.delete('/:id', auth, async (req, res) => {
    const { id } = req.params;
    try {
    const result = await db.query(
      'DELETE FROM user_routines WHERE id = ? AND user_id = ?',
      [id, req.user.id]
    );
    if (result.rows.affectedRows === 0) {
      return res.status(404).json({ error: 'Routine non trouvée ou non autorisée.' });
    }
    res.json({ message: 'Routine supprimée avec succès.' });
    } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de l\'suppression de la routine.' });
    }
    });

module.exports = router;
