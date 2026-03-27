const jwt = require('jsonwebtoken');
const SECRET_KEY = process.env.JWT_SECRET || 'votre_cle_secrete_super_sure';

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
    res.status(400).json({ error: 'Jeton invalide.' });
  }
};
