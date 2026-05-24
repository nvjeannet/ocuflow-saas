# OcuFlow SaaS 👁️

OcuFlow est une plateforme SaaS de santé visuelle conçue pour aider les utilisateurs à soulager la fatigue oculaire liée aux écrans numériques via des exercices oculaires guidés, un suivi des progrès, un dashboard d'administration complet et un modèle d'abonnement.

---

## 🚀 Démarrage Rapide en Local

### Prérequis
- Node.js (v18 ou supérieur)
- MySQL

### Installation & Configuration
1. Cloner le dépôt et aller à la racine du projet :
   ```bash
   git clone https://github.com/nvjeannet/ocuflow-saas.git
   cd ocuflow-saas
   ```

2. Installer les dépendances du backend :
   ```bash
   cd backend
   npm install
   ```

3. Configurer les variables d'environnement dans `backend/.env` :
   ```env
   PORT=3000
   DB_HOST=localhost
   DB_USER=votre_utilisateur
   DB_PASS=votre_mot_de_passe
   DB_NAME=ocuflow
   JWT_SECRET=generer_un_secret_fort_ici
   MONEROO_SECRET=votre_secret_moneroo
   ```

4. Initialiser la base de données (migrations) :
   ```bash
   npm run migrate
   ```

5. Lancer l'application en mode développement :
   ```bash
   npm run dev
   ```
   L'application est accessible à l'adresse : `http://localhost:3000`

---

## 🧪 Tests Unitaires et d'Intégration
Pour lancer la suite de tests automatisés validant la sécurité et le bon fonctionnement logique de l'application :
```bash
cd backend
node test_audit.js
```

---

## 🛠️ Déploiement Continu (CI/CD) vers VPS Hostinger

Un pipeline de déploiement automatique via **GitHub Actions** est configuré pour publier l'application sur votre VPS Hostinger à chaque push sur la branche `main`.

### 1. Configuration des Secrets GitHub
Dans les paramètres de votre dépôt GitHub (`Settings > Secrets and variables > Actions > New repository secret`), ajoutez les secrets suivants :
* `HOSTINGER_HOST` : Adresse IP de votre VPS.
* `HOSTINGER_USER` : Utilisateur SSH (ex: `root`).
* `HOSTINGER_SSH_KEY` : Clé privée SSH (doit correspondre à la clé publique dans `~/.ssh/authorized_keys` sur le VPS).
* `HOSTINGER_PORT` : Port SSH (par défaut `22`).

### 2. Configuration Initiale du VPS Hostinger

Connectez-vous à votre VPS en SSH et configurez le serveur :

```bash
# 1. Mettre à jour et installer Node.js 20 LTS et PM2
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo npm install pm2 -g

# 2. Créer le dossier et cloner l'application
sudo mkdir -p /var/www/ocuflow-saas
sudo chown -R $USER:$USER /var/www/ocuflow-saas
git clone https://github.com/nvjeannet/ocuflow-saas.git /var/www/ocuflow-saas

# 3. Configurer le fichier .env de production
cd /var/www/ocuflow-saas/backend
nano .env # Configurez les vraies valeurs de base de données et secrets de production

# 4. Démarrer l'application avec PM2
pm2 start index.js --name "ocuflow-api"
pm2 save
pm2 startup
```

### 3. Fonctionnement du Pipeline (GitHub Actions)
À chaque push sur `main` :
1. Les dépendances sont installées et la suite de tests `test_audit.js` est exécutée.
2. Si un test échoue, le déploiement est interrompu.
3. Si les tests réussissent, GitHub Actions se connecte au VPS en SSH pour faire un `git pull`, installer les packages de production, exécuter les migrations (`npm run migrate`) et recharger l'API avec PM2 sans interruption de service.
