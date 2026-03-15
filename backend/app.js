const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const { initDb } = require('./src/db');
const authRoutes = require('./src/routes/auth');
const sessionRoutes = require('./src/routes/sessions');
const proposalRoutes = require('./src/routes/proposals');
const adminRoutes = require('./src/routes/admin');
const userRoutes = require('./src/routes/users');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: '*' }));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Initialize database (creates schema and seeds data)
initDb();

app.use('/api/auth', authRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/proposals', proposalRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/users', userRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Insurance Advisory API running on port ${PORT}`);
});

module.exports = app;
