// routes/admin.js
// Admin endpoints for managing API keys
// All routes protected by requireAdminPassword middleware

const express = require('express');
const router = express.Router();
const { generateApiKey, hashKey } = require('../helpers/apiKeys');

// GET /admin/keys - list all API keys (without revealing the actual key)
router.get('/keys', async (req, res) => {
  try {
    const pool = req.app.get('dbPool');
    const [rows] = await pool.execute(`
      SELECT id, name, permissions, revoked, last_used_at, created_at, expires_at
      FROM api_keys
      ORDER BY created_at DESC
    `);

    const keys = rows.map(k => ({
      id: k.id,
      name: k.name,
      permissions: JSON.parse(k.permissions || '[]'),
      revoked: !!k.revoked,
      lastUsed: k.last_used_at,
      createdAt: k.created_at,
      expiresAt: k.expires_at
    }));

    res.json({ count: keys.length, keys });
  } catch (err) {
    console.error('[GET /admin/keys]', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

// POST /admin/keys - create a new API key
// Body: { name: "My App", permissions: ["read:users", "read:greetings"] }
router.post('/keys', async (req, res) => {
  const { name, permissions } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'name is required' });
  }

  const validPerms = ['*', 'read:users', 'read:greetings'];
  const requestedPerms = Array.isArray(permissions) ? permissions : ['*'];
  const invalidPerms = requestedPerms.filter(p => !validPerms.includes(p));

  if (invalidPerms.length > 0) {
    return res.status(400).json({
      error: `Invalid permissions: ${invalidPerms.join(', ')}. Valid options: ${validPerms.join(', ')}`
    });
  }

  try {
    const pool = req.app.get('dbPool');
    const rawKey = generateApiKey();
    const keyHash = hashKey(rawKey);
    const permsJson = JSON.stringify(requestedPerms);

    const [result] = await pool.execute(
      `INSERT INTO api_keys (name, key_hash, key_prefix, permissions)
       VALUES (?, ?, ?, ?)`,
      [name.trim(), keyHash, rawKey.slice(0, 12), permsJson]
    );

    res.status(201).json({
      message: 'API key created. Copy it now — it will not be shown again.',
      key: rawKey,          // ← Only time the raw key is returned
      id: result.insertId,
      name: name.trim(),
      permissions: requestedPerms
    });
  } catch (err) {
    console.error('[POST /admin/keys]', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

// DELETE /admin/keys/:id - revoke a key
router.delete('/keys/:id', async (req, res) => {
  try {
    const pool = req.app.get('dbPool');
    const [result] = await pool.execute(
      'UPDATE api_keys SET revoked = 1 WHERE id = ?',
      [req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Key not found' });
    }

    res.json({ message: 'API key revoked successfully' });
  } catch (err) {
    console.error('[DELETE /admin/keys/:id]', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

// GET /admin/keys/stats - quick stats
router.get('/keys/stats', async (req, res) => {
  try {
    const pool = req.app.get('dbPool');
    const [rows] = await pool.execute(`
      SELECT
        COUNT(*) as total,
        SUM(revoked = 0) as active,
        SUM(revoked = 1) as revoked,
        SUM(last_used_at IS NOT NULL AND revoked = 0) as used_at_least_once
      FROM api_keys
    `);
    res.json(rows[0]);
  } catch (err) {
    console.error('[GET /admin/keys/stats]', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;
