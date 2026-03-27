const express = require('express');
const crypto = require('crypto');
const db = require('./db');
const router = express.Router();

const MONEROO_SECRET = process.env.MONEROO_SECRET || 'votre_secret_moneroo';

// MIDDLEWARE POUR RÉCUPÉRER LE BODY BRUT (nécessaire pour la vérification HMAC)
router.post('/moneroo', express.raw({ type: 'application/json' }), async (req, res) => {
  const signature = req.headers['x-moneroo-signature'];
  const payload = req.body;

  // 1. Vérification de la signature HMAC
  if (MONEROO_SECRET !== 'votre_secret_moneroo') {
    const hmac = crypto.createHmac('sha256', MONEROO_SECRET);
    const digest = hmac.update(payload).digest('hex');
    
    if (signature !== digest) {
      console.error('Signature Moneroo invalide !');
      return res.status(401).send('Invalid signature');
    }
  }

  const event = JSON.parse(payload.toString());
  console.log('Webhook Moneroo reçu :', event.event);

  // 2. Traitement de l'événement
  if (event.event === 'payment.success') {
    const { reference, customer, amount, currency } = event.data;
    const email = customer.email;

    try {
      // Trouver l'utilisateur
      const userRes = await db.query('SELECT id FROM users WHERE email = ?', [email]);
      if (userRes.rows.length > 0) {
        const userId = userRes.rows[0].id;

        // Mettre à jour le statut Premium
        await db.query('UPDATE users SET is_premium = true WHERE id = ?', [userId]);

        // Créer l'enregistrement de souscription
        const startDate = new Date();
        const endDate = new Date();
        endDate.setMonth(endDate.getMonth() + 1); // Par défaut 1 mois

        await db.query(
          'INSERT INTO subscriptions (user_id, moneroo_ref, amount, currency, status, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [userId, reference, amount / 100, currency, 'active', startDate, endDate]
        );

        console.log(`Abonnement activé pour ${email}`);
      }
    } catch (err) {
      console.error('Erreur lors du traitement du webhook :', err);
      return res.status(500).send('Internal Server Error');
    }
  }

  res.status(200).send('Webhook processed');
});

module.exports = router;
