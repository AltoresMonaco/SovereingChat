const { logger } = require('@librechat/data-schemas');
const { EventVoucher, EventSeat, UsageRollupDaily, Transaction } = require('~/db/models');

function startOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

async function rollupOrgTokensForVoucher(voucher) {
  const dayStart = startOfDay();
  const seats = await EventSeat.find({ voucher_id: voucher.voucher_id, status: 'active' })
    .select('user_id')
    .lean();
  const userIds = seats.map((s) => s.user_id).filter(Boolean);
  if (userIds.length === 0) {
    await UsageRollupDaily.updateOne(
      { org_id: voucher.org_id, date: dayStart },
      {
        $setOnInsert: { org_id: voucher.org_id, date: dayStart },
        $set: { tokens: 0, messages: 0, by_model: {} },
      },
      { upsert: true },
    );
    return { tokens: 0, messages: 0, by_model: {} };
  }

  const pipeline = [
    {
      $match: {
        user: { $in: userIds.map((id) => (typeof id === 'string' ? id : id)) },
        tokenType: { $in: ['prompt', 'completion'] },
        createdAt: { $gte: dayStart },
      },
    },
    { $project: { model: 1, rawAmount: 1 } },
    {
      $facet: {
        total: [
          {
            $group: {
              _id: null,
              tokens: { $sum: { $abs: '$rawAmount' } },
              messages: { $sum: 1 },
            },
          },
        ],
        byModel: [
          {
            $group: {
              _id: '$model',
              tokens: { $sum: { $abs: '$rawAmount' } },
              messages: { $sum: 1 },
            },
          },
        ],
      },
    },
  ];

  const agg = await Transaction.aggregate(pipeline);
  const total = agg?.[0]?.total?.[0] || { tokens: 0, messages: 0 };
  const tokens = total.tokens || 0;
  const messages = total.messages || 0;
  const byModelArray = agg?.[0]?.byModel || [];
  const by_model = {};
  for (const m of byModelArray) {
    const key = m._id || 'unknown';
    by_model[key] = { tokens: m.tokens || 0, messages: m.messages || 0 };
  }

  await UsageRollupDaily.updateOne(
    { org_id: voucher.org_id, date: dayStart },
    {
      $setOnInsert: { org_id: voucher.org_id, date: dayStart },
      $set: { tokens, messages, by_model },
    },
    { upsert: true },
  );

  return { tokens, messages, by_model };
}

async function evaluateVoucherCap(voucher) {
  if (!voucher?.org_daily_token_cap || voucher.org_daily_token_cap <= 0) {
    return;
  }
  const { tokens } = await rollupOrgTokensForVoucher(voucher);
  if (tokens > voucher.org_daily_token_cap && voucher.status === 'active') {
    await EventVoucher.updateOne({ voucher_id: voucher.voucher_id }, { $set: { status: 'frozen' } });
    logger.warn(`[OrgCap] Voucher ${voucher.voucher_id} frozen. Tokens: ${tokens} > cap: ${voucher.org_daily_token_cap}`);
  }
}

async function runOrgCapSweep() {
  try {
    const vouchers = await EventVoucher.find({ status: { $in: ['active', 'frozen'] } }).lean();
    for (const voucher of vouchers) {
      await evaluateVoucherCap(voucher);
    }
  } catch (err) {
    logger.error('[OrgCap] Sweep error', err);
  }
}

function scheduleDailyReset() {
  const now = new Date();
  const next = endOfDay(now);
  const ms = next.getTime() - now.getTime() + 1; // just after midnight
  setTimeout(async () => {
    try {
      await EventVoucher.updateMany({ status: 'frozen' }, { $set: { status: 'active' } });
      logger.info('[OrgCap] Daily reset: unfroze vouchers');
    } catch (err) {
      logger.error('[OrgCap] Daily reset error', err);
    } finally {
      scheduleDailyReset();
    }
  }, Math.max(ms, 1000));
}

function startOrgCapJob() {
  // Sweep every minute
  setInterval(runOrgCapSweep, 60 * 1000);
  scheduleDailyReset();
}

module.exports = { startOrgCapJob };


