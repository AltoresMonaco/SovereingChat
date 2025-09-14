const axios = require('axios');
const { logger } = require('@librechat/data-schemas');
const deriveBaseURL = require('~/utils/deriveBaseURL');

/**
 * Warm up Ollama-backed models so first-token latency is low.
 * Currently targets Gemma models defined in the custom Ollama endpoint.
 * @param {object} appConfig
 */
async function warmupOllama(appConfig) {
  try {
    const customs = appConfig?.endpoints?.custom;
    if (!Array.isArray(customs)) {
      return;
    }

    const ollamaCfg = customs.find((c) =>
      typeof c?.name === 'string' && c.name.toLowerCase() === 'ollama',
    );
    if (!ollamaCfg) {
      return;
    }

    const baseURL = typeof ollamaCfg.baseURL === 'string' ? ollamaCfg.baseURL : 'http://ollama:11434/v1/';
    const host = deriveBaseURL(baseURL);

    // Identify Gemma-like model id from config
    const models = Array.isArray(ollamaCfg?.models?.default) ? ollamaCfg.models.default : [];
    const gemmaModel = models.find((m) => typeof m === 'string' && m.toLowerCase().includes('gemma'));
    if (!gemmaModel) {
      return;
    }

    // Use native Ollama API to load weights with keep_alive
    const url = `${host}/api/generate`;
    const payload = {
      model: gemmaModel,
      prompt: 'ping',
      stream: false,
      keep_alive: '24h',
    };

    logger.info(`[warmup] Warming Ollama model '${gemmaModel}' at ${url}`);
    await axios.post(url, payload, { timeout: 60000 });
    logger.info(`[warmup] Gemma model '${gemmaModel}' warmed successfully`);
  } catch (err) {
    logger.warn('[warmup] Ollama warmup failed (non-fatal):', err?.message || err);
  }
}

module.exports = { warmupOllama };


