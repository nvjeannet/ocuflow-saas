const axios = require('axios');

const geoip = async (req, res, next) => {
  try {
    // En développement local, on force un pays (ex: FR) car l'IP sera 127.0.0.1
    let ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    
    if (ip === '::1' || ip === '127.0.0.1') {
      req.country = 'FR'; // Valeur par défaut locale
      return next();
    }

    const response = await axios.get(`http://ip-api.com/json/${ip.split(',')[0]}`);
    if (response.data && response.data.status === 'success') {
      req.country = response.data.countryCode;
    } else {
      req.country = 'FR'; // Fallback
    }
  } catch (err) {
    console.error('Erreur GeoIP:', err.message);
    req.country = 'FR'; // Fallback en cas d'erreur
  }
  next();
};

module.exports = geoip;
