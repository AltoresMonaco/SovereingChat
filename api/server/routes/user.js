const express = require('express');
const {
  updateUserPluginsController,
  resendVerificationController,
  getTermsStatusController,
  acceptTermsController,
  verifyEmailController,
  deleteUserController,
  getUserController,
} = require('~/server/controllers/UserController');
const { requireJwtAuth, canDeleteAccount, verifyEmailLimiter } = require('~/server/middleware');
const { Transaction } = require('~/db/models');
const { EventSeat, EventVoucher } = require('~/db/models');

const router = express.Router();

router.get('/', requireJwtAuth, getUserController);
router.get('/terms', requireJwtAuth, getTermsStatusController);
router.post('/terms/accept', requireJwtAuth, acceptTermsController);
router.post('/plugins', requireJwtAuth, updateUserPluginsController);
router.delete('/delete', requireJwtAuth, canDeleteAccount, deleteUserController);
router.post('/verify', verifyEmailController);
router.post('/verify/resend', verifyEmailLimiter, resendVerificationController);

router.get('/me/usage', requireJwtAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const [msgs, tokensAgg] = await Promise.all([
      Transaction.countDocuments({ user: userId, tokenType: { $in: ['prompt', 'completion'] }, createdAt: { $gte: start } }),
      Transaction.aggregate([
        { $match: { user: req.user._id || req.user.id, tokenType: { $in: ['prompt', 'completion'] }, createdAt: { $gte: start } } },
        { $group: { _id: null, tokens: { $sum: { $abs: '$rawAmount' } } } },
      ]),
    ]);
    const tokens = tokensAgg?.[0]?.tokens || 0;
    return res.status(200).json({ messages: msgs, tokens });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/me/limits', requireJwtAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    const seat = await EventSeat.findOne({ user_id: userId, status: 'active' }).lean();
    const msgCap = seat?.user_daily_caps?.msgs || Number(process.env.EVENT_USER_DAILY_MSG_CAP || 200);
    const tokenCap = seat?.user_daily_caps?.tokens || Number(process.env.EVENT_USER_DAILY_TOKEN_CAP || 100000);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tokensAgg = await Transaction.aggregate([
      { $match: { user: req.user._id || req.user.id, tokenType: { $in: ['prompt', 'completion'] }, createdAt: { $gte: today } } },
      { $group: { _id: null, tokens: { $sum: { $abs: '$rawAmount' } }, messages: { $sum: 1 } } },
    ]);
    const usedTokens = tokensAgg?.[0]?.tokens || 0;
    const usedMsgs = tokensAgg?.[0]?.messages || 0;
    return res.status(200).json({ msgCap, tokenCap, usedMsgs, usedTokens, reset: `${today.toISOString().slice(0,10)}T23:59:59Z` });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
