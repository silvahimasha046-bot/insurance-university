const express = require('express');
const { db, auditLog } = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// All admin routes require authentication + admin role
router.use(authenticate, requireAdmin);

// ─── POLICIES ────────────────────────────────────────────────────────────────

// GET /api/admin/policies
router.get('/policies', (req, res) => {
  try {
    const policies = db.prepare('SELECT * FROM policies ORDER BY id ASC').all();
    const result = policies.map(p => ({
      ...p,
      features: p.features ? JSON.parse(p.features) : []
    }));
    res.json({ policies: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/policies
router.post('/policies', (req, res) => {
  try {
    const { name, type, description, min_age, max_age, min_income, max_income, coverage_type, premium_base, features, active } = req.body;

    if (!name || !type) {
      return res.status(400).json({ error: 'name and type are required' });
    }

    const featuresJson = features ? JSON.stringify(Array.isArray(features) ? features : [features]) : null;

    const result = db.prepare(`
      INSERT INTO policies (name, type, description, min_age, max_age, min_income, max_income, coverage_type, premium_base, features, active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(name, type, description || null, min_age || null, max_age || null, min_income || null, max_income || null, coverage_type || null, premium_base || null, featuresJson, active !== undefined ? active : 1);

    auditLog(req.user.id, 'create_policy', 'policies', result.lastInsertRowid, { name });

    const policy = db.prepare('SELECT * FROM policies WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ policy: { ...policy, features: policy.features ? JSON.parse(policy.features) : [] } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/policies/:id
router.get('/policies/:id', (req, res) => {
  try {
    const policy = db.prepare('SELECT * FROM policies WHERE id = ?').get(req.params.id);
    if (!policy) return res.status(404).json({ error: 'Policy not found' });

    const riders = db.prepare('SELECT * FROM policy_riders WHERE policy_id = ?').all(policy.id);
    res.json({ policy: { ...policy, features: policy.features ? JSON.parse(policy.features) : [] }, riders });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/admin/policies/:id
router.put('/policies/:id', (req, res) => {
  try {
    const policy = db.prepare('SELECT * FROM policies WHERE id = ?').get(req.params.id);
    if (!policy) return res.status(404).json({ error: 'Policy not found' });

    const fields = ['name', 'type', 'description', 'min_age', 'max_age', 'min_income', 'max_income', 'coverage_type', 'premium_base', 'active'];
    const updates = [];
    const values = [];

    for (const f of fields) {
      if (req.body[f] !== undefined) {
        updates.push(`${f} = ?`);
        values.push(req.body[f]);
      }
    }

    if (req.body.features !== undefined) {
      updates.push('features = ?');
      values.push(JSON.stringify(Array.isArray(req.body.features) ? req.body.features : [req.body.features]));
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(req.params.id);
    db.prepare(`UPDATE policies SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    auditLog(req.user.id, 'update_policy', 'policies', req.params.id, {});

    const updated = db.prepare('SELECT * FROM policies WHERE id = ?').get(req.params.id);
    res.json({ policy: { ...updated, features: updated.features ? JSON.parse(updated.features) : [] } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/policies/:id
router.delete('/policies/:id', (req, res) => {
  try {
    const policy = db.prepare('SELECT id FROM policies WHERE id = ?').get(req.params.id);
    if (!policy) return res.status(404).json({ error: 'Policy not found' });

    db.prepare('UPDATE policies SET active = 0 WHERE id = ?').run(req.params.id);
    auditLog(req.user.id, 'deactivate_policy', 'policies', req.params.id, {});
    res.json({ message: 'Policy deactivated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── RISK RULES ──────────────────────────────────────────────────────────────

// GET /api/admin/rules
router.get('/rules', (req, res) => {
  try {
    const rules = db.prepare('SELECT * FROM risk_rules ORDER BY id ASC').all();
    res.json({ rules });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/rules
router.post('/rules', (req, res) => {
  try {
    const { age_min, age_max, income_min, income_max, bmi_min, bmi_max, smoker, dependents_min, dependents_max, risk_level, risk_score, recommended_policy_type } = req.body;

    if (!risk_level || risk_score === undefined) {
      return res.status(400).json({ error: 'risk_level and risk_score are required' });
    }

    const result = db.prepare(`
      INSERT INTO risk_rules (age_min, age_max, income_min, income_max, bmi_min, bmi_max, smoker, dependents_min, dependents_max, risk_level, risk_score, recommended_policy_type)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(age_min || null, age_max || null, income_min || null, income_max || null, bmi_min || null, bmi_max || null, smoker || 'any', dependents_min || null, dependents_max || null, risk_level, risk_score, recommended_policy_type || null);

    auditLog(req.user.id, 'create_rule', 'risk_rules', result.lastInsertRowid, { risk_level });

    const rule = db.prepare('SELECT * FROM risk_rules WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ rule });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/rules/:id
router.get('/rules/:id', (req, res) => {
  try {
    const rule = db.prepare('SELECT * FROM risk_rules WHERE id = ?').get(req.params.id);
    if (!rule) return res.status(404).json({ error: 'Rule not found' });
    res.json({ rule });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/admin/rules/:id
router.put('/rules/:id', (req, res) => {
  try {
    const rule = db.prepare('SELECT id FROM risk_rules WHERE id = ?').get(req.params.id);
    if (!rule) return res.status(404).json({ error: 'Rule not found' });

    const fields = ['age_min', 'age_max', 'income_min', 'income_max', 'bmi_min', 'bmi_max', 'smoker', 'dependents_min', 'dependents_max', 'risk_level', 'risk_score', 'recommended_policy_type'];
    const updates = [];
    const values = [];

    for (const f of fields) {
      if (req.body[f] !== undefined) {
        updates.push(`${f} = ?`);
        values.push(req.body[f]);
      }
    }

    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

    values.push(req.params.id);
    db.prepare(`UPDATE risk_rules SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    auditLog(req.user.id, 'update_rule', 'risk_rules', req.params.id, {});

    const updated = db.prepare('SELECT * FROM risk_rules WHERE id = ?').get(req.params.id);
    res.json({ rule: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/rules/:id
router.delete('/rules/:id', (req, res) => {
  try {
    const rule = db.prepare('SELECT id FROM risk_rules WHERE id = ?').get(req.params.id);
    if (!rule) return res.status(404).json({ error: 'Rule not found' });

    db.prepare('DELETE FROM risk_rules WHERE id = ?').run(req.params.id);
    auditLog(req.user.id, 'delete_rule', 'risk_rules', req.params.id, {});
    res.json({ message: 'Rule deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── SESSIONS ────────────────────────────────────────────────────────────────

// GET /api/admin/sessions
router.get('/sessions', (req, res) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query;
    let query = 'SELECT s.*, u.name AS user_name, u.email AS user_email FROM sessions s LEFT JOIN users u ON s.user_id = u.id';
    const params = [];

    if (status) {
      query += ' WHERE s.status = ?';
      params.push(status);
    }

    query += ' ORDER BY s.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit, 10), parseInt(offset, 10));

    const sessions = db.prepare(query).all(...params);
    const total = db.prepare('SELECT COUNT(*) AS cnt FROM sessions' + (status ? ' WHERE status = ?' : '')).get(...(status ? [status] : [])).cnt;

    res.json({ sessions, total, limit: parseInt(limit, 10), offset: parseInt(offset, 10) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/sessions/:id
router.get('/sessions/:id', (req, res) => {
  try {
    const session = db.prepare(`
      SELECT s.*, u.name AS user_name, u.email AS user_email
      FROM sessions s LEFT JOIN users u ON s.user_id = u.id
      WHERE s.id = ?
    `).get(req.params.id);

    if (!session) return res.status(404).json({ error: 'Session not found' });

    const disclosures = db.prepare('SELECT * FROM disclosures WHERE session_id = ?').all(req.params.id);
    const recommendations = db.prepare('SELECT r.*, p.name AS policy_name FROM recommendations r JOIN policies p ON r.policy_id = p.id WHERE r.session_id = ? ORDER BY r.rank ASC').all(req.params.id);
    const feedback = db.prepare('SELECT * FROM feedback WHERE session_id = ?').all(req.params.id);
    const metadata = db.prepare('SELECT * FROM session_metadata WHERE session_id = ?').all(req.params.id);

    res.json({ session, disclosures, recommendations, feedback, metadata });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── TRAINING DATA ───────────────────────────────────────────────────────────

// POST /api/admin/training-data
router.post('/training-data', (req, res) => {
  try {
    const { age, income, dependents, bmi, smoker, risk_score, recommended_policy } = req.body;

    if (age === undefined || income === undefined) {
      return res.status(400).json({ error: 'age and income are required' });
    }

    const result = db.prepare(`
      INSERT INTO training_data (age, income, dependents, bmi, smoker, risk_score, recommended_policy)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(age, income, dependents || 0, bmi || null, smoker !== undefined ? (smoker ? 1 : 0) : null, risk_score || null, recommended_policy || null);

    auditLog(req.user.id, 'create_training_data', 'training_data', result.lastInsertRowid, {});

    const row = db.prepare('SELECT * FROM training_data WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ training_data: row });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/training-data
router.get('/training-data', (req, res) => {
  try {
    const { limit = 100, offset = 0 } = req.query;
    const rows = db.prepare('SELECT * FROM training_data ORDER BY id ASC LIMIT ? OFFSET ?').all(parseInt(limit, 10), parseInt(offset, 10));
    const total = db.prepare('SELECT COUNT(*) AS cnt FROM training_data').get().cnt;
    res.json({ training_data: rows, total });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── AUDIT LOGS ──────────────────────────────────────────────────────────────

// GET /api/admin/logs
router.get('/logs', (req, res) => {
  try {
    const { limit = 100, offset = 0, user_id, action } = req.query;
    let query = 'SELECT l.*, u.email AS user_email FROM audit_logs l LEFT JOIN users u ON l.user_id = u.id WHERE 1=1';
    const params = [];

    if (user_id) { query += ' AND l.user_id = ?'; params.push(user_id); }
    if (action) { query += ' AND l.action LIKE ?'; params.push(`%${action}%`); }

    query += ' ORDER BY l.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit, 10), parseInt(offset, 10));

    const logs = db.prepare(query).all(...params);
    res.json({ logs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
