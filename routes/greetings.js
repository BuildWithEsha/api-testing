// routes/greetings.js
const express = require('express');
const router = express.Router();

// GET /api/greetings - list all greetings with user info
router.get('/', async (req, res) => {
  try {
    const pool = req.app.get('dbPool');
    const [rows] = await pool.execute(`
      SELECT g.id, g.message, g.language, g.created_at,
             u.id as user_id, u.name as user_name, u.email as user_email
      FROM greetings g
      JOIN users u ON u.id = g.user_id
      ORDER BY g.id
    `);
    res.json({ count: rows.length, greetings: rows });
  } catch (err) {
    console.error('[GET /api/greetings]', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

// GET /api/greetings/random - get one random greeting
router.get('/random', async (req, res) => {
  try {
    const pool = req.app.get('dbPool');
    const [rows] = await pool.execute(`
      SELECT g.id, g.message, g.language,
             u.name as user_name
      FROM greetings g
      JOIN users u ON u.id = g.user_id
      ORDER BY RAND()
      LIMIT 1
    `);
    res.json({ greeting: rows[0] || null });
  } catch (err) {
    console.error('[GET /api/greetings/random]', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

// GET /api/greetings/user/:userId - greetings for a specific user
router.get('/user/:userId', async (req, res) => {
  try {
    const pool = req.app.get('dbPool');
    const [rows] = await pool.execute(`
      SELECT g.id, g.message, g.language, g.created_at
      FROM greetings g
      WHERE g.user_id = ?
      ORDER BY g.id
    `, [req.params.userId]);
    res.json({ count: rows.length, greetings: rows });
  } catch (err) {
    console.error('[GET /api/greetings/user/:userId]', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;
