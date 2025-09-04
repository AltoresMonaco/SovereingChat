const { logger } = require('@librechat/data-schemas');
const { pdfToImages } = require('../documents/pdfToImages');
const { extractFrames } = require('../video/extractFrames');

/**
 * Expand a single uploaded file into zero or more image-like attachments for vision models.
 * - image/* => passthrough
 * - application/pdf => pdfToImages (sample pages)
 * - video/* => extractFrames (sample frames)
 * @param {ServerRequest} req
 * @param {MongoFile[]} attachments
 * @param {{ maxImages?: number, pdfDpi?: number, fps?: number }} [opts]
 * @returns {Promise<MongoFile[]>}
 */
async function expandAttachmentsForVision(req, attachments, opts = {}) {
  const {
    maxImages = 16,
    pdfDpi = 200,
    fps = 1,
  } = opts;

  if (!attachments || !attachments.length) {
    return [];
  }

  const expanded = [];
  for (const file of attachments) {
    try {
      if (file.type?.startsWith('image/')) {
        expanded.push(file);
        continue;
      }
      if (file.type === 'application/pdf') {
        const pages = await pdfToImages(req, file, { maxPages: maxImages, dpi: pdfDpi });
        expanded.push(...pages);
        continue;
      }
      if (file.type?.startsWith('video/')) {
        const frames = await extractFrames(req, file, { maxFrames: maxImages, fps });
        expanded.push(...frames);
        continue;
      }
      // Unknown types: passthrough (text/docs handled elsewhere)
      expanded.push(file);
    } catch (e) {
      logger.error('[expandAttachmentsForVision] failed for file:', file?.filename, e);
    }
  }

  // Enforce global cap
  return expanded.slice(0, maxImages);
}

module.exports = { expandAttachmentsForVision };


