/**
 * Strict Content Security Policy middleware (opt-in via ENABLE_STRICT_CSP=true)
 * Defaults are conservative and avoid external CDNs.
 */
module.exports = function strictCSP() {
  return function (req, res, next) {
    /**
     * Adjust if your deployment needs more relaxed rules.
     * - 'unsafe-inline' may be needed for some legacy styles/scripts.
     */
    const csp = [
      "default-src 'self'",
      "img-src 'self' data: blob:",
      "media-src 'self' blob:",
      "font-src 'self' data:",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
      "connect-src 'self'",
      "frame-ancestors 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; ');

    res.setHeader('Content-Security-Policy', csp);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'no-referrer');
    next();
  };
};


