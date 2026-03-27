const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./auth');
const sessionRoutes = require('./sessions');
const routineRoutes = require('./routines');
const adminRoutes = require('./admin');
const paymentRoutes = require('./payments');
const path = require('path');
const webhookRoutes = require('./webhooks');
const geoip = require('./middleware/geoip');
const aiRoutes = require('./ai');

const app = express();
app.use(cors());
app.use(geoip);
const PORT = process.env.PORT || 3000;

// ROUTE WEBHOOK (Doit être avant express.json pour le body brut)
app.use('/api/webhooks', webhookRoutes);

app.use(express.json());

// SERVIR LES FICHIERS STATIQUES (FRONTEND)
app.use(express.static(path.join(__dirname, '..')));

// AUTRES ROUTES
app.use('/api/auth', authRoutes);
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
  console.log(`Serveur démarré sur http://localhost:${PORT}`);
});
