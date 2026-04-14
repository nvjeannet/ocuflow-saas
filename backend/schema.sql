-- ══ SCHÉMA DE LA BASE DE DONNÉES OCUFLOW (MYSQL COMPATIBLE) ══════════════════════

-- 1. Table des Utilisateurs
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    first_name VARCHAR(100) NULL,
    last_name VARCHAR(100) NULL,
    department VARCHAR(100) NULL,
    xp INT DEFAULT 0,
    level INT DEFAULT 1,
    is_premium BOOLEAN DEFAULT FALSE,
    plan_type ENUM('free', 'premium', 'pro') DEFAULT 'free',
    role ENUM('user', 'admin', 'pro') DEFAULT 'user',
    parent_id INT NULL,
    country_code VARCHAR(10) DEFAULT 'GA',
    last_login DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_id) REFERENCES users(id) ON DELETE SET NULL
);

-- 1.2 Table des Tarifs par Pays
CREATE TABLE IF NOT EXISTS pricing_rules (
    id INT AUTO_INCREMENT PRIMARY KEY,
    country_code VARCHAR(10) NOT NULL,
    plan_type ENUM('free', 'premium', 'pro') NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'XAF',
    vat_rate DECIMAL(5, 2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 1.3 Table des Partenaires
CREATE TABLE IF NOT EXISTS partners (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    manager VARCHAR(255),
    city VARCHAR(100),
    phone VARCHAR(50),
    address TEXT,
    email VARCHAR(255),
    website TEXT,
    logo_url TEXT,
    country_code VARCHAR(10) DEFAULT 'GA',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
 
 -- 1.4 Table des Clubs / Entreprises (PRO)
 CREATE TABLE IF NOT EXISTS clubs (
     id INT AUTO_INCREMENT PRIMARY KEY,
     owner_id INT NOT NULL,
     name VARCHAR(255) NOT NULL,
     country_code VARCHAR(10),
     city VARCHAR(100),
     phone VARCHAR(50),
     email VARCHAR(255),
     logo_url TEXT,
     settings JSON DEFAULT NULL,
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
 );

-- 2. Table des Abonnements
CREATE TABLE IF NOT EXISTS subscriptions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    plan_type VARCHAR(50) DEFAULT 'monthly',
    status VARCHAR(20) DEFAULT 'pending',
    amount DECIMAL(10, 2),
    currency VARCHAR(3) DEFAULT 'XOF',
    moneroo_ref VARCHAR(100) UNIQUE,
    start_date TIMESTAMP NULL,
    end_date TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 3. Table des Sessions d'Entraînement
CREATE TABLE IF NOT EXISTS sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    routine_id INTEGER NULL,
    duration INTEGER NOT NULL,
    exercises JSON NOT NULL, -- Format [0, 1, 17]
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 4. Table des Routines Personnalisées
CREATE TABLE IF NOT EXISTS user_routines (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    name VARCHAR(100) NOT NULL,
    icon VARCHAR(10),
    description TEXT,
    config JSON NOT NULL, -- {exs: [0,1], dur: 120, speed: 3}
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 5. Table des Logs d'Audit
CREATE TABLE IF NOT EXISTS admin_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    admin_id INTEGER,
    action TEXT NOT NULL,
    target_id INTEGER,
    details JSON,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE SET NULL
);

-- 6. Table des Routines Globales (CMS)
CREATE TABLE IF NOT EXISTS global_routines (
    id INT AUTO_INCREMENT PRIMARY KEY,
    slug VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    icon VARCHAR(10),
    description TEXT,
    exs JSON NOT NULL,
    dur INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 7. Table des Tests Visuels
CREATE TABLE IF NOT EXISTS eye_tests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    test_type VARCHAR(50) DEFAULT 'contrast',
    score INT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 8. Table des Avis / Témoignages
CREATE TABLE IF NOT EXISTS testimonials (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    email VARCHAR(255),
    content TEXT NOT NULL,
    status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
    reply_text TEXT NULL,
    replied_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 9. Table de Configuration IA
CREATE TABLE IF NOT EXISTS ai_config (
    id INT AUTO_INCREMENT PRIMARY KEY,
    param_key VARCHAR(100) UNIQUE NOT NULL,
    param_value JSON NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 10. Table des Réglages d'Équipe (PRO)
CREATE TABLE IF NOT EXISTS team_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    manager_id INT NOT NULL UNIQUE,
    fixed_times JSON DEFAULT NULL,
    days JSON DEFAULT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (manager_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 11. Table des Conseils (Tips)
CREATE TABLE IF NOT EXISTS tips (
    id INT AUTO_INCREMENT PRIMARY KEY,
    content TEXT NOT NULL,
    category VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 12. Table des Mouvements (Bibliothèque d'Exercices)
CREATE TABLE IF NOT EXISTS movements (
    id INT AUTO_INCREMENT PRIMARY KEY,
    slug VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    icon VARCHAR(10),
    description TEXT,
    category VARCHAR(50),
    default_duration INT DEFAULT 30,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 13. Table des Réinitialisations de Mot de Passe
CREATE TABLE IF NOT EXISTS password_resets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    token VARCHAR(100) NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index pour la performance
CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX idx_user_routines_user ON user_routines(user_id);
CREATE INDEX idx_eye_tests_user ON eye_tests(user_id);
CREATE INDEX idx_testimonials_user ON testimonials(user_id);
