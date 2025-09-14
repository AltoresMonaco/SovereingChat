const express = require('express');
const { EventStamp, EventLead, EventVoucher } = require('~/db/models');
const { logMetric } = require('~/server/services/Event/metrics');
const { verifyQrTokenAllowStatic, getOrCreateEventSessionId, getStampExpiryDate } = require('~/server/services/Event/qrTokens');
const { QcmAttempt } = require('~/db/models');
const { isEmailDomainAllowed } = require('~/server/services/domains');
const { getAppConfig } = require('~/server/services/Config');
const {
  signActivationToken,
  verifyActivationToken,
  hashTokenSha256,
  getActivationExpiryDate,
} = require('~/server/services/Event/activationTokens');
const router = express.Router();
const { createIpLimiter } = require('~/server/middleware/limiters');
const stampLimiter = createIpLimiter(40, 1);
const leadLimiter = createIpLimiter(20, 1);
const qcmLimiter = createIpLimiter(5, 1);
const { getQuestions, submitAnswers } = require('~/server/services/Event/qcm');
const MAX_GATE_ATTEMPTS = 3;
const GATE_COOLDOWN_MINUTES = 10;
const crypto = require('node:crypto');

// Public endpoints (no auth)
router.post('/stamp', stampLimiter, async (req, res) => {
  try {
    const { token } = req.body || {};
    if (!token) {
      return res.status(400).json({ error: 'Missing token' });
    }

    let payload;
    try {
      payload = verifyQrTokenAllowStatic(token);
    } catch (err) {
      return res.status(400).json({ error: 'Invalid or expired token' });
    }

    const { stand, nonce } = payload || {};
    if (!stand || !nonce || !['A', 'B'].includes(stand)) {
      return res.status(400).json({ error: 'Invalid token payload' });
    }

    const session_id = getOrCreateEventSessionId(req, res);
    const expires_at = getStampExpiryDate();

    const update = {
      session_id,
      stand,
      source: 'qr',
      issued_at: new Date(),
      expires_at,
      nonce,
    };

    await EventStamp.updateOne({ session_id, stand }, { $setOnInsert: update }, { upsert: true });
    await logMetric('stamp_scanned', { stand, session_id });

    const stamps = await EventStamp.find({ session_id }).select('stand').lean();
    const stands_scanned = [...new Set(stamps.map((s) => s.stand))];
    const count = stands_scanned.length;
    const required = 2;
    const completed = count >= required;
    const already_scanned = stamps.some((s) => s.stand === stand);

    return res.status(200).json({
      progress: { stands_scanned, count, required },
      already_scanned,
      completed,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/progress', async (req, res) => {
  try {
    const session_id = getOrCreateEventSessionId(req, res);
    const stamps = await EventStamp.find({ session_id }).select('stand').lean();
    const stands_scanned = [...new Set(stamps.map((s) => s.stand))];
    const count = stands_scanned.length;
    const required = 2;
    const qcm = await QcmAttempt.findOne({ session_id }).select('passed').lean();
    const eligible = count >= required || !!qcm?.passed;
    return res.status(200).json({ stands_scanned, count, required, eligible });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/lead', leadLimiter, async (req, res) => {
  try {
    const { email, company, seats_requested, consent_transactional, consent_marketing } = req.body || {};
    if (!email || !company || !seats_requested || consent_transactional == null) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    if (process.env.BLOCK_WEBMAILS === 'true') {
      const { isWebmail } = require('~/server/services/emailValidation');
      if (isWebmail(email)) {
        return res.status(403).json({ error: 'Webmail addresses are not allowed' });
      }
    }
    const session_id = getOrCreateEventSessionId(req, res);
    const stamps = await EventStamp.find({ session_id }).select('stand').lean();
    const stands_scanned = [...new Set(stamps.map((s) => s.stand))];
    const stamps_completed = stands_scanned.length >= 2;
    const qcm = await QcmAttempt.findOne({ session_id }).select('passed').lean();
    const eligible = stamps_completed || !!qcm?.passed;
    if (!eligible) {
      return res.status(403).json({ error: 'Not eligible yet (need 2/2 or QCM pass)' });
    }

    const expires_at = getActivationExpiryDate();
    const token = signActivationToken({ lead_id: 'pending', email });
    const activation_token_hash = hashTokenSha256(token);
    const activation_url = `/event/activation/${token}`;

    const lead = await EventLead.create({
      email,
      company,
      domain: email.split('@')[1] || '',
      seats_requested: Number(seats_requested),
      consent_transactional: !!consent_transactional,
      consent_marketing: !!consent_marketing,
      stamps_completed,
      activation_token_hash,
      activation_url,
      voucher_id: null,
      status: 'pending',
      expires_at,
    });
    // Re-sign token with actual lead_id for integrity (optional flow simplification: keep first token)
    // Keeping initial token for now; front-end uses provided URL.
    await logMetric('lead_created', { email, company, seats_requested });

    return res.status(200).json({ lead_id: lead._id, activation_url });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/** Issue validation code (screen fallback) */
const issueCodeLimiter = createIpLimiter(5, 1);
router.post('/issue-code', issueCodeLimiter, async (req, res) => {
  try {
    const session_id = getOrCreateEventSessionId(req, res);
    const stamps = await EventStamp.find({ session_id }).select('stand').lean();
    const stands_scanned = [...new Set(stamps.map((s) => s.stand))];
    const qcm = await QcmAttempt.findOne({ session_id }).select('passed').lean();
    const eligible = stands_scanned.length >= 2 || !!qcm?.passed;
    if (!eligible) {
      return res.status(403).json({ error: 'Not eligible yet' });
    }

    const { email } = req.body || {};
    if (!email) return res.status(400).json({ error: 'Missing email' });

    const codeLength = parseInt(process.env.EVENT_CODE_LENGTH || '6', 10);
    const rawCode = (Math.random().toString().slice(2) + Date.now()).slice(0, Math.max(4, codeLength));
    const hash = crypto.createHash('sha256').update(rawCode).digest('hex');

    const today = new Date(); today.setHours(0,0,0,0);
    const now = new Date();

    let lead = await EventLead.findOne({ email });
    if (!lead) return res.status(404).json({ error: 'Lead not found for email' });
    // Per-email/day limit: 3/day
    if (lead.code_issue_date && lead.code_issue_date >= today && (lead.code_issue_count || 0) >= 3) {
      return res.status(429).json({ error: 'Daily limit reached for code issuance' });
    }
    const update = {
      validation_code_hash: hash,
      validation_sent_at: now,
      code_issue_date: today,
      code_issue_count: (lead.code_issue_date && lead.code_issue_date >= today ? (lead.code_issue_count || 0) + 1 : 1),
    };
    lead = await EventLead.findOneAndUpdate({ email }, { $set: update }, { new: true });
    if (!lead) return res.status(404).json({ error: 'Lead not found for email' });

    await logMetric('code_issued', { email });
    // Fallback: screen delivery (zéro‑egress)
    return res.status(200).json({ delivered: 'screen', code: rawCode });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/** Request an org voucher after eligibility (seats <= cap, domain must be pro if BLOCK_WEBMAILS=true) */
router.post('/request-org-voucher', async (req, res) => {
  try {
    const session_id = getOrCreateEventSessionId(req, res);
    const stamps = await EventStamp.find({ session_id }).select('stand').lean();
    const stands_scanned = [...new Set(stamps.map((s) => s.stand))];
    const qcm = await QcmAttempt.findOne({ session_id }).select('passed').lean();
    const eligible = stands_scanned.length >= 2 || !!qcm?.passed;
    if (!eligible) return res.status(403).json({ error: 'Not eligible yet' });

    const { email, seats } = req.body || {};
    if (!email) return res.status(400).json({ error: 'Missing email' });
    const domain = (email.split('@')[1] || '').toLowerCase();
    if (process.env.BLOCK_WEBMAILS === 'true') {
      const appConfig = await getAppConfig();
      const allowed = isEmailDomainAllowed(email, appConfig?.registration?.allowedDomains);
      if (!allowed) return res.status(403).json({ error: 'Email domain not allowed' });
    }

    const reqSeats = Math.max(1, Math.min(Number(seats || 1), Number(process.env.EVENT_MAX_SEATS_ABSOLUTE || 10), Number(process.env.EVENT_DEFAULT_MAX_SEATS || 5)));
    const voucher_id = `EVT_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await EventVoucher.create({
      voucher_id,
      org_id: voucher_id,
      allowed_domains: [domain],
      max_seats: reqSeats,
      redemptions_count: 0,
      models_allowlist: [],
      org_daily_token_cap: Number(process.env.EVENT_ORG_DAILY_TOKEN_CAP || 1000000),
      expires_at: null,
      status: 'active',
    });
    return res.status(200).json({ voucher_id, allowed_domains: [domain], max_seats: reqSeats });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/issue-voucher', async (req, res) => {
  try {
    const { type, allowed_domains = [], max_seats } = req.body || {};
    if (!type || (type === 'org' && (!Array.isArray(allowed_domains) || allowed_domains.length === 0))) {
      return res.status(400).json({ error: 'Invalid voucher parameters' });
    }
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ error: 'Not allowed here. Use /api/admin/event endpoints.' });
    }
    const voucher_id = `EVT_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const voucher = await EventVoucher.create({
      voucher_id,
      org_id: voucher_id,
      allowed_domains: type === 'org' ? allowed_domains : [],
      max_seats: Math.min(Number(max_seats || process.env.EVENT_DEFAULT_MAX_SEATS || 5), Number(process.env.EVENT_MAX_SEATS_ABSOLUTE || 10)),
      redemptions_count: 0,
      models_allowlist: [],
      org_daily_token_cap: Number(process.env.EVENT_ORG_DAILY_TOKEN_CAP || 1000000),
      expires_at: null,
      status: 'active',
    });
    await logMetric('voucher_issued', { voucher_id, type });
    return res.status(200).json({ voucher_id: voucher.voucher_id });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/activation/:token', async (req, res) => {
  try {
    const { token } = req.params;
    let payload;
    try {
      payload = verifyActivationToken(token);
    } catch (err) {
      return res.status(400).json({ error: 'Invalid or expired activation token' });
    }

    const token_hash = hashTokenSha256(token);
    const lead = await EventLead.findOne({ activation_token_hash: token_hash }).lean();
    if (!lead) {
      return res.status(404).json({ error: 'Activation not found' });
    }
    if (lead.status === 'activated') {
      return res.status(409).json({ error: 'Already activated' });
    }
    return res.status(200).json({ ok: true, email: lead.email, company: lead.company, seats_requested: lead.seats_requested });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// QCM Endpoints
router.get('/qcm/questions', qcmLimiter, getQuestions);
router.post('/qcm/submit', qcmLimiter, submitAnswers);

/**
 * MCBusiness2K25 single-question gate
 */
router.get('/mcbusiness2k25/question', qcmLimiter, async (req, res) => {
  // Static question and options
  return res.status(200).json({
    id: 'grimaldi-year',
    stem: "En quelle année François Grimaldi a-t-il pris le Rocher ?",
    choices: [
      { id: '1215', label: '1215' },
      { id: '1297', label: '1297' },
      { id: '1419', label: '1419' },
      { id: '1512', label: '1512' },
    ],
  });
});

router.post('/mcbusiness2k25/answer', qcmLimiter, async (req, res) => {
  try {
    const session_id = getOrCreateEventSessionId(req, res);
    const { choice } = req.body || {};
    if (!choice) return res.status(400).json({ error: 'Missing choice' });

    // track attempts and cooldown using QcmAttempt
    let attempt = await QcmAttempt.findOne({ session_id });
    const now = new Date();
    if (!attempt) {
      attempt = await QcmAttempt.create({ session_id, attempts_count: 0, last_attempt_at: null, cooldown_until: null, passed: false });
    }
    if (attempt.passed) {
      return res.status(200).json({ correct: true, attempts_left: Math.max(0, MAX_GATE_ATTEMPTS - attempt.attempts_count) });
    }
    if (attempt.cooldown_until && attempt.cooldown_until > now) {
      return res.status(429).json({ error: 'Cooldown active', retry_after: attempt.cooldown_until.toISOString() });
    }
    if (attempt.attempts_count >= MAX_GATE_ATTEMPTS) {
      return res.status(429).json({ error: 'Max attempts reached' });
    }

    const correct = choice === '1297';
    attempt.attempts_count += 1;
    attempt.last_attempt_at = now;
    if (!correct && attempt.attempts_count >= MAX_GATE_ATTEMPTS) {
      attempt.cooldown_until = new Date(now.getTime() + GATE_COOLDOWN_MINUTES * 60 * 1000);
    }
    if (correct) attempt.passed = true;
    await attempt.save();
    await logMetric('qcm_attempt', { session_id, passed: correct, correct: correct ? 1 : 0, total: 1 });
    return res.status(200).json({ correct, attempts_left: Math.max(0, MAX_GATE_ATTEMPTS - attempt.attempts_count), cooldown_ms: attempt.cooldown_until ? Math.max(0, attempt.cooldown_until - now) : undefined });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Pre-form submission after gate
 */
router.post('/pre-form', leadLimiter, async (req, res) => {
  try {
    const session_id = getOrCreateEventSessionId(req, res);
    const gate = await QcmAttempt.findOne({ session_id }).select('passed').lean();
    if (!gate?.passed) {
      return res.status(403).json({ error: 'Gate not passed' });
    }
    const { first_name, last_name, email, use_case, consent_transactional, consent_marketing } = req.body || {};
    if (!first_name || !last_name || !email || consent_transactional == null) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    if (process.env.BLOCK_WEBMAILS === 'true') {
      const { isWebmail } = require('~/server/services/emailValidation');
      if (isWebmail(email)) {
        return res.status(403).json({ error: 'Webmail addresses are not allowed' });
      }
    }
    const expires_at = getActivationExpiryDate();
    const domain = (email.split('@')[1] || '').toLowerCase();
    const lead = await EventLead.create({
      email,
      first_name,
      last_name,
      use_case: use_case || '',
      qcm_gate_passed: true,
      consent_transactional: !!consent_transactional,
      consent_marketing: !!consent_marketing,
      // legacy optional fields
      company: '',
      domain,
      seats_requested: 1,
      stamps_completed: false,
      status: 'pending',
      expires_at,
    });
    await logMetric('lead_created', { email, first_name, last_name });
    return res.status(200).json({ ok: true, lead_id: lead._id });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;


