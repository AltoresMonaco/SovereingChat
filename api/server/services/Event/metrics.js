const { EventMetric } = require('~/db/models');

async function logMetric(type, meta = {}) {
  try {
    await EventMetric.create({ type, meta });
  } catch (_) {}
}

module.exports = { logMetric };


