const express = require('express');
const { createSetBalanceConfig } = require('@librechat/api');
const {
  resetPasswordRequestController,
  resetPasswordController,
  registrationController,
  graphTokenController,
  refreshController,
} = require('~/server/controllers/AuthController');
const {
  regenerateBackupCodes,
  disable2FA,
  confirm2FA,
  enable2FA,
  verify2FA,
} = require('~/server/controllers/TwoFactorController');
const { verify2FAWithTempToken } = require('~/server/controllers/auth/TwoFactorAuthController');
const { logoutController } = require('~/server/controllers/auth/LogoutController');
const { loginController } = require('~/server/controllers/auth/LoginController');
const { getAppConfig } = require('~/server/services/Config');
const middleware = require('~/server/middleware');
const { Balance, EventSeat, EventVoucher, RedemptionLog } = require('~/db/models');
const { logMetric } = require('~/server/services/Event/metrics');
const { isEmailDomainAllowed } = require('~/server/services/domains');
const { createKey } = require('~/server/services/LiteLLM/client');
const { provisionUserKey } = require('~/server/services/LiteLLM/provision');
const { isWebmail } = require('~/server/services/emailValidation');

const setBalanceConfig = createSetBalanceConfig({
  getAppConfig,
  Balance,
});

const router = express.Router();

const ldapAuth = !!process.env.LDAP_URL && !!process.env.LDAP_USER_SEARCH_BASE;
//Local
router.post('/logout', middleware.requireJwtAuth, logoutController);
router.post(
  '/login',
  middleware.logHeaders,
  middleware.loginLimiter,
  middleware.checkBan,
  ldapAuth ? middleware.requireLdapAuth : middleware.requireLocalAuth,
  setBalanceConfig,
  loginController,
);
router.post('/refresh', refreshController);
router.post(
  '/register',
  middleware.registerLimiter,
  middleware.checkBan,
  middleware.checkInviteUser,
  middleware.validateRegistration,
  registrationController,
);
router.post(
  '/requestPasswordReset',
  middleware.resetPasswordLimiter,
  middleware.checkBan,
  middleware.validatePasswordReset,
  resetPasswordRequestController,
);
router.post(
  '/resetPassword',
  middleware.checkBan,
  middleware.validatePasswordReset,
  resetPasswordController,
);

router.get('/2fa/enable', middleware.requireJwtAuth, enable2FA);
router.post('/2fa/verify', middleware.requireJwtAuth, verify2FA);
router.post('/2fa/verify-temp', middleware.checkBan, verify2FAWithTempToken);
router.post('/2fa/confirm', middleware.requireJwtAuth, confirm2FA);
router.post('/2fa/disable', middleware.requireJwtAuth, disable2FA);
router.post('/2fa/backup/regenerate', middleware.requireJwtAuth, regenerateBackupCodes);

router.get('/graph-token', middleware.requireJwtAuth, graphTokenController);

/** Validate event code: activates a personal seat */
router.post('/validate-code', async (req, res) => {
  try {
    const { email, code } = req.body || {};
    if (!email || !code) return res.status(400).json({ error: 'Missing email or code' });
    const { EventSeat, EventVoucher, EventLead } = require('~/db/models');
    const crypto = require('node:crypto');
    const hash = crypto.createHash('sha256').update(code).digest('hex');
    const lead = await EventLead.findOne({ email }).lean();
    if (!lead || lead.validation_code_hash !== hash) return res.status(400).json({ error: 'Invalid code' });
    if (lead.validated) return res.status(400).json({ error: 'Code already used' });
    const ttlMin = Math.max(parseInt(process.env.EVENT_CODE_TTL_MINUTES || '30', 10), 1);
    const expired = lead.validation_sent_at && (Date.now() - new Date(lead.validation_sent_at).getTime()) > ttlMin * 60 * 1000;
    if (expired) return res.status(400).json({ error: 'Code expired' });

    // Create a personal voucher on the fly (single seat) for this email
    const voucher_id = `EVT_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const models = [];
    await EventVoucher.create({
      voucher_id,
      org_id: voucher_id,
      allowed_domains: [],
      max_seats: 1,
      redemptions_count: 0,
      models_allowlist: models,
      org_daily_token_cap: Number(process.env.EVENT_ORG_DAILY_TOKEN_CAP || 1000000),
      expires_at: null,
      status: 'active',
    });

    const userId = req.user?.id || req.user?._id || null;
    await EventSeat.create({
      seat_id: `${voucher_id}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      voucher_id,
      user_id: userId,
      email,
      activated_at: new Date(),
      status: 'active',
      user_daily_caps: {
        msgs: Number(process.env.EVENT_USER_DAILY_MSG_CAP || 200),
        tokens: Number(process.env.EVENT_USER_DAILY_TOKEN_CAP || 100000),
      },
    });

    await EventLead.updateOne({ email }, { $set: { validated: true, validation_code_hash: null } });
    return res.status(200).json({ activated: true });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});
/**
 * Redeem voucher seat: binds a seat to a user/email with domain and cap checks
 * in: { voucher_id, email }
 */
router.post('/redeem', middleware.loginLimiter, middleware.logHeaders, middleware.requireJwtAuth, async (req, res) => {
  try {
    const { voucher_id, email } = req.body || {};
    const userId = req.user?.id;
    if (!voucher_id || !email || !userId) {
      return res.status(400).json({ error: 'Missing voucher_id or email' });
    }

    if (process.env.BLOCK_WEBMAILS === 'true' && isWebmail(email)) {
      await RedemptionLog.create({ voucher_id: voucher_id || null, user_id: userId, email, result: 'domain_blocked' });
      return res.status(403).json({ error: 'Webmail addresses are not allowed' });
    }

    const voucher = await EventVoucher.findOne({ voucher_id }).lean();
    if (!voucher) {
      return res.status(404).json({ error: 'Voucher not found' });
    }
    if (voucher.status !== 'active') {
      await RedemptionLog.create({ voucher_id, user_id: userId, email, result: 'frozen' });
      return res.status(400).json({ error: 'Voucher not active' });
    }
    if (voucher.expires_at && new Date(voucher.expires_at) < new Date()) {
      await RedemptionLog.create({ voucher_id, user_id: userId, email, result: 'expired' });
      return res.status(400).json({ error: 'Voucher expired' });
    }

    const appConfig = await getAppConfig({ role: req.user.role });
    const domainAllowed = voucher.allowed_domains?.some((d) => email.toLowerCase().endsWith(`@${d.toLowerCase()}`));
    const globalAllowed = isEmailDomainAllowed(email, appConfig?.registration?.allowedDomains);
    if (!domainAllowed || !globalAllowed) {
      await RedemptionLog.create({ voucher_id, user_id: userId, email, result: 'domain_blocked' });
      return res.status(403).json({ error: 'Email domain not allowed' });
    }

    const activeSeatCount = await EventSeat.countDocuments({ voucher_id, status: 'active' });
    if (voucher.max_seats && activeSeatCount >= voucher.max_seats) {
      await RedemptionLog.create({ voucher_id, user_id: userId, email, result: 'cap_reached' });
      return res.status(400).json({ error: 'Seat cap reached' });
    }

    const existingActiveForEmail = await EventSeat.findOne({ voucher_id, email, status: 'active' });
    if (existingActiveForEmail) {
      await RedemptionLog.create({ voucher_id, user_id: userId, email, result: 'duplicate' });
      return res.status(409).json({ error: 'Seat already active for this email' });
    }

    const seat = await EventSeat.create({
      seat_id: `${voucher_id}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      voucher_id,
      user_id: userId,
      email,
      activated_at: new Date(),
      status: 'active',
      user_daily_caps: {
        msgs: Number(process.env.EVENT_USER_DAILY_MSG_CAP || 200),
        tokens: Number(process.env.EVENT_USER_DAILY_TOKEN_CAP || 100000),
      },
    });

    // Provision LiteLLM key (best-effort)
    try {
      const key = await createKey({
        userId,
        orgId: voucher.org_id,
        voucherId: voucher_id,
        dailyMsgCap: seat.user_daily_caps.msgs,
        dailyTokenCap: seat.user_daily_caps.tokens,
        models: voucher.models_allowlist,
      });
      if (key?.key_id) {
        await EventSeat.updateOne({ seat_id: seat.seat_id }, { $set: { litellm_key_id: key.key_id } });
      }
    } catch (_) {}

    await EventVoucher.updateOne({ voucher_id }, { $inc: { redemptions_count: 1 } });
    await RedemptionLog.create({ voucher_id, user_id: userId, email, result: 'ok' });
    await logMetric('seat_activated', { voucher_id, user_id: userId, email });
    // LiteLLM provisioning (stubbed/gated)
    try {
      const dailyMsgCap = seat.user_daily_caps?.msgs;
      const dailyTokenCap = seat.user_daily_caps?.tokens;
      await provisionUserKey({
        userId,
        voucher_id,
        org_id: voucher.org_id,
        dailyMsgCap,
        dailyTokenCap,
      });
    } catch (_) {}
    return res.status(200).json({ seat_id: seat.seat_id, voucher_id });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
