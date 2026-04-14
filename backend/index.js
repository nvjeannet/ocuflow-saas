const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const authRoutes = require('./auth');
const sessionRoutes = require('./sessions');
const routineRoutes = require('./routines');
const adminRoutes = require('./admin');
const paymentRoutes = require('./payments');
const webhookRoutes = require('./webhooks');
const geoip = require('./middleware/geoip');
const aiRoutes = require('./ai');

const app = express();

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", process.env.CLIENT_URL || 'http://localhost:3000'].filter(Boolean),
    },
  },
  crossOriginEmbedderPolicy: false,
}));

const corsOptions = {
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true
};
app.use(cors(corsOptions));
app.use(geoip);
const PORT = process.env.PORT || 3000;

// ROUTE WEBHOOK (Doit être avant express.json pour le body brut)
app.use('/api/webhooks', webhookRoutes);

app.use(express.json());

// SERVIR LES FICHIERS STATIQUES (FRONTEND)
app.use(express.static(path.join(__dirname, '..')));

// LIMITATION DE DEBIT GLOBALE
const globalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100,
  message: { error: 'Trop de requêtes, veuillez ralentir.' }
});
app.use('/api', globalLimiter);

// LIMITATION DE DEBIT POUR L'AUTHENTIFICATION (plus stricte)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15,
  message: { error: 'Trop de requêtes, veuillez réessayer dans 15 minutes.' }
});

// AUTH (Avec rate limiter)
app.use('/api/auth', authLimiter, authRoutes);

// AUTRES ROUTES
app.use('/api/sessions', sessionRoutes);
app.use('/api/routines', routineRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/ai', aiRoutes);

// REDIRECTION PAR DÉFAUT VERS L'INDEX (CATCH-ALL)
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// START SERVER
app.listen(PORT, () => {
  console.log(`Serveur démarré sur http://localhost:${PORT} (${process.env.NODE_ENV || 'development'})`);
  
  // CRON — Vérification des abonnements expirés (toutes les heures)
  const checkExpired = require('./cron_check_subscriptions');
  checkExpired(); // Vérification au démarrage
  setInterval(checkExpired, 60 * 60 * 1000); // Puis toutes les heures
});

