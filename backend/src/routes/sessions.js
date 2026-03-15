const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db, auditLog } = require('../db');
const { authenticate } = require('../middleware/auth');
const { generateRecommendations } = require('../recommendation');

const router = express.Router();

// POST /api/sessions – create a new advisory session
router.post('/', (req, res) => {
  try {
    const { language, source, policy_type } = req.body;
    const userId = req.user ? req.user.id : null;

    const sessionId = uuidv4();
    const sessionToken = uuidv4();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO sessions (id, user_id, session_token, language, status, policy_type, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'active', ?, ?, ?)
    `).run(sessionId, userId, sessionToken, language || 'en', policy_type || null, now, now);

    // Record metadata
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || null;
    const ua = req.headers['user-agent'] || null;
    db.prepare(`
      INSERT INTO session_metadata (session_id, source, ip_address, user_agent, timestamp)
      VALUES (?, ?, ?, ?, ?)
    `).run(sessionId, source || 'web', ip, ua, now);

    const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId);
    auditLog(userId, 'create_session', 'sessions', sessionId, {});

    res.status(201).json({ session, session_token: sessionToken });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/sessions/:id – get session by id
router.get('/:id', (req, res) => {
  try {
    const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const metadata = db.prepare('SELECT * FROM session_metadata WHERE session_id = ?').all(req.params.id);
    res.json({ session, metadata });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/sessions/:id/consent – record consent
router.post('/:id/consent', (req, res) => {
  try {
    const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    db.prepare("UPDATE sessions SET consent_given = 1, updated_at = ? WHERE id = ?")
      .run(new Date().toISOString(), req.params.id);

    auditLog(null, 'consent_given', 'sessions', req.params.id, {});
    res.json({ message: 'Consent recorded', session_id: req.params.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/sessions/:id/consent – revoke consent
router.delete('/:id/consent', (req, res) => {
  try {
    const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    db.prepare("UPDATE sessions SET consent_given = 0, updated_at = ? WHERE id = ?")
      .run(new Date().toISOString(), req.params.id);

    auditLog(null, 'consent_revoked', 'sessions', req.params.id, {});
    res.json({ message: 'Consent revoked', session_id: req.params.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/sessions/:id/disclosures – add/update disclosure answers
router.post('/:id/disclosures', (req, res) => {
  try {
    const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const { disclosures } = req.body; // expected: { key: value, ... }
    if (!disclosures || typeof disclosures !== 'object') {
      return res.status(400).json({ error: 'disclosures object required' });
    }

    const now = new Date().toISOString();
    const upsert = db.prepare(`
      INSERT INTO disclosures (session_id, question_key, answer, created_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT (session_id, question_key) DO UPDATE SET answer = excluded.answer
    `);

    const insertMany = db.transaction(() => {
      for (const [key, value] of Object.entries(disclosures)) {
        upsert.run(req.params.id, key, String(value), now);
      }
    });
    insertMany();

    db.prepare("UPDATE sessions SET updated_at = ? WHERE id = ?").run(now, req.params.id);

    const all = db.prepare('SELECT * FROM disclosures WHERE session_id = ?').all(req.params.id);
    res.status(201).json({ disclosures: all });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/sessions/:id/disclosures – get all disclosures
router.get('/:id/disclosures', (req, res) => {
  try {
    const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const disclosures = db.prepare('SELECT * FROM disclosures WHERE session_id = ?').all(req.params.id);
    res.json({ disclosures });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/sessions/:id/disclosures/:key – update a single disclosure
router.put('/:id/disclosures/:key', (req, res) => {
  try {
    const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const { answer } = req.body;
    if (answer === undefined) {
      return res.status(400).json({ error: 'answer is required' });
    }

    const existing = db.prepare('SELECT id FROM disclosures WHERE session_id = ? AND question_key = ?')
      .get(req.params.id, req.params.key);

    const now = new Date().toISOString();
    if (existing) {
      db.prepare('UPDATE disclosures SET answer = ? WHERE session_id = ? AND question_key = ?')
        .run(String(answer), req.params.id, req.params.key);
    } else {
      db.prepare('INSERT INTO disclosures (session_id, question_key, answer, created_at) VALUES (?, ?, ?, ?)')
        .run(req.params.id, req.params.key, String(answer), now);
    }

    db.prepare("UPDATE sessions SET updated_at = ? WHERE id = ?").run(now, req.params.id);

    const disclosure = db.prepare('SELECT * FROM disclosures WHERE session_id = ? AND question_key = ?')
      .get(req.params.id, req.params.key);
    res.json({ disclosure });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/sessions/:id/recommendations – compute and return recommendations
router.get('/:id/recommendations', (req, res) => {
  try {
    const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    // Build disclosure map
    const rows = db.prepare('SELECT question_key, answer FROM disclosures WHERE session_id = ?').all(req.params.id);
    const disclosureMap = {};
    for (const row of rows) {
      disclosureMap[row.question_key] = row.answer;
    }

    const scored = generateRecommendations(req.params.id, disclosureMap);

    // Delete previous recommendations for this session and store fresh ones
    db.prepare('DELETE FROM recommendations WHERE session_id = ?').run(req.params.id);

    const insert = db.prepare(`
      INSERT INTO recommendations (session_id, policy_id, suitability_score, affordability_score, explanation, rank, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const now = new Date().toISOString();
    const saveAll = db.transaction(() => {
      for (const r of scored) {
        insert.run(r.session_id, r.policy_id, r.suitability_score, r.affordability_score, r.explanation, r.rank, now);
      }
    });
    saveAll();

    // Fetch stored recommendations with policy details
    const recommendations = db.prepare(`
      SELECT r.*, p.name AS policy_name, p.type AS policy_type, p.description, p.premium_base,
             p.coverage_type, p.features, p.min_age, p.max_age, p.min_income
      FROM recommendations r
      JOIN policies p ON r.policy_id = p.id
      WHERE r.session_id = ?
      ORDER BY r.rank ASC
    `).all(req.params.id);

    // Parse features JSON
    const result = recommendations.map(r => ({
      ...r,
      features: r.features ? JSON.parse(r.features) : []
    }));

    res.json({ recommendations: result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/sessions/:id/feedback – submit session feedback
router.post('/:id/feedback', (req, res) => {
  try {
    const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const { rating, comments } = req.body;
    if (rating === undefined) {
      return res.status(400).json({ error: 'rating is required' });
    }

    const ratingNum = parseInt(rating, 10);
    if (ratingNum < 1 || ratingNum > 5) {
      return res.status(400).json({ error: 'rating must be between 1 and 5' });
    }

    const now = new Date().toISOString();
    const result = db.prepare(
      'INSERT INTO feedback (session_id, rating, comments, created_at) VALUES (?, ?, ?, ?)'
    ).run(req.params.id, ratingNum, comments || null, now);

    db.prepare("UPDATE sessions SET status = 'completed', updated_at = ? WHERE id = ?").run(now, req.params.id);

    const fb = db.prepare('SELECT * FROM feedback WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ feedback: fb });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
