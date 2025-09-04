const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const sharp = require('sharp');
const { randomUUID } = require('crypto');
const { logger } = require('@librechat/data-schemas');
const { saveLocalBuffer } = require('~/server/services/Files/Local/crud');

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
  return filepath;
}

/**
 * Extract frames from a video using ffmpeg.
 * @param {ServerRequest} req
 * @param {MongoFile} file - video file metadata
 * @param {object} opts
 * @param {number} [opts.fps=1]
 * @param {number} [opts.maxFrames=16]
 * @returns {Promise<Array<Partial<MongoFile>>>}
 */
async function extractFrames(req, file, opts = {}) {
  const { fps = 1, maxFrames = 16 } = opts;
  const absPath = resolveAbsolutePath(req, file.filepath);
  const workDir = await fs.promises.mkdtemp(path.join(path.dirname(absPath), 'vidfr-'));

  await new Promise((resolve, reject) => {
    const args = ['-i', absPath, '-vf', `fps=${fps}`, path.join(workDir, 'frame-%05d.png')];
    const proc = spawn('ffmpeg', args);
    proc.on('error', reject);
    proc.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exit ${code}`))));
  });

  const files = (await fs.promises.readdir(workDir))
    .filter((f) => f.endsWith('.png'))
    .sort();

  let selected = files.slice(0, maxFrames);
  if (files.length > maxFrames) {
    // Evenly sample if needed
    selected = [];
    for (let i = 0; i < maxFrames; i++) {
      const idx = Math.floor((i * (files.length - 1)) / (maxFrames - 1));
      selected.push(files[idx]);
    }
  }

  const results = [];
  for (const f of selected) {
    const buf = await fs.promises.readFile(path.join(workDir, f));
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

  try {
    await Promise.all(
      (await fs.promises.readdir(workDir)).map((f) => fs.promises.unlink(path.join(workDir, f))),
    );
    await fs.promises.rmdir(workDir);
  } catch (e) {
    logger.warn('[extractFrames] cleanup failed', e);
  }

  return results;
}

module.exports = { extractFrames };


