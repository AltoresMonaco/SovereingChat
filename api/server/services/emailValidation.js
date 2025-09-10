const WEBMAIL_DOMAINS = new Set([
  'gmail.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'yahoo.com',
  'proton.me',
  'protonmail.com',
  'icloud.com',
  'aol.com',
  'gmx.com',
  'yandex.com',
]);

function isWebmail(email) {
  if (!email || typeof email !== 'string' || !email.includes('@')) return false;
  const domain = email.split('@')[1].toLowerCase();
  return WEBMAIL_DOMAINS.has(domain);
}

module.exports = { isWebmail };


