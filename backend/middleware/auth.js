const jwt = require('jsonwebtoken');
if (!process.env.JWT_SECRET) throw new Error('FATAL: JWT_SECRET non défini dans .env');
const SECRET_KEY = process.env.JWT_SECRET;

module.exports = (req, res, next) => {
  const token = req.header('Authorization');

  if (!token) {
    return res.status(401).json({ error: 'Accès refusé. Aucun jeton fourni.' });
  }

  try {
    // Le token arrive souvent sous la forme "Bearer <token>"
    const bearerToken = token.startsWith('Bearer ') ? token.slice(7) : token;
    const verified = jwt.verify(bearerToken, SECRET_KEY);
    req.user = verified;
    next();
  } catch (err) {
    console.warn(`[Auth] Jeton invalide ou expiré: ${err.message}`);
    res.status(401).json({ error: 'Jeton invalide ou expiré.' });
  }
};
