-- ══ SCHÉMA DE LA BASE DE DONNÉES OCUFLOW (MYSQL COMPATIBLE) ══════════════════════

-- 1. Table des Utilisateurs
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    xp INT DEFAULT 0,
    level INT DEFAULT 1,
    is_premium BOOLEAN DEFAULT FALSE,
    plan_type ENUM('free', 'premium', 'pro') DEFAULT 'free',
    role ENUM('user', 'admin') DEFAULT 'user',
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
    vat_rate DECIMAL(5, 2) DEFAULT 18.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 1.3 Table des Partenaires
CREATE TABLE IF NOT EXISTS partners (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    responsible_name VARCHAR(255),
    city VARCHAR(100),
    phone VARCHAR(50),
    email VARCHAR(255),
    website TEXT,
    logo_url TEXT,
    country_code VARCHAR(10) DEFAULT 'GA',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
 
 -- 1.1 Table des Clubs / Entreprises (PRO)
 CREATE TABLE IF NOT EXISTS clubs (
     id INT AUTO_INCREMENT PRIMARY KEY,
     owner_id INT NOT NULL,
     name VARCHAR(255) NOT NULL,
     country_code VARCHAR(10),
     city VARCHAR(100),
     phone VARCHAR(50),
     email VARCHAR(255),
     logo_url TEXT,
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
    exs JSON NOT NULL, -- Pour MySQL, on utilise JSON au lieu de INTEGER[]
    dur INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Index pour la performance
CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX idx_user_routines_user ON user_routines(user_id);
