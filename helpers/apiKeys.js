// helpers/apiKeys.js
// Handles API key generation, hashing, and DB lookup

const crypto = require('crypto');

/**
 * Generate a secure random API key with a readable prefix
 * Format: dak_<64 hex chars>
 */
function generateApiKey() {
  const raw = crypto.randomBytes(32).toString('hex');
  return `dak_${raw}`;
}

/**
 * Hash a key for storage — we store the hash, never the raw key
 */
function hashKey(key) {
  return crypto.createHash('sha256').update(key).digest('hex');
}

/**
 * Look up a raw key in the DB, verify it's active, and return its record
 * Returns null if not found, revoked, or expired
 */
async function findApiKey(pool, rawKey) {
  const keyHash = hashKey(rawKey);
  const [rows] = await pool.execute(
    `SELECT id, name, permissions, revoked, expires_at
     FROM api_keys
     WHERE key_hash = ?`,
    [keyHash]
  );

  if (rows.length === 0) return null;

  const record = rows[0];

  // Check revoked
  if (record.revoked) return null;

  // Check expiry (null = never expires)
  if (record.expires_at && new Date(record.expires_at) < new Date()) return null;

  // Update last_used_at (fire and forget — don't await)
  pool.execute('UPDATE api_keys SET last_used_at = NOW() WHERE id = ?', [record.id]).catch(() => {});

  return record;
}

module.exports = { generateApiKey, hashKey, findApiKey };
