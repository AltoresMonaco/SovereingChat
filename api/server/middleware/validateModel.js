const { handleError } = require('@librechat/api');
const { ViolationTypes } = require('librechat-data-provider');
const { getModelsConfig } = require('~/server/controllers/ModelController');
const { EventSeat, EventVoucher } = require('~/db/models');
const { logViolation } = require('~/cache');
/**
 * Validates the model of the request.
 *
 * @async
 * @param {ServerRequest} req - The Express request object.
 * @param {Express.Response} res - The Express response object.
 * @param {Function} next - The Express next function.
 */
const validateModel = async (req, res, next) => {
  const { model, endpoint } = req.body;
  if (!model) {
    return handleError(res, { text: 'Model not provided' });
  }

  const modelsConfig = await getModelsConfig(req);

  if (!modelsConfig) {
    return handleError(res, { text: 'Models not loaded' });
  }

  const availableModels = modelsConfig[endpoint];
  if (!availableModels) {
    return handleError(res, { text: 'Endpoint models not loaded' });
  }

  let validModel = !!availableModels.find((availableModel) => availableModel === model);

  // Enforce models_allowlist for event seats/org vouchers, if present
  try {
    const userId = req.user?.id || req.user?._id;
    if (userId) {
      const seat = await EventSeat.findOne({ user_id: userId, status: 'active' }).select('voucher_id').lean();
      if (seat?.voucher_id) {
        const voucher = await EventVoucher.findOne({ voucher_id: seat.voucher_id })
          .select('models_allowlist')
          .lean();
        if (Array.isArray(voucher?.models_allowlist) && voucher.models_allowlist.length) {
          validModel = validModel && voucher.models_allowlist.includes(model);
        }
      }
    }
  } catch (_) {}

  if (validModel) {
    return next();
  }

  const { ILLEGAL_MODEL_REQ_SCORE: score = 1 } = process.env ?? {};

  const type = ViolationTypes.ILLEGAL_MODEL_REQUEST;
  const errorMessage = {
    type,
  };

  await logViolation(req, res, type, errorMessage, score);
  return handleError(res, { text: 'Illegal model request' });
};

module.exports = validateModel;
