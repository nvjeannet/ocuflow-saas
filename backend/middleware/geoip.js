const axios = require('axios');

// Cache en mémoire : IP → { countryCode, expiresAt }
const geoCache = new Map();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 heure

const geoip = async (req, res, next) => {
  if (req.method === 'OPTIONS') return next();
  try {
    let ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    // Développement local : IP loopback → défaut GA (Gabon)
    if (ip === '::1' || ip === '127.0.0.1') {
      req.country = 'GA';
      return next();
    }

    const clientIp = ip.split(',')[0].trim();

    // Vérifier le cache d'abord
    const cached = geoCache.get(clientIp);
    if (cached && cached.expiresAt > Date.now()) {
      req.country = cached.countryCode;
      return next();
    }

    // Appel API seulement si non en cache
    const response = await axios.get(`http://ip-api.com/json/${clientIp}`, { timeout: 3000 });
    if (response.data && response.data.status === 'success') {
      req.country = response.data.countryCode;
      // Mettre en cache pour 1 heure
      geoCache.set(clientIp, { countryCode: response.data.countryCode, expiresAt: Date.now() + CACHE_TTL_MS });
    } else {
      req.country = 'GA'; // Fallback Gabon
    }
  } catch (err) {
    console.error('Erreur GeoIP:', err.message);
    req.country = 'GA'; // Fallback Gabon en cas d'erreur
  }
  next();
};

// Nettoyage périodique du cache (toutes les 2h) pour éviter les fuites mémoire
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of geoCache.entries()) {
    if (val.expiresAt <= now) geoCache.delete(key);
  }
}, 2 * 60 * 60 * 1000);

module.exports = geoip;
