const express = require('express');
const axios = require('axios');
const db = require('./db');
const auth = require('./middleware/auth');
const router = express.Router();

const MONEROO_API_KEY = process.env.MONEROO_API_KEY || 'votre_api_key_moneroo';

// CRÉER UNE SESSION DE PAIEMENT (CHECKOUT)
router.post('/checkout', auth, async (req, res) => {
  const { plan_type, club_name, city, phone, logo_url } = req.body; // 'premium' ou 'pro'
  const country = req.country || 'GA';
  const userId = req.user.id;
  const userEmail = req.user.email;

  try {
    // 1. Récupérer les règles de tarification
    const pricingRes = await db.query(
      'SELECT * FROM pricing_rules WHERE country_code = ? AND plan_type = ?',
      [country, plan_type]
    );

    let priceRule = pricingRes.rows[0];
    if (!priceRule) {
      // Fallback vers GA si pays inconnu
      const fallbackRes = await db.query(
        'SELECT * FROM pricing_rules WHERE country_code = \'GA\' AND plan_type = ?',
        [plan_type]
      );
      priceRule = fallbackRes.rows[0];
    }

    if (!priceRule) return res.status(404).json({ error: 'Plan non trouvé.' });

    const amountHT = parseFloat(priceRule.price);
    const vatRate = parseFloat(priceRule.vat_rate);
    const amountTTC = amountHT * (1 + (vatRate / 100));
    const amountInCents = Math.round(amountTTC * 100);

    // 2. Appeler Moneroo Checkout
    const response = await axios.post('https://api.moneroo.io/v1/payments/checkout', {
      amount: amountInCents,
      currency: priceRule.currency,
      description: `Abonnement OcuFlow ${plan_type.toUpperCase()}`,
      customer: {
        email: userEmail
      },
      return_url: `${process.env.APP_URL || 'http://localhost:3000'}/dashboard.html?payment=success`,
      cancel_url: `${process.env.APP_URL || 'http://localhost:3000'}/dashboard.html?payment=cancel`,
      metadata: {
        user_id: userId,
        plan_type: plan_type,
        club_name: club_name || '',
        city: city || '',
        phone: phone || '',
        logo_url: logo_url || ''
      }
    }, {
      headers: {
        'Authorization': `Bearer ${MONEROO_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    res.json({ checkout_url: response.data.data.checkout_url });

  } catch (err) {
    console.error('Erreur Checkout Moneroo:', err.response?.data || err.message);
    res.status(500).json({ error: 'Impossible d\'initier le paiement.' });
  }
});

module.exports = router;
