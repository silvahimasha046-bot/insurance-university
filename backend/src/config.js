const JWT_SECRET = process.env.JWT_SECRET || 'insurance-jwt-secret-2024';

if (!process.env.JWT_SECRET) {
  console.warn('[WARNING] JWT_SECRET env variable is not set. Using insecure default — set JWT_SECRET in production.');
}

module.exports = { JWT_SECRET };
