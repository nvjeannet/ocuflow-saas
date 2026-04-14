/**
 * CRON Job — Vérification de l'expiration des abonnements
 * À exécuter périodiquement (toutes les heures ou via pm2 cron)
 * 
 * Usage: node cron_check_subscriptions.js
 * Ou intégré via setInterval dans le serveur principal.
 */

const db = require('./db');

async function checkExpiredSubscriptions() {
  console.log(`[CRON] ${new Date().toISOString()} — Vérification des abonnements expirés...`);
  
  try {
    // 1. Trouver les abonnements expirés encore "actifs"
    const [expired] = await db.query(
      `SELECT s.id, s.user_id, s.plan_type, s.end_date 
       FROM subscriptions s 
       WHERE s.status = 'active' AND s.end_date < NOW()`
    );

    if (!expired || expired.length === 0) {
      console.log('[CRON] Aucun abonnement expiré.');
      return;
    }

    console.log(`[CRON] ${expired.length} abonnement(s) expiré(s) trouvé(s).`);

    for (const sub of expired) {
      // 2. Marquer l'abonnement comme expiré
      await db.query(
        'UPDATE subscriptions SET status = ? WHERE id = ?',
        ['expired', sub.id]
      );

      // 3. Vérifier si l'utilisateur a un autre abonnement actif
      const [otherActive] = await db.query(
        'SELECT id FROM subscriptions WHERE user_id = ? AND status = ? AND id != ?',
        [sub.user_id, 'active', sub.id]
      );

      if (!otherActive || otherActive.length === 0) {
        // 4. Repasser l'utilisateur en plan "free"
        await db.query(
          'UPDATE users SET plan_type = ?, is_premium = false WHERE id = ?',
          ['free', sub.user_id]
        );
        console.log(`[CRON] Utilisateur ID ${sub.user_id} repassé en free (abo expiré).`);
      }

      // 5. Logger l'action
      await db.query(
        'INSERT INTO admin_logs (action, details) VALUES (?, ?)',
        ['SUBSCRIPTION_EXPIRED', JSON.stringify({ subscriptionId: sub.id, userId: sub.user_id, planType: sub.plan_type })]
      );
    }

    console.log(`[CRON] Traitement terminé. ${expired.length} abonnement(s) mis à jour.`);
  } catch (err) {
    console.error('[CRON] Erreur:', err.message);
  }
}

// Si exécuté directement
if (require.main === module) {
  checkExpiredSubscriptions().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = checkExpiredSubscriptions;
