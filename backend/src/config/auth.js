const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

// Tokens must never be signed with a guessable default secret.
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16) {
  throw new Error('JWT_SECRET is missing or too short (min 16 chars). Set it in backend/.env before starting the server.');
}

module.exports = {
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h'
};
