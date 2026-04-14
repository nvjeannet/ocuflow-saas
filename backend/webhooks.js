const express = require('express');
const crypto = require('crypto');
const db = require('./db');
const router = express.Router();

const MONEROO_SECRET = process.env.MONEROO_SECRET;
if (!MONEROO_SECRET) {
  console.error('⚠️  MONEROO_SECRET manquant dans .env ! Les webhooks ne fonctionneront pas.');
}

// MIDDLEWARE POUR RÉCUPÉRER LE BODY BRUT (nécessaire pour la vérification HMAC)
router.post('/moneroo', express.raw({ type: 'application/json' }), async (req, res) => {
  const signature = req.headers['x-moneroo-signature'];
  const payload = req.body;

  // 1. Vérification de la signature HMAC
  const hmac = crypto.createHmac('sha256', MONEROO_SECRET);
  const digest = hmac.update(payload).digest('hex');
  
  if (signature !== digest) {
    console.error("Signature Moneroo invalide ! Tentative d'intrusion.");
    return res.status(401).send('Invalid signature');
  }

  const event = JSON.parse(payload.toString());
  console.log('Webhook Moneroo reçu :', event.event);

  // 2. Traitement de l'événement
  if (event.event === 'payment.success') {
    const { reference, customer, amount, currency, metadata } = event.data;
    const userId = metadata?.user_id;
    const planType = metadata?.plan_type || 'premium';

    try {
      // 1. Mettre à jour le statut Premium de l'utilisateur
      await db.query(
        'UPDATE users SET is_premium = true, plan_type = ? WHERE id = ?',
        [planType, userId]
      );

      // 2. Calculer les dates (1 mois d'abonnement)
      const startDate = new Date();
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + 1);

      // 3. Créer ou mettre à jour la souscription
      await db.query(
        'INSERT INTO subscriptions (user_id, moneroo_ref, amount, currency, status, plan_type, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [userId, reference, amount / 100, currency, 'active', planType, startDate, endDate]
      );

      // 4. Si c'est un compte PRO, créer l'entrée dans la table 'clubs'
      if (planType === 'pro') {
        await db.query(
          'INSERT INTO clubs (owner_id, name, country_code, city, phone, email, logo_url) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [
            userId, 
            metadata.club_name || 'Club Sans Nom', 
            req.country || 'GA', 
            metadata.city || '', 
            metadata.phone || '', 
            customer.email, 
            metadata.logo_url || ''
          ]
        );
      }

      // 5. Loguer l'action admin (Audit)
      await db.query(
        'INSERT INTO admin_logs (action, details) VALUES (?, ?)',
        ['PAYMENT_SUCCESS', JSON.stringify({ userId, reference, planType, amount: amount/100 })]
      );

      console.log(`✅ Abonnement ${planType} activé pour l'utilisateur ID: ${userId}`);
    } catch (err) {
      console.error('❌ Erreur Webhook Processing:', err);
      return res.status(500).send('Error');
    }
  }

  res.status(200).send('Webhook processed');
});

module.exports = router;
