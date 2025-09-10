const { EventSeat, EventVoucher } = require('~/db/models');

module.exports = function orgFrozenEnforcer() {
  return async function (req, res, next) {
    try {
      const userId = req.user?.id || req.user?._id;
      if (!userId) return next();
      const seat = await EventSeat.findOne({ user_id: userId, status: 'active' })
        .select('voucher_id')
        .lean();
      if (!seat) return next();
      const voucher = await EventVoucher.findOne({ voucher_id: seat.voucher_id }).select('status').lean();
      if (!voucher) return next();
      if (voucher.status === 'frozen') {
        return res.status(429).json({ error: 'Organization daily token cap reached (frozen)', reset: 'daily' });
      }
      return next();
    } catch (err) {
      return next();
    }
  };
};


