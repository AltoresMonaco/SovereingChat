const jwt = require('jsonwebtoken');
const crypto = require('node:crypto');

const {
  EVENT_QR_DYNAMIC_TTL_SECONDS = 120,
  EVENT_STAMP_TTL_HOURS = 72,
  EVENT_QR_SECRET,
  JWT_SECRET,
} = process.env ?? {};

const getJwtSecret = () => {
  return EVENT_QR_SECRET || JWT_SECRET || 'change_me_event_qr_secret';
};

/**
 * Signs a QR token for a given stand with a short-lived TTL.
 * payload: { stand: 'A' | 'B', nonce: string }
 */
function signQrToken({ stand, nonce }) {
  const ttlSec = Math.max(parseInt(EVENT_QR_DYNAMIC_TTL_SECONDS, 10) || 120, 10);
  const nowSec = Math.floor(Date.now() / 1000);
  const exp = nowSec + ttlSec;
  return jwt.sign({ stand, nonce, iat: nowSec, exp }, getJwtSecret());
}

/**
 * Verifies a QR token and returns its payload if valid.
 */
function verifyQrToken(token) {
  const payload = jwt.verify(token, getJwtSecret());
  return payload;
}

/**
 * Verify static token: allow tokens without exp when EVENT_QR_STATIC=true.
 */
function verifyQrTokenAllowStatic(token) {
  try {
    return verifyQrToken(token);
  } catch (err) {
    if (process.env.EVENT_QR_STATIC === 'true' && err?.name === 'TokenExpiredError') {
      // If static mode, accept expired token by decoding without verification of exp
      const payload = jwt.decode(token);
      if (payload?.stand) return payload;
    }
    throw err;
  }
}

/**
 * Returns existing session id from cookies or generates a new one and sets cookie.
 */
function getOrCreateEventSessionId(req, res) {
  const cookieName = 'event_sid';
  const existing = req.cookies?.[cookieName];
  if (existing) {
    return existing;
  }
  const sid = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(36).slice(2)}`;

  const hours = Math.max(parseInt(EVENT_STAMP_TTL_HOURS, 10) || 72, 1);
  const maxAgeMs = hours * 60 * 60 * 1000;
  try {
    res.cookie(cookieName, sid, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: maxAgeMs,
      path: '/',
    });
  } catch (_) {
    res.setHeader('Set-Cookie', `${cookieName}=${sid}; Max-Age=${Math.floor(maxAgeMs / 1000)}; Path=/; HttpOnly; SameSite=Lax`);
  }
  return sid;
}

function getStampExpiryDate() {
  const hours = Math.max(parseInt(EVENT_STAMP_TTL_HOURS, 10) || 72, 1);
  const expires = new Date(Date.now() + hours * 60 * 60 * 1000);
  return expires;
}

module.exports = {
  signQrToken,
  verifyQrToken,
  verifyQrTokenAllowStatic,
  getOrCreateEventSessionId,
  getStampExpiryDate,
};


