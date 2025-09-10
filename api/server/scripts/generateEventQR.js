#!/usr/bin/env node
const { signQrToken } = require('~/server/services/Event/qrTokens');

const stand = process.argv[2];
if (!stand || !['A', 'B'].includes(stand)) {
  console.error('Usage: node generateEventQR.js <A|B>');
  process.exit(1);
}

const nonce = Math.random().toString(36).slice(2);
const token = signQrToken({ stand, nonce });
console.log(JSON.stringify({ token }));


