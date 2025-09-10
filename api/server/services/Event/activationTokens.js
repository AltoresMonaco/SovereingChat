const jwt = require('jsonwebtoken');
const crypto = require('node:crypto');

const {
  EVENT_ACTIVATION_TTL_DAYS = 14,
  EVENT_ACTIVATION_SECRET,
  JWT_SECRET,
} = process.env ?? {};

function getActivationSecret() {
  return EVENT_ACTIVATION_SECRET || JWT_SECRET || 'change_me_event_activation_secret';
}

/**
 * Signs an activation token for a lead with TTL in days.
 * payload: { lead_id: string, email: string }
 */
function signActivationToken({ lead_id, email }) {
  const days = Math.max(parseInt(EVENT_ACTIVATION_TTL_DAYS, 10) || 14, 1);
  const nowSec = Math.floor(Date.now() / 1000);
  const exp = nowSec + days * 24 * 60 * 60;
  return jwt.sign({ lead_id, email, iat: nowSec, exp }, getActivationSecret());
}

function verifyActivationToken(token) {
  return jwt.verify(token, getActivationSecret());
}

function hashTokenSha256(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function getActivationExpiryDate() {
  const days = Math.max(parseInt(EVENT_ACTIVATION_TTL_DAYS, 10) || 14, 1);
  const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  return expires;
}

module.exports = {
  signActivationToken,
  verifyActivationToken,
  hashTokenSha256,
  getActivationExpiryDate,
};


