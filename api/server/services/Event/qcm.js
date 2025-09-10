const fs = require('fs');
const path = require('path');
const { QcmAttempt, EventStamp } = require('~/db/models');
const { getOrCreateEventSessionId } = require('~/server/services/Event/qrTokens');
const { logMetric } = require('~/server/services/Event/metrics');

const MAX_ATTEMPTS = 3;
const COOLDOWN_MINUTES = 10;

function loadBank() {
  const p = path.resolve(__dirname, 'qcmBank.monaco.json');
  const raw = fs.readFileSync(p, 'utf8');
  return JSON.parse(raw);
}

function pickDeterministicQuestions(bank, sessionId, count = 5) {
  // Simple deterministic pseudo-random based on sessionId
  let seed = 0;
  for (let i = 0; i < sessionId.length; i++) seed = (seed * 31 + sessionId.charCodeAt(i)) >>> 0;
  const picked = [];
  const used = new Set();
  while (picked.length < Math.min(count, bank.length)) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const idx = seed % bank.length;
    if (!used.has(idx)) {
      used.add(idx);
      const { id, q, choices } = bank[idx];
      picked.push({ id, q, choices });
    }
  }
  return picked;
}

async function getQuestions(req, res) {
  const session_id = getOrCreateEventSessionId(req, res);
  const bank = loadBank();
  const questions = pickDeterministicQuestions(bank, session_id, 5);
  return res.status(200).json({ session_id, questions });
}

async function submitAnswers(req, res) {
  const session_id = getOrCreateEventSessionId(req, res);
  const { answers } = req.body || {};
  if (!Array.isArray(answers) || answers.length === 0) {
    return res.status(400).json({ error: 'Missing answers' });
  }

  const now = new Date();
  let attempt = await QcmAttempt.findOne({ session_id });
  if (!attempt) {
    attempt = await QcmAttempt.create({ session_id, attempts_count: 0, last_attempt_at: null, cooldown_until: null });
  }

  if (attempt.cooldown_until && attempt.cooldown_until > now) {
    return res.status(429).json({ error: 'Cooldown active', retry_after: attempt.cooldown_until.toISOString() });
  }
  if (attempt.attempts_count >= MAX_ATTEMPTS) {
    return res.status(429).json({ error: 'Max attempts reached' });
  }

  const bank = loadBank();
  const byId = new Map(bank.map((q) => [q.id, q]));
  let correct = 0;
  for (const a of answers) {
    const q = byId.get(a.id);
    if (q && q.answer === a.choice) correct++;
  }
  const passed = correct >= Math.ceil((answers.length || 1) * 0.7); // 70% threshold

  attempt.attempts_count += 1;
  attempt.last_attempt_at = now;
  if (!passed && attempt.attempts_count >= MAX_ATTEMPTS) {
    attempt.cooldown_until = new Date(now.getTime() + COOLDOWN_MINUTES * 60 * 1000);
  }
  if (passed) attempt.passed = true;
  await attempt.save();

  await logMetric('qcm_attempt', { session_id, passed, correct, total: answers.length });

  // Substitution logic: if passed and only 1 stand missing, mark the missing stand via a synthetic stamp
  if (passed) {
    const stamps = await EventStamp.find({ session_id }).select('stand').lean();
    const scanned = new Set(stamps.map((s) => s.stand));
    if (!scanned.has('A') || !scanned.has('B')) {
      const missing = !scanned.has('A') ? 'A' : 'B';
      await EventStamp.updateOne(
        { session_id, stand: missing },
        { $setOnInsert: { session_id, stand: missing, source: 'qcm', issued_at: now, expires_at: now, nonce: `qcm_${session_id}` } },
        { upsert: true },
      );
    }
  }

  return res.status(200).json({ passed, correct, total: answers.length });
}

module.exports = { getQuestions, submitAnswers };


