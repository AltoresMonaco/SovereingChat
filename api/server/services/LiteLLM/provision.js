const { logger } = require('@librechat/data-schemas');

async function provisionUserKey({ userId, voucher_id, org_id, dailyMsgCap, dailyTokenCap }) {
  if (process.env.LITELLM_ENABLED !== 'true') {
    logger.warn('[LiteLLM] Provision skipped: LITELLM_ENABLED!=true');
    return null;
  }
  try {
    // TODO: implement LiteLLM key creation call here
    // Return a placeholder to avoid blocking activation
    logger.info(`[LiteLLM] (stub) provisioned key for user=${userId}, voucher=${voucher_id}`);
    return { apiKey: 'stub', meta: { userId, voucher_id, org_id, dailyMsgCap, dailyTokenCap } };
  } catch (err) {
    logger.error('[LiteLLM] Provision error', err);
    return null;
  }
}

module.exports = { provisionUserKey };


