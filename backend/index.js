const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./auth');
const sessionRoutes = require('./sessions');
const routineRoutes = require('./routines');
const adminRoutes = require('./admin');
const path = require('path');
const webhookRoutes = require('./webhooks');
const geoip = require('./middleware/geoip');

const app = express();
app.use(geoip);
const PORT = process.env.PORT || 3000;

// MIDDLEWARES
app.use(cors());
// Note: Le middleware express.json() est déplacé après les webhooks si nécessaire, 
// mais ici on gère le body brut directement dans le router webhook.
app.use(express.json());

// SERVIR LES FICHIERS STATIQUES (FRONTEND)
app.use(express.static(path.join(__dirname, '..')));

// ROUTES
app.use('/api/auth', authRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/routines', routineRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/webhooks', webhookRoutes);

// REDIRECTION PAR DÉFAUT VERS L'INDEX (CATCH-ALL)
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// START SERVER
app.listen(PORT, () => {
  console.log(`Serveur démarré sur http://localhost:${PORT}`);
});
