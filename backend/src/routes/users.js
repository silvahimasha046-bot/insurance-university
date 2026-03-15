const express = require('express');
const { db } = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// All user routes require authentication
router.use(authenticate);

// GET /api/users/me – get current user profile
router.get('/me', (req, res) => {
  try {
    const user = db.prepare('SELECT id, name, email, role, created_at FROM users WHERE id = ?').get(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/users/sessions – get all sessions belonging to the current user
router.get('/sessions', (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;
    const sessions = db.prepare(
      'SELECT * FROM sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?'
    ).all(req.user.id, parseInt(limit, 10), parseInt(offset, 10));

    const total = db.prepare('SELECT COUNT(*) AS cnt FROM sessions WHERE user_id = ?').get(req.user.id).cnt;

    res.json({ sessions, total, limit: parseInt(limit, 10), offset: parseInt(offset, 10) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/users/sessions/:id/resume – resume a session with full context
router.get('/sessions/:id/resume', (req, res) => {
  try {
    const session = db.prepare('SELECT * FROM sessions WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!session) return res.status(404).json({ error: 'Session not found or not owned by current user' });

    const disclosures = db.prepare('SELECT * FROM disclosures WHERE session_id = ?').all(req.params.id);
    const recommendations = db.prepare(`
      SELECT r.*, p.name AS policy_name, p.type AS policy_type, p.premium_base, p.features
      FROM recommendations r
      JOIN policies p ON r.policy_id = p.id
      WHERE r.session_id = ? ORDER BY r.rank ASC
    `).all(req.params.id);

    const proposals = db.prepare('SELECT * FROM proposals WHERE session_id = ?').all(req.params.id);
    const feedback = db.prepare('SELECT * FROM feedback WHERE session_id = ?').all(req.params.id);

    res.json({
      session,
      disclosures,
      recommendations: recommendations.map(r => ({
        ...r,
        features: r.features ? JSON.parse(r.features) : []
      })),
      proposals: proposals.map(p => ({
        ...p,
        proposal_data: p.proposal_data ? JSON.parse(p.proposal_data) : null
      })),
      feedback
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
