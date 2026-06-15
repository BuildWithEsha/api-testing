// server.js
require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const path = require('path');

const { initDatabase } = require('./db/init');
const { requirePermission, requireAdminPassword } = require('./middleware/auth');
const usersRouter = require('./routes/users');
const greetingsRouter = require('./routes/greetings');
const adminRouter = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// ─── Serve frontend static files ─────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ─── Database connection pool ──────────────────────────────
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'demo-api-mysql',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'demo_user',
  password: process.env.DB_PASSWORD || 'demo_pass',
  database: process.env.DB_NAME || 'demo_api_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

app.set('dbPool', pool);

// ─── Public routes (no auth) ────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/api/docs', (req, res) => {
  res.json({
    authentication: {
      type: 'Bearer token',
      header: 'Authorization: Bearer YOUR_API_KEY',
      note: 'Generate API keys via the admin UI or POST /admin/keys'
    },
    endpoints: [
      { method: 'GET', path: '/api/users', description: 'List all users', auth: 'read:users' },
      { method: 'GET', path: '/api/users/:id', description: 'Get a single user', auth: 'read:users' },
      { method: 'GET', path: '/api/greetings', description: 'List all greetings', auth: 'read:greetings' },
      { method: 'GET', path: '/api/greetings/random', description: 'Get a random greeting', auth: 'read:greetings' },
      { method: 'GET', path: '/api/greetings/user/:userId', description: 'Greetings for a user', auth: 'read:greetings' }
    ],
    admin: {
      note: 'Admin routes require: Authorization: Admin YOUR_ADMIN_PASSWORD',
      endpoints: [
        { method: 'GET', path: '/admin/keys', description: 'List all API keys' },
        { method: 'POST', path: '/admin/keys', description: 'Create a new API key' },
        { method: 'DELETE', path: '/admin/keys/:id', description: 'Revoke a key' },
        { method: 'GET', path: '/admin/keys/stats', description: 'Key usage stats' }
      ]
    }
  });
});

// ─── Admin routes (require admin password) ─────────────────
app.use('/admin', requireAdminPassword, adminRouter);

// ─── Protected API routes (require API key + permissions) ───
app.use('/api/users', requirePermission('read:users'), usersRouter);
app.use('/api/greetings', requirePermission('read:greetings'), greetingsRouter);

// ─── 404 handler ────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ─── Start server ────────────────────────────────────────────
async function start() {
  let retries = 15;
  while (retries > 0) {
    try {
      const conn = await pool.getConnection();
      conn.release();
      break;
    } catch (err) {
      retries--;
      console.log(`[DB] Waiting for MySQL... (${retries} retries left)`);
      await new Promise(r => setTimeout(r, 3000));
      if (retries === 0) {
        console.error('[DB] Could not connect to MySQL:', err.message);
        process.exit(1);
      }
    }
  }

  await initDatabase(pool);

  app.listen(PORT, () => {
    console.log(`[SERVER] Demo API running on port ${PORT}`);
    console.log(`[SERVER] Admin UI: http://localhost:${PORT}`);
    console.log(`[SERVER] Admin password configured: ${process.env.ADMIN_PASSWORD ? 'YES' : 'NO (set ADMIN_PASSWORD!)'}`);
  });
}

start();
