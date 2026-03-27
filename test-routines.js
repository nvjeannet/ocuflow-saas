const axios = require('axios');
require('dotenv').config({ path: './backend/.env' });

const API_URL = 'http://localhost:3000/api';
let token = '';

async function runTests() {
  console.log('🚀 Démarrage des tests d\'intégration des Routines...');

  try {
    // 1. Connexion (On suppose qu'un utilisateur test existe déjà ou on en crée un)
    // Pour ce test, on va tenter de se connecter avec les identifiants par défaut s'ils existent
    // Sinon, ce test échouera et nous devrons créer un utilisateur de test.
    try {
      const loginRes = await axios.post(`${API_URL}/auth/login`, {
        email: 'test@example.com',
        password: 'password123'
      });
      token = loginRes.data.token;
      console.log('✅ Authentifié');
    } catch (e) {
      console.log('ℹ️ Création d\'un compte de test...');
      const regRes = await axios.post(`${API_URL}/auth/register`, {
        email: 'test@example.com',
        password: 'password123'
      });
      token = regRes.data.token;
      console.log('✅ Compte créé et authentifié');
    }

    const headers = { Authorization: `Bearer ${token}` };

    // 2. Créer une routine
    console.log('--- Création d\'une routine ---');
    const createRes = await axios.post(`${API_URL}/routines`, {
      name: 'Test Routine',
      description: 'Ma routine de test',
      icon: '🧪',
      config: { exs: [0, 1], dur: 60 }
    }, { headers });
    const routineId = createRes.data.id;
    console.log(`✅ Routine créée (ID: ${routineId})`);

    // 3. Récupérer les routines
    console.log('--- Récupération des routines ---');
    const listRes = await axios.get(`${API_URL}/routines`, { headers });
    if (listRes.data.some(r => r.id === routineId)) {
      console.log('✅ Routine trouvée dans la liste');
    } else {
      throw new Error('Routine non trouvée dans la liste');
    }

    // 4. Mettre à jour la routine
    console.log('--- Mise à jour de la routine ---');
    await axios.post(`${API_URL}/routines`, {
      id: routineId,
      name: 'Test Routine Modifiée',
      config: { exs: [0, 1, 2], dur: 90 }
    }, { headers });
    
    const checkUpdate = await axios.get(`${API_URL}/routines`, { headers });
    const updated = checkUpdate.data.find(r => r.id === routineId);
    if (updated.name === 'Test Routine Modifiée' && updated.config.dur === 90) {
      console.log('✅ Routine mise à jour avec succès');
    } else {
      throw new Error('La mise à jour a échoué');
    }

    // 5. Supprimer la routine
    console.log('--- Suppression de la routine ---');
    await axios.delete(`${API_URL}/routines/${routineId}`, { headers });
    const finalCheck = await axios.get(`${API_URL}/routines`, { headers });
    if (!finalCheck.data.some(r => r.id === routineId)) {
      console.log('✅ Routine supprimée avec succès');
    } else {
      throw new Error('La suppression a échoué');
    }

    console.log('\n✨ TOUS LES TESTS SONT PASSÉS !');
  } catch (err) {
    console.error('\n❌ ÉCHEC DU TEST :', err.response ? err.response.data : err.message);
    process.exit(1);
  }
}

runTests();
