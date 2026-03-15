const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'insurance.db');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initDb() {
  createSchema();
  seedData();
}

function createSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT NOT NULL,
      email         TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role          TEXT NOT NULL DEFAULT 'user',
      created_at    DATETIME NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id            TEXT PRIMARY KEY,
      user_id       INTEGER REFERENCES users(id),
      session_token TEXT NOT NULL,
      consent_given INTEGER NOT NULL DEFAULT 0,
      language      TEXT NOT NULL DEFAULT 'en',
      status        TEXT NOT NULL DEFAULT 'active',
      policy_type   TEXT,
      created_at    DATETIME NOT NULL DEFAULT (datetime('now')),
      updated_at    DATETIME NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS session_metadata (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL REFERENCES sessions(id),
      source     TEXT,
      ip_address TEXT,
      user_agent TEXT,
      timestamp  DATETIME NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS disclosures (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id   TEXT NOT NULL REFERENCES sessions(id),
      question_key TEXT NOT NULL,
      answer       TEXT NOT NULL,
      created_at   DATETIME NOT NULL DEFAULT (datetime('now')),
      UNIQUE (session_id, question_key)
    );

    CREATE TABLE IF NOT EXISTS policies (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT NOT NULL,
      type          TEXT NOT NULL,
      description   TEXT,
      min_age       INTEGER,
      max_age       INTEGER,
      min_income    REAL,
      max_income    REAL,
      coverage_type TEXT,
      premium_base  REAL,
      features      TEXT,
      active        INTEGER NOT NULL DEFAULT 1,
      created_at    DATETIME NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS policy_riders (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      policy_id   INTEGER NOT NULL REFERENCES policies(id),
      rider_name  TEXT NOT NULL,
      mandatory   INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS recommendations (
      id                 INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id         TEXT NOT NULL REFERENCES sessions(id),
      policy_id          INTEGER NOT NULL REFERENCES policies(id),
      suitability_score  REAL,
      affordability_score REAL,
      explanation        TEXT,
      rank               INTEGER,
      created_at         DATETIME NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS proposals (
      id            TEXT PRIMARY KEY,
      session_id    TEXT NOT NULL REFERENCES sessions(id),
      policy_id     INTEGER NOT NULL REFERENCES policies(id),
      status        TEXT NOT NULL DEFAULT 'draft',
      proposal_data TEXT,
      created_at    DATETIME NOT NULL DEFAULT (datetime('now')),
      updated_at    DATETIME NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS feedback (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL REFERENCES sessions(id),
      rating     INTEGER,
      comments   TEXT,
      created_at DATETIME NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS risk_rules (
      id                     INTEGER PRIMARY KEY AUTOINCREMENT,
      age_min                INTEGER,
      age_max                INTEGER,
      income_min             REAL,
      income_max             REAL,
      bmi_min                REAL,
      bmi_max                REAL,
      smoker                 TEXT DEFAULT 'any',
      dependents_min         INTEGER,
      dependents_max         INTEGER,
      risk_level             TEXT,
      risk_score             REAL,
      recommended_policy_type TEXT
    );

    CREATE TABLE IF NOT EXISTS training_data (
      id                 INTEGER PRIMARY KEY AUTOINCREMENT,
      age                INTEGER,
      income             REAL,
      dependents         INTEGER,
      bmi                REAL,
      smoker             INTEGER,
      risk_score         REAL,
      recommended_policy TEXT,
      created_at         DATETIME NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER,
      action      TEXT,
      entity_type TEXT,
      entity_id   TEXT,
      details     TEXT,
      created_at  DATETIME NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

function seedData() {
  // Seed policies only if table is empty
  const policyCount = db.prepare('SELECT COUNT(*) AS cnt FROM policies').get().cnt;
  if (policyCount === 0) {
    const insertPolicy = db.prepare(`
      INSERT INTO policies (name, type, description, min_age, max_age, min_income, max_income, coverage_type, premium_base, features)
      VALUES (@name, @type, @description, @min_age, @max_age, @min_income, @max_income, @coverage_type, @premium_base, @features)
    `);

    const policies = [
      {
        name: 'Young Saver Plan',
        type: 'life',
        description: 'Ideal for young professionals starting their financial journey with life coverage and savings benefits.',
        min_age: 18, max_age: 35,
        min_income: 30000, max_income: null,
        coverage_type: 'term',
        premium_base: 1500,
        features: JSON.stringify(['Life cover up to 10x annual income', 'Savings component', 'Waiver of premium on disability', 'Affordable premiums'])
      },
      {
        name: 'Life Secure Plan',
        type: 'life',
        description: 'Comprehensive life insurance for mid-career professionals seeking robust protection.',
        min_age: 25, max_age: 55,
        min_income: 60000, max_income: null,
        coverage_type: 'whole-life',
        premium_base: 3000,
        features: JSON.stringify(['Whole-life coverage', 'Cash value accumulation', 'Critical illness rider available', 'Flexible premium payment'])
      },
      {
        name: 'Critical Protect Plan',
        type: 'health',
        description: 'Specialized plan covering major critical illnesses with lump-sum payout.',
        min_age: 30, max_age: 65,
        min_income: 80000, max_income: null,
        coverage_type: 'critical-illness',
        premium_base: 5000,
        features: JSON.stringify(['36 critical illness covered', 'Lump-sum payout on diagnosis', 'Early-stage coverage', 'Premium waiver on claim'])
      },
      {
        name: 'Family Shield Plan',
        type: 'life',
        description: 'Holistic family protection plan with multi-life coverage benefits.',
        min_age: 25, max_age: 60,
        min_income: 50000, max_income: null,
        coverage_type: 'family',
        premium_base: 4000,
        features: JSON.stringify(['Family income benefit', 'Spouse and children coverage', 'Education fund component', 'Accidental death benefit'])
      },
      {
        name: 'Retirement Gold Plan',
        type: 'retirement',
        description: 'Guaranteed retirement income plan for a secure and comfortable retirement.',
        min_age: 35, max_age: 60,
        min_income: 100000, max_income: null,
        coverage_type: 'annuity',
        premium_base: 6000,
        features: JSON.stringify(['Guaranteed monthly income post-retirement', 'Capital guaranteed', 'Inflation-adjusted payout option', 'Death benefit'])
      },
      {
        name: 'Investment Plus Plan',
        type: 'investment',
        description: 'Unit-linked investment plan combining market-linked growth with life protection.',
        min_age: 25, max_age: 55,
        min_income: 80000, max_income: null,
        coverage_type: 'investment-linked',
        premium_base: 4500,
        features: JSON.stringify(['Market-linked returns', 'Multiple fund options', 'Partial withdrawal facility', 'Life cover included'])
      }
    ];

    const seedPolicies = db.transaction(() => {
      for (const p of policies) {
        insertPolicy.run(p);
      }
    });
    seedPolicies();
  }

  // Seed risk rules only if table is empty
  const ruleCount = db.prepare('SELECT COUNT(*) AS cnt FROM risk_rules').get().cnt;
  if (ruleCount === 0) {
    const insertRule = db.prepare(`
      INSERT INTO risk_rules (age_min, age_max, income_min, income_max, bmi_min, bmi_max, smoker, dependents_min, dependents_max, risk_level, risk_score, recommended_policy_type)
      VALUES (@age_min, @age_max, @income_min, @income_max, @bmi_min, @bmi_max, @smoker, @dependents_min, @dependents_max, @risk_level, @risk_score, @recommended_policy_type)
    `);

    const rules = [
      { age_min: 18, age_max: 35, income_min: null, income_max: null, bmi_min: null, bmi_max: null, smoker: 'any', dependents_min: null, dependents_max: null, risk_level: 'Low', risk_score: 0.3, recommended_policy_type: 'life' },
      { age_min: 36, age_max: 50, income_min: null, income_max: null, bmi_min: null, bmi_max: null, smoker: 'any', dependents_min: null, dependents_max: null, risk_level: 'Medium', risk_score: 0.6, recommended_policy_type: 'health' },
      { age_min: 51, age_max: 99, income_min: null, income_max: null, bmi_min: null, bmi_max: null, smoker: 'any', dependents_min: null, dependents_max: null, risk_level: 'High', risk_score: 0.9, recommended_policy_type: 'retirement' },
      { age_min: null, age_max: null, income_min: null, income_max: null, bmi_min: null, bmi_max: null, smoker: 'yes', dependents_min: null, dependents_max: null, risk_level: 'High', risk_score: 0.9, recommended_policy_type: 'health' }
    ];

    const seedRules = db.transaction(() => {
      for (const r of rules) {
        insertRule.run(r);
      }
    });
    seedRules();
  }

  // Seed training data only if table is empty
  const trainingCount = db.prepare('SELECT COUNT(*) AS cnt FROM training_data').get().cnt;
  if (trainingCount === 0) {
    const insertTraining = db.prepare(`
      INSERT INTO training_data (age, income, dependents, bmi, smoker, risk_score, recommended_policy)
      VALUES (@age, @income, @dependents, @bmi, @smoker, @risk_score, @recommended_policy)
    `);

    const trainingRows = [
      { age: 25, income: 45000, dependents: 0, bmi: 22.5, smoker: 0, risk_score: 0.3, recommended_policy: 'Young Saver Plan' },
      { age: 40, income: 75000, dependents: 2, bmi: 27.0, smoker: 0, risk_score: 0.6, recommended_policy: 'Life Secure Plan' },
      { age: 55, income: 120000, dependents: 1, bmi: 29.5, smoker: 1, risk_score: 0.9, recommended_policy: 'Retirement Gold Plan' },
      { age: 32, income: 55000, dependents: 2, bmi: 24.0, smoker: 0, risk_score: 0.4, recommended_policy: 'Family Shield Plan' },
      { age: 45, income: 95000, dependents: 0, bmi: 26.0, smoker: 1, risk_score: 0.85, recommended_policy: 'Critical Protect Plan' }
    ];

    const seedTraining = db.transaction(() => {
      for (const t of trainingRows) {
        insertTraining.run(t);
      }
    });
    seedTraining();
  }

  // Seed admin user only if not exists
  const adminExists = db.prepare("SELECT id FROM users WHERE email = 'admin@insurance.com'").get();
  if (!adminExists) {
    const adminPassword = process.env.ADMIN_INITIAL_PASSWORD || 'Admin@123';
    if (!process.env.ADMIN_INITIAL_PASSWORD) {
      console.warn('[WARNING] ADMIN_INITIAL_PASSWORD not set. Using default password for admin@insurance.com — change this in production.');
    }
    const passwordHash = bcrypt.hashSync(adminPassword, 10);
    db.prepare(`
      INSERT INTO users (name, email, password_hash, role)
      VALUES ('Admin User', 'admin@insurance.com', ?, 'admin')
    `).run(passwordHash);
  }
}

function auditLog(userId, action, entityType, entityId, details) {
  try {
    db.prepare(`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
      VALUES (?, ?, ?, ?, ?)
    `).run(userId || null, action, entityType || null, entityId ? String(entityId) : null, details ? JSON.stringify(details) : null);
  } catch (err) {
    console.error('Audit log error:', err.message);
  }
}

module.exports = { db, initDb, auditLog };
