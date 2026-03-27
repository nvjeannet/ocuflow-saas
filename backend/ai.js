const express = require('express');
const db = require('./db');
const auth = require('./middleware/auth');
const router = express.Router();

/**
 * @route POST /api/ai/test
 * @desc Enregistrer un résultat de test de vision
 */
router.post('/test', auth, async (req, res) => {
  const { score, type } = req.body;
  if (score === undefined) return res.status(400).json({ error: 'Score manquant.' });

  try {
    await db.query(
      'INSERT INTO eye_tests (user_id, score, test_type) VALUES (?, ?, ?)',
      [req.user.id, score, type || 'contrast']
    );
    res.status(201).json({ message: 'Résultat enregistré.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de l\'enregistrement.' });
  }
});

/**
 * @route GET /api/ai/health-score
 * @desc Calculer le score de santé oculaire et générer des conseils
 */
router.get('/health-score', auth, async (req, res) => {
  try {
    const userId = req.user.id;

    // 1. Récupérer les sessions des 7 derniers jours
    const sessionsRes = await db.query(
      'SELECT COUNT(*) as count FROM sessions WHERE user_id = ? AND timestamp > DATE_SUB(NOW(), INTERVAL 7 DAY)',
      [userId]
    );
    const sessionCount = sessionsRes.rows[0].count;

    // 2. Récupérer le dernier test de vision
    const testsRes = await db.query(
      'SELECT score FROM eye_tests WHERE user_id = ? ORDER BY timestamp DESC LIMIT 1',
      [userId]
    );
    const lastTestScore = testsRes.rows.length > 0 ? testsRes.rows[0].score : null;

    // 3. Calcul de l'algorithme "Ocu-Health"
    let score = 50; // Base
    
    // Impact Sessions (Max +30)
    score += Math.min(sessionCount * 5, 30);
    
    // Impact Test de vision (Max +20 ou -20)
    if (lastTestScore !== null) {
      if (lastTestScore >= 80) score += 20;
      else if (lastTestScore >= 50) score += 5;
      else score -= 20;
    } else {
      score -= 5; // Malus si aucun test fait
    }

    // Capé entre 0 et 100
    score = Math.max(0, Math.min(100, score));

    // 4. Génération de conseils dynamiques
    let recommendations = [];
    let label = "Stable";
    let color = "#3b82f6";

    if (score >= 80) {
      label = "Excellent";
      color = "#10b981";
      recommendations = [
        "Votre discipline porte ses fruits. Continuez ainsi !",
        "Essayez une routine de 'Musculation Oculaire' pour repousser vos limites."
      ];
    } else if (score >= 50) {
      label = "Fatigue Modérée";
      color = "#f59e0b";
      recommendations = [
        "Augmentez la fréquence de vos pauses 20-20-20.",
        "Une séance de palmage ce soir aiderait à détendre vos muscles."
      ];
      if (sessionCount < 3) recommendations.push("L'IA suggère au moins 3 sessions par semaine pour stabiliser votre score.");
    } else {
      label = "Alerte Surmenage";
      color = "#ef4444";
      recommendations = [
        "Repos immédiat conseillé : éloignez-vous des écrans 30 minutes.",
        "Pratiquez la routine 'Relaxation Profonde' dès maintenant.",
        "Réduisez la luminosité de votre écran."
      ];
    }

    res.json({
      score,
      label,
      color,
      recommendations,
      stats: {
        sessionsLast7Days: sessionCount,
        lastVisionTest: lastTestScore
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors du calcul du score.' });
  }
});

module.exports = router;
