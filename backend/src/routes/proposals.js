const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db, auditLog } = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// POST /api/proposals – generate a proposal from a session's top recommendation
router.post('/', authenticate, (req, res) => {
  try {
    const { session_id, policy_id } = req.body;

    if (!session_id) {
      return res.status(400).json({ error: 'session_id is required' });
    }

    const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(session_id);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    // Resolve policy: use provided policy_id or top recommendation
    let policyId = policy_id;
    if (!policyId) {
      const topRec = db.prepare(
        'SELECT policy_id FROM recommendations WHERE session_id = ? ORDER BY rank ASC LIMIT 1'
      ).get(session_id);
      if (!topRec) return res.status(400).json({ error: 'No recommendations found for session. Run GET /sessions/:id/recommendations first.' });
      policyId = topRec.policy_id;
    }

    const policy = db.prepare('SELECT * FROM policies WHERE id = ?').get(policyId);
    if (!policy) return res.status(404).json({ error: 'Policy not found' });

    const recommendation = db.prepare(
      'SELECT * FROM recommendations WHERE session_id = ? AND policy_id = ? ORDER BY created_at DESC LIMIT 1'
    ).get(session_id, policyId);

    const disclosures = db.prepare('SELECT question_key, answer FROM disclosures WHERE session_id = ?').all(session_id);
    const disclosureMap = {};
    for (const d of disclosures) disclosureMap[d.question_key] = d.answer;

    const riders = db.prepare('SELECT * FROM policy_riders WHERE policy_id = ?').all(policyId);

    const proposalData = {
      session_id,
      policy: {
        ...policy,
        features: policy.features ? JSON.parse(policy.features) : []
      },
      riders,
      client_profile: disclosureMap,
      recommendation: recommendation || null,
      generated_at: new Date().toISOString()
    };

    const proposalId = uuidv4();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO proposals (id, session_id, policy_id, status, proposal_data, created_at, updated_at)
      VALUES (?, ?, ?, 'draft', ?, ?, ?)
    `).run(proposalId, session_id, policyId, JSON.stringify(proposalData), now, now);

    auditLog(req.user.id, 'create_proposal', 'proposals', proposalId, { session_id, policy_id: policyId });

    const proposal = db.prepare('SELECT * FROM proposals WHERE id = ?').get(proposalId);
    res.status(201).json({
      proposal: {
        ...proposal,
        proposal_data: JSON.parse(proposal.proposal_data)
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/proposals/:id – get a proposal
router.get('/:id', authenticate, (req, res) => {
  try {
    const proposal = db.prepare('SELECT * FROM proposals WHERE id = ?').get(req.params.id);
    if (!proposal) return res.status(404).json({ error: 'Proposal not found' });

    res.json({
      proposal: {
        ...proposal,
        proposal_data: JSON.parse(proposal.proposal_data)
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/proposals/:id – update proposal status or data
router.put('/:id', authenticate, (req, res) => {
  try {
    const proposal = db.prepare('SELECT * FROM proposals WHERE id = ?').get(req.params.id);
    if (!proposal) return res.status(404).json({ error: 'Proposal not found' });

    const { status, proposal_data } = req.body;

    if (proposal_data !== undefined && (typeof proposal_data !== 'object' || Array.isArray(proposal_data))) {
      return res.status(400).json({ error: 'proposal_data must be a JSON object' });
    }
    const now = new Date().toISOString();

    const newStatus = status || proposal.status;
    const newData = proposal_data ? JSON.stringify(proposal_data) : proposal.proposal_data;

    db.prepare('UPDATE proposals SET status = ?, proposal_data = ?, updated_at = ? WHERE id = ?')
      .run(newStatus, newData, now, req.params.id);

    auditLog(req.user.id, 'update_proposal', 'proposals', req.params.id, { status: newStatus });

    const updated = db.prepare('SELECT * FROM proposals WHERE id = ?').get(req.params.id);
    res.json({
      proposal: {
        ...updated,
        proposal_data: JSON.parse(updated.proposal_data)
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/proposals/:id/export – export proposal as JSON
router.get('/:id/export', authenticate, (req, res) => {
  try {
    const proposal = db.prepare('SELECT * FROM proposals WHERE id = ?').get(req.params.id);
    if (!proposal) return res.status(404).json({ error: 'Proposal not found' });

    const exportData = {
      export_type: 'insurance_proposal',
      export_timestamp: new Date().toISOString(),
      proposal_id: proposal.id,
      session_id: proposal.session_id,
      policy_id: proposal.policy_id,
      status: proposal.status,
      created_at: proposal.created_at,
      updated_at: proposal.updated_at,
      details: JSON.parse(proposal.proposal_data)
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="proposal-${proposal.id}.json"`);
    res.json(exportData);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
