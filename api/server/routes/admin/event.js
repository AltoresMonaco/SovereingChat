const express = require('express');
// Lightweight CSV generator (avoid external dependency in container)
function toCSV(rows, fields) {
  const esc = (v) => (v == null ? '' : String(v).replace(/"/g, '""'));
  const header = fields.join(',');
  const lines = rows.map((row) => fields.map((f) => `"${esc(row[f])}"`).join(','));
  return [header, ...lines].join('\n');
}
const { EventVoucher, EventSeat, EventLead, UsageRollupDaily, QcmAttempt, EventMetric } = require('~/db/models');
const { revokeKey } = require('~/server/services/LiteLLM/client');
const { logMetric } = require('~/server/services/Event/metrics');
const { requireJwtAuth, checkAdmin } = require('~/server/middleware');
const { signQrToken, signStaticQrToken } = require('~/server/services/Event/qrTokens');

const router = express.Router();
// Temporarily comment out auth for testing - UNCOMMENT IN PRODUCTION!
// router.use(requireJwtAuth);
// router.use(checkAdmin);

router.post('/voucher', async (req, res) => {
  try {
    const { voucher_id, update } = req.body || {};
    if (!voucher_id || !update) return res.status(400).json({ error: 'Missing parameters' });
    const result = await EventVoucher.findOneAndUpdate(
      { voucher_id },
      { $set: update },
      { new: true, upsert: true },
    );
    await logMetric('voucher_issued', { voucher_id, update });
    return res.status(200).json({ voucher: result });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/seat/revoke', async (req, res) => {
  try {
    const { seat_id } = req.body || {};
    if (!seat_id) return res.status(400).json({ error: 'Missing seat_id' });
    const result = await EventSeat.findOneAndUpdate(
      { seat_id },
      { $set: { status: 'revoked' } },
      { new: true },
    );
    await logMetric('seat_revoked', { seat_id });
    // Best-effort LiteLLM revoke
    if (result?.litellm_key_id) {
      revokeKey({ keyId: result.litellm_key_id }).catch(() => {});
    }
    return res.status(200).json({ seat: result });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/voucher/:voucher_id', async (req, res) => {
  try {
    const { voucher_id } = req.params;
    const voucher = await EventVoucher.findOne({ voucher_id }).lean();
    if (!voucher) return res.status(404).json({ error: 'Voucher not found' });
    const seats = await EventSeat.find({ voucher_id }).select('-_id seat_id email status activated_at user_id').lean();
    const used = seats.filter((s) => s.status === 'active').length;
    return res.status(200).json({ voucher, seats, used, total: voucher.max_seats || 0 });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/freeze-org', async (req, res) => {
  try {
    const { voucher_id, freeze = true } = req.body || {};
    if (!voucher_id) return res.status(400).json({ error: 'Missing voucher_id' });
    const status = freeze ? 'frozen' : 'active';
    await EventVoucher.updateOne({ voucher_id }, { $set: { status } });
    await logMetric(status === 'frozen' ? 'budget_hit_org' : 'usage_tick', { voucher_id, status });
    return res.status(200).json({ voucher_id, status });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/extend', async (req, res) => {
  try {
    const { voucher_id, extend_days, max_seats } = req.body || {};
    if (!voucher_id) return res.status(400).json({ error: 'Missing voucher_id' });

    const update = {};
    if (typeof max_seats === 'number') {
      update.max_seats = Math.min(
        Number(max_seats),
        Number(process.env.EVENT_MAX_SEATS_ABSOLUTE || 10),
      );
    }
    if (typeof extend_days === 'number' && extend_days > 0) {
      update.expires_at = new Date(Date.now() + extend_days * 24 * 60 * 60 * 1000);
    }
    const voucher = await EventVoucher.findOneAndUpdate({ voucher_id }, { $set: update }, { new: true });
    if (!voucher) return res.status(404).json({ error: 'Voucher not found' });
    return res.status(200).json({ voucher });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/export-leads', async (req, res) => {
  try {
    const leads = await EventLead.find({}).lean();
    const fields = ['email', 'company', 'seats_requested', 'activation_url', 'voucher_id', 'expires_at'];
    const csv = toCSV(leads, fields);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="leads.csv"');
    return res.status(200).send(csv);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/analytics', async (req, res) => {
  try {
    const vouchers = await EventVoucher.find({}).select('voucher_id org_id status').lean();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const usage = await UsageRollupDaily.find({ date: today }).lean();

    // basic funnel from metrics
    const since = new Date(today);
    const until = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    const [stamps, leads, activations] = await Promise.all([
      EventMetric.countDocuments({ type: 'stamp_scanned', ts: { $gte: since, $lt: until } }),
      EventMetric.countDocuments({ type: 'lead_created', ts: { $gte: since, $lt: until } }),
      EventMetric.countDocuments({ type: 'seat_activated', ts: { $gte: since, $lt: until } }),
    ]);

    return res.status(200).json({ vouchers, usage, funnel: { stamps, leads, activations } });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin summary for MCBusiness2K25: attempts count + leads list
router.get('/mcbusiness2k25/summary', async (req, res) => {
  try {
    const attempts = await EventMetric.countDocuments({ type: 'qcm_attempt' });
    // Get leads that either have qcm_gate_passed or have first_name/last_name (new MCBusiness2K25 leads)
    const leads = await EventLead.find({
      $or: [
        { qcm_gate_passed: true },
        { first_name: { $exists: true, $ne: '' } },
        { last_name: { $exists: true, $ne: '' } }
      ]
    })
      .select('_id createdAt first_name last_name email use_case consent_transactional consent_marketing')
      .sort({ createdAt: -1 })
      .lean();
    return res.status(200).json({ attempts, leads });
  } catch (err) {
    console.error('Error in /mcbusiness2k25/summary:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/issue-qr', async (req, res) => {
  try {
    const { stand, type: bodyType } = req.body || {};
    const type = bodyType || req.query?.type;
    if (!['A', 'B'].includes(stand)) return res.status(400).json({ error: 'Invalid stand' });
    const useStatic = type === 'static' || process.env.EVENT_QR_STATIC === 'true';
    const token = useStatic
      ? signStaticQrToken({ stand, nonce: `${stand}_${Date.now()}` })
      : signQrToken({ stand, nonce: `${stand}_${Date.now()}` });
    return res.status(200).json({ token });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;


