const { Transaction } = require('~/db/models');

/**
 * Middleware to enforce per-user daily message/token caps from event seats
 */
module.exports = function userDailyCaps() {
  return async function (req, res, next) {
    try {
      const userId = req.user?.id || req.user?._id;
      if (!userId) return next();

      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const agg = await Transaction.aggregate([
        { $match: { user: req.user._id || req.user.id, tokenType: { $in: ['prompt', 'completion'] }, createdAt: { $gte: start } } },
        { $group: { _id: null, tokens: { $sum: { $abs: '$rawAmount' } }, messages: { $sum: 1 } } },
      ]);
      const usedTokens = agg?.[0]?.tokens || 0;
      const usedMsgs = agg?.[0]?.messages || 0;

      const msgCap = Number(process.env.EVENT_USER_DAILY_MSG_CAP || 200);
      const tokenCap = Number(process.env.EVENT_USER_DAILY_TOKEN_CAP || 100000);

      if (msgCap && usedMsgs >= msgCap) {
        return res.status(429).json({ error: 'Daily message cap reached', reset: `${start.toISOString().slice(0,10)}T23:59:59Z` });
      }
      if (tokenCap && usedTokens >= tokenCap) {
        return res.status(429).json({ error: 'Daily token cap reached', reset: `${start.toISOString().slice(0,10)}T23:59:59Z` });
      }

      return next();
    } catch (err) {
      return next();
    }
  };
};


