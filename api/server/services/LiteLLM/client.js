const axios = require('axios');
const { logger } = require('@librechat/data-schemas');

function isLiteLLMEnabled() {
  return process.env.LITELLM_ENABLED === 'true';
}

function getLiteLLMConfig() {
  const baseURL = process.env.LITELLM_BASE_URL;
  const adminKey = process.env.LITELLM_ADMIN_KEY;
  return { baseURL, adminKey };
}

async function createKey({ userId, orgId, voucherId, dailyMsgCap, dailyTokenCap, models }) {
  if (!isLiteLLMEnabled()) return null;
  const { baseURL, adminKey } = getLiteLLMConfig();
  if (!baseURL || !adminKey) {
    logger.warn('[LiteLLM] Missing base URL or admin key; skipping createKey');
    return null;
  }

  try {
    const res = await axios.post(
      `${baseURL.replace(/\/$/, '')}/key/create`,
      {
        user: userId,
        tags: { orgId, voucherId },
        limits: {
          daily_messages: dailyMsgCap ?? null,
          daily_tokens: dailyTokenCap ?? null,
        },
        models_allowlist: Array.isArray(models) ? models : undefined,
      },
      { headers: { Authorization: `Bearer ${adminKey}` }, timeout: 5000 },
    );
    return res.data ?? null;
  } catch (err) {
    logger.warn('[LiteLLM] createKey failed', err?.message || err);
    return null;
  }
}

async function revokeKey({ keyId }) {
  if (!isLiteLLMEnabled()) return null;
  const { baseURL, adminKey } = getLiteLLMConfig();
  if (!baseURL || !adminKey || !keyId) {
    return null;
  }
  try {
    const res = await axios.post(
      `${baseURL.replace(/\/$/, '')}/key/revoke`,
      { key_id: keyId },
      { headers: { Authorization: `Bearer ${adminKey}` }, timeout: 5000 },
    );
    return res.data ?? null;
  } catch (err) {
    logger.warn('[LiteLLM] revokeKey failed', err?.message || err);
    return null;
  }
}

module.exports = { isLiteLLMEnabled, getLiteLLMConfig, createKey, revokeKey };


