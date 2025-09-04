const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const sharp = require('sharp');
const { randomUUID } = require('crypto');
const { logger } = require('@librechat/data-schemas');
const { saveLocalBuffer } = require('~/server/services/Files/Local/crud');

/**
 * Resolve an absolute path on disk from a web-facing filepath like "/uploads/<userId>/..." or "/images/<userId>/..."
 * @param {ServerRequest} req
 * @param {string} filepath
 */
function resolveAbsolutePath(req, filepath) {
  const appConfig = req.config;
  if (filepath.includes('/uploads/')) {
    const base = filepath.split('/uploads/')[1];
    return path.join(appConfig.paths.uploads, base);
  }
  if (filepath.includes('/images/')) {
    const base = filepath.split('/images/')[1];
    return path.join(appConfig.paths.imageOutput, base);
  }
  // Fallback: treat as already absolute
  return filepath;
}

/**
 * Convert a PDF to an array of synthetic image file metadata, saved under /images/<userId>/.
 * Requires poppler-utils (pdftoppm) in the container.
 * @param {ServerRequest} req
 * @param {MongoFile} file - PDF file metadata
 * @param {object} opts
 * @param {number} [opts.maxPages=16]
 * @param {number} [opts.dpi=200]
 * @returns {Promise<Array<Partial<MongoFile>>>}
 */
async function pdfToImages(req, file, opts = {}) {
  const { maxPages = 16, dpi = 200 } = opts;
  const absPath = resolveAbsolutePath(req, file.filepath);
  const workDir = await fs.promises.mkdtemp(path.join(path.dirname(absPath), 'pdfpp-'));
  const prefix = path.join(workDir, 'page');

  await new Promise((resolve, reject) => {
    const args = ['-png', `-r`, String(dpi), absPath, prefix];
    const proc = spawn('pdftoppm', args);
    proc.on('error', reject);
    proc.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`pdftoppm exit ${code}`))));
  });

  const files = (await fs.promises.readdir(workDir))
    .filter((f) => f.endsWith('.png'))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  let selected = files;
  if (files.length > maxPages) {
    // Uniform sampling across pages
    selected = [];
    for (let i = 0; i < maxPages; i++) {
      const idx = Math.floor((i * (files.length - 1)) / (maxPages - 1));
      selected.push(files[idx]);
    }
  }

  const results = [];
  for (const png of selected) {
    const buf = await fs.promises.readFile(path.join(workDir, png));
    const meta = await sharp(buf).metadata();
    const fileId = randomUUID();
    const outName = `${fileId}.png`;
    const savedPath = await saveLocalBuffer({
      userId: req.user.id + '',
      buffer: buf,
      fileName: outName,
      basePath: 'images',
    });
    results.push({
      file_id: fileId,
      filename: outName,
      filepath: savedPath,
      type: 'image/png',
      width: meta.width,
      height: meta.height,
      embedded: true,
      source: 'local',
    });
  }

  // Cleanup temp dir
  try {
    await Promise.all(
      (await fs.promises.readdir(workDir)).map((f) => fs.promises.unlink(path.join(workDir, f))),
    );
    await fs.promises.rmdir(workDir);
  } catch (e) {
    logger.warn('[pdfToImages] cleanup failed', e);
  }

  return results;
}

module.exports = { pdfToImages };


