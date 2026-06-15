// routes/users.js
const express = require('express');
const router = express.Router();

// GET /api/users - list all users
router.get('/', async (req, res) => {
  try {
    const pool = req.app.get('dbPool');
    const [rows] = await pool.execute(
      'SELECT id, name, email, role, created_at FROM users ORDER BY id'
    );
    res.json({ count: rows.length, users: rows });
  } catch (err) {
    console.error('[GET /api/users]', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

// GET /api/users/:id - get single user
router.get('/:id', async (req, res) => {
  try {
    const pool = req.app.get('dbPool');
    const [rows] = await pool.execute(
      'SELECT id, name, email, role, created_at FROM users WHERE id = ?',
      [req.params.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ user: rows[0] });
  } catch (err) {
    console.error('[GET /api/users/:id]', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;
