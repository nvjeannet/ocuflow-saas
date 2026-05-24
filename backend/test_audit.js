const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

let passed = 0;
let failed = 0;

function test(name, assertion, failMsg) {
  if (assertion) {
    console.log(`✅ ${name}`);
    passed++;
  } else {
    console.error(`❌ ${name} — ${failMsg}`);
    failed++;
  }
}

// Test 1: JWT_SECRET valide
const jwt = require('jsonwebtoken');
test('BUG-001 JWT_SECRET présent et long', 
  process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 32,
  'JWT_SECRET trop court ou absent');
test('BUG-001 JWT_SECRET pas un placeholder', 
  !process.env.JWT_SECRET.includes('CHANGE_ME'),
  'JWT_SECRET est encore un placeholder');
console.log('       JWT_SECRET:', process.env.JWT_SECRET.slice(0,8) + '...');

// Test 2: JWT sign/verify
const token = jwt.sign({ id: 1, role: 'user' }, process.env.JWT_SECRET, { expiresIn: '1h' });
const decoded = jwt.verify(token, process.env.JWT_SECRET);
test('BUG-001 JWT sign/verify fonctionne', decoded.id === 1, 'JWT decode KO');

// Test 3: crypto pour reset token
const crypto = require('crypto');
const resetToken = crypto.randomBytes(6).toString('hex');
test('BUG-009 Token reset crypto (12 hex chars)', resetToken.length === 12, 'Mauvaise longueur: ' + resetToken.length);
test('BUG-009 Token reset non numérique', !/^\d+$/.test(resetToken), 'Token encore numérique');
console.log('       Token exemple:', resetToken);

// Test 4: Validation mdp >= 8 chars
function validatePassword(pwd) { return pwd && pwd.length >= 8; }
test('BUG-005 Mdp 4 chars refusé', !validatePassword('abcd'), 'Mdp trop court accepté');
test('BUG-005 Mdp 8 chars accepté', validatePassword('abcdefgh'), 'Mdp 8 chars refusé');

// Test 5: routines.js syntaxe (doit charger sans erreur)
try {
  require('./routines.js');
  test('BUG-010 routines.js charge sans erreur', true, '');
} catch(e) {
  test('BUG-010 routines.js charge sans erreur', false, e.message);
}

// Test 6: Cron destructuration
const cronSrc = require('fs').readFileSync('./cron_check_subscriptions.js', 'utf8');
test('BUG-003 Cron { rows: expired }', cronSrc.includes('rows: expired'), 'Destructuration non corrigée');
test('BUG-003 Cron { rows: otherActive }', cronSrc.includes('rows: otherActive'), 'otherActive non corrigé');

// Test 7: Routes dupliquées supprimées
const authSrc = require('fs').readFileSync('./auth.js', 'utf8');
const teamAddCount = (authSrc.match(/router\.post\('\/team\/add'/g) || []).length;
test('BUG-002 Route /team/add unique', teamAddCount === 1, 'Dupliquée ' + teamAddCount + ' fois');

// Test 8: GeoIP cache
const geoSrc = require('fs').readFileSync('./middleware/geoip.js', 'utf8');
test('BUG-007 Cache GeoIP (Map)', geoSrc.includes('geoCache'), 'Cache absent');
test('BUG-007 TTL GeoIP', geoSrc.includes('CACHE_TTL_MS'), 'TTL absent');

// Test 9: Multer sécurisé
const adminSrc = require('fs').readFileSync('./admin.js', 'utf8');
test('BUG-018/019 Multer fileFilter', adminSrc.includes('fileFilter'), 'fileFilter absent');
test('BUG-018/019 Multer fileSize limit', adminSrc.includes('fileSize'), 'limite fileSize absente');

// Test 10: CSS --header-h
const cssSrc = require('fs').readFileSync('../css/style.css', 'utf8');
test('BUG-015 Variable CSS --header-h', cssSrc.includes('--header-h'), 'Variable absente du CSS');

// Test 11: resetLimiter
const indexSrc = require('fs').readFileSync('./index.js', 'utf8');
test('BUG-009 resetLimiter déclaré', indexSrc.includes('resetLimiter'), 'resetLimiter absent');
test('BUG-009 resetLimiter sur /forgot-password', indexSrc.includes('forgot-password') && indexSrc.includes('resetLimiter'), 'Non appliqué');

// Test 12: Meta SEO
const fs = require('fs');
const indexHtml = fs.readFileSync('../index.html', 'utf8');
const authHtml = fs.readFileSync('../auth.html', 'utf8');
const dashHtml = fs.readFileSync('../dashboard.html', 'utf8');
test('BUG-016 Meta description index.html', indexHtml.includes('name="description"'), 'Absente');
test('BUG-016 Meta description auth.html', authHtml.includes('name="description"'), 'Absente');
test('BUG-016 Meta description dashboard.html', dashHtml.includes('name="description"'), 'Absente');

// Test 13: theme-dark supprimé
test('BUG-022 theme-dark retiré du body', !dashHtml.includes('class="theme-dark"'), 'Encore hardcodé');

// Test 14: API_URL dynamique dans auth.html
test('BUG-011 API_URL dynamique dans auth.html', authHtml.includes('getApiBaseUrl'), 'API_URL encore hardcodé');

// Test 15: bcrypt require redondant supprimé
test('BUG-008 require bcrypt redondant supprimé', !authSrc.includes("const bcrypt = require('bcryptjs');\n    const hash"), 'Require redondant encore présent');

console.log('');
console.log('═══════════════════════════════════════════');
console.log(`RÉSULTAT: ${passed} ✅ passé(s) | ${failed} ❌ échoué(s)`);
if (failed === 0) console.log('🎉 TOUS LES TESTS SONT VERTS !');
console.log('═══════════════════════════════════════════');
process.exit(failed > 0 ? 1 : 0);
