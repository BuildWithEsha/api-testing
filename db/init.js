// db/init.js
// Creates the database schema and seeds demo data on first run

async function initDatabase(pool) {
  const connection = await pool.getConnection();
  try {
    // Users table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        role VARCHAR(100) DEFAULT 'member',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Greetings table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS greetings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        message VARCHAR(500) NOT NULL,
        language VARCHAR(50) DEFAULT 'en',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // API Keys table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS api_keys (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        key_hash VARCHAR(64) NOT NULL UNIQUE,
        key_prefix VARCHAR(20) NOT NULL,
        permissions JSON NOT NULL DEFAULT ('["*"]'),
        revoked TINYINT(1) NOT NULL DEFAULT 0,
        last_used_at TIMESTAMP NULL,
        expires_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Check if data already seeded
    const [rows] = await connection.execute('SELECT COUNT(*) as cnt FROM users');
    if (rows[0].cnt === 0) {
      console.log('[DB] Seeding demo data...');

      // Seed users
      await connection.execute(`
        INSERT INTO users (name, email, role) VALUES
        ('Alice Johnson', 'alice@example.com', 'admin'),
        ('Bob Smith', 'bob@example.com', 'member'),
        ('Carla Mendes', 'carla@example.com', 'member'),
        ('David Lee', 'david@example.com', 'manager'),
        ('Esha Rehman', 'esha@example.com', 'member')
      `);

      // Seed greetings
      await connection.execute(`
        INSERT INTO greetings (user_id, message, language) VALUES
        (1, 'Hello! Welcome to the demo API.', 'en'),
        (2, 'Hi there, hope you have a great day!', 'en'),
        (3, 'Olá! Tudo bem?', 'pt'),
        (4, 'Good morning, David. Ready for the standup?', 'en'),
        (5, 'Salam! Welcome aboard, Esha.', 'en')
      `);

      console.log('[DB] Seed complete: 5 users, 5 greetings');
    } else {
      console.log('[DB] Data already exists, skipping seed');
    }
  } finally {
    connection.release();
  }
}

module.exports = { initDatabase };
