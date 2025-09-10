const { logger } = require('@librechat/data-schemas');

function checkEventEnv() {
  const {
    EVENT_QR_DYNAMIC_TTL_SECONDS,
    EVENT_STAMP_TTL_HOURS,
    EVENT_ACTIVATION_TTL_DAYS,
    EVENT_DEFAULT_MAX_SEATS,
    EVENT_MAX_SEATS_ABSOLUTE,
    EVENT_USER_DAILY_MSG_CAP,
    EVENT_USER_DAILY_TOKEN_CAP,
    EVENT_ORG_DAILY_TOKEN_CAP,
    BLOCK_WEBMAILS,
    MEILI_NO_ANALYTICS,
    LITELLM_ENABLED,
    LITELLM_BASE_URL,
    LITELLM_ADMIN_KEY,
  } = process.env ?? {};

  const recs = [
    ['EVENT_QR_DYNAMIC_TTL_SECONDS', EVENT_QR_DYNAMIC_TTL_SECONDS, '120'],
    ['EVENT_STAMP_TTL_HOURS', EVENT_STAMP_TTL_HOURS, '72'],
    ['EVENT_ACTIVATION_TTL_DAYS', EVENT_ACTIVATION_TTL_DAYS, '14'],
    ['EVENT_DEFAULT_MAX_SEATS', EVENT_DEFAULT_MAX_SEATS, '5'],
    ['EVENT_MAX_SEATS_ABSOLUTE', EVENT_MAX_SEATS_ABSOLUTE, '10'],
    ['EVENT_USER_DAILY_MSG_CAP', EVENT_USER_DAILY_MSG_CAP, '200'],
    ['EVENT_USER_DAILY_TOKEN_CAP', EVENT_USER_DAILY_TOKEN_CAP, '100000'],
    ['EVENT_ORG_DAILY_TOKEN_CAP', EVENT_ORG_DAILY_TOKEN_CAP, '1000000'],
    ['BLOCK_WEBMAILS', BLOCK_WEBMAILS, 'true'],
  ];

  for (const [key, val, defVal] of recs) {
    if (val == null || val === '') {
      logger.warn(`[EventEnv] ${key} not set; using default ${defVal}`);
    }
  }

  if (MEILI_NO_ANALYTICS !== 'true') {
    logger.warn('[EventEnv] MEILI_NO_ANALYTICS is not true; set MEILI_NO_ANALYTICS=true for privacy');
  }

  if (LITELLM_ENABLED === 'true') {
    if (!LITELLM_BASE_URL || !LITELLM_ADMIN_KEY) {
      logger.warn('[EventEnv] LiteLLM is enabled but missing LITELLM_BASE_URL or LITELLM_ADMIN_KEY');
    }
  }
}

module.exports = { checkEventEnv };


