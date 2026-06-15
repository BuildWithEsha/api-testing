// middleware/auth.js
// DB-backed API key auth with per-key permission checking

const { findApiKey, parsePermissions } = require('../helpers/apiKeys');

/**
 * requirePermission(permission)
 * Middleware factory — checks the Bearer token against the api_keys table,
 * then verifies the key has the requested permission.
 *
 * Permission strings: 'read:users', 'read:greetings', or '*' (all)
 *
 * Usage:
 *   app.use('/api/users', requirePermission('read:users'), usersRouter);
 */
function requirePermission(permission) {
  return async function (req, res, next) {
    const authHeader = req.headers.authorization || '';
    const rawKey = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : null;

    if (!rawKey) {
      return res.status(401).json({
        error: 'Missing API key. Include header: Authorization: Bearer YOUR_API_KEY'
      });
    }

    try {
      const pool = req.app.get('dbPool');
      const keyRecord = await findApiKey(pool, rawKey);

      if (!keyRecord) {
        return res.status(403).json({ error: 'Invalid or revoked API key' });
      }

      const permissions = parsePermissions(keyRecord.permissions);

      const hasPermission =
        permissions.includes('*') || permissions.includes(permission);

      if (!hasPermission) {
        return res.status(403).json({
          error: `This API key does not have '${permission}' permission`
        });
      }

      // Attach key info to request for logging
      req.apiKeyId = keyRecord.id;
      req.apiKeyName = keyRecord.name;
      next();
    } catch (err) {
      console.error('[AUTH] DB error during key check:', err.message);
      res.status(500).json({ error: 'Auth check failed' });
    }
  };
}

/**
 * requireAdminPassword
 * Simple admin access for the key management endpoints.
 * Reads from ADMIN_PASSWORD env var.
 * Sent as: Authorization: Admin YOUR_ADMIN_PASSWORD
 */
function requireAdminPassword(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const adminPassword = authHeader.startsWith('Admin ')
    ? authHeader.slice(6).trim()
    : null;

  const expected = process.env.ADMIN_PASSWORD;

  if (!expected) {
    console.error('[ADMIN] ADMIN_PASSWORD not set in environment');
    return res.status(500).json({ error: 'Server misconfigured: ADMIN_PASSWORD not set' });
  }

  if (!adminPassword || adminPassword !== expected) {
    return res.status(401).json({
      error: 'Invalid admin password. Header: Authorization: Admin YOUR_PASSWORD'
    });
  }

  next();
}

module.exports = { requirePermission, requireAdminPassword };
