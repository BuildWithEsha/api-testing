# Demo API — Documentation

A proof-of-concept API server + frontend key manager that mirrors the
pattern you'd later use for the real **EMS API**.

```
Demo API Server (Portainer, own MySQL)  ──►  Any external app / local client
   /api/users            ┐                    reads API key from .env
   /api/greetings        ┘ (per-key perms)    sends Authorization: Bearer ...
   
   Admin UI (browser)    ──► generate/view/revoke keys with permission control
```

---

## 1. What gets deployed

Two containers, one stack, in `demo-api-server/`:

| Service | Image | Purpose |
|---|---|---|
| `demo-api-mysql` | `mysql:8.4` | Its own database, separate from EMS |
| `demo-api-app` | Node 20 (Dockerfile) | Express API + serves the admin frontend |

On first boot the app:
1. Waits for MySQL to be healthy
2. Creates `users`, `greetings`, and `api_keys` tables
3. Seeds 5 demo users + 5 demo greetings (only if empty)

---

## 2. Authentication — two levels

### Admin access (managing keys)
Used to log into the frontend UI and call `/admin/*` routes.

```
Authorization: Admin YOUR_ADMIN_PASSWORD
```

Set `ADMIN_PASSWORD` in `.env`. This is separate from API keys.

### API key access (data endpoints)
Used by external apps to call `/api/*` routes.

```
Authorization: Bearer dak_<64hex>
```

Keys are generated via the frontend or `POST /admin/keys`. Each key
has specific permissions and is stored hashed in the `api_keys` table.

---

## 3. The frontend (Admin UI)

Visit the server root in your browser (e.g. `https://demo-api.yourserver.com`).

**Login screen:** enter your `ADMIN_PASSWORD`.

**API Keys page:**
- See stats: total / active / used keys
- Create a new key — choose a name and permissions, click Create
- The full key is shown **once** — copy it immediately
- Revoke any active key instantly (apps using it lose access right away)

**Endpoints page:** shows all available routes and the curl example.

---

## 4. Data endpoints

Base URL: wherever you deploy (e.g. `https://demo-api.yourserver.com`)

All require `Authorization: Bearer YOUR_API_KEY`.

### `GET /health` — no auth
Returns `{ status: "ok", timestamp: "..." }`.

### `GET /api/docs` — no auth
Machine-readable endpoint list (JSON).

### `GET /api/users` — requires `read:users` or `*`
Returns all users.

```json
{ "count": 5, "users": [{ "id": 1, "name": "Alice Johnson", "email": "alice@example.com", "role": "admin", "created_at": "..." }] }
```

### `GET /api/users/:id` — requires `read:users` or `*`
Single user by ID.

### `GET /api/greetings` — requires `read:greetings` or `*`
All greetings, joined with user info.

### `GET /api/greetings/random` — requires `read:greetings` or `*`
One random greeting.

### `GET /api/greetings/user/:userId` — requires `read:greetings` or `*`
All greetings for one user.

---

## 5. Admin API endpoints

All require `Authorization: Admin YOUR_ADMIN_PASSWORD`.

| Method | Path | Description |
|---|---|---|
| `GET` | `/admin/keys` | List all keys (never exposes raw key value) |
| `POST` | `/admin/keys` | Create a key — returns raw key once only |
| `DELETE` | `/admin/keys/:id` | Revoke a key |
| `GET` | `/admin/keys/stats` | Total / active / used counts |

**POST /admin/keys body:**
```json
{ "name": "My Local Client", "permissions": ["read:users"] }
```

Valid permissions: `"*"` (all), `"read:users"`, `"read:greetings"`.

---

## 6. Deploying on Portainer

1. Upload the `demo-api-server/` folder to your server.

2. Create `.env` from `.env.example`:
   ```bash
   cp .env.example .env
   ```
   Fill in:
   ```env
   MYSQL_ROOT_PASSWORD=<strong random password>
   DB_NAME=demo_api_db
   DB_USER=demo_user
   DB_PASSWORD=<strong random password>
   ADMIN_PASSWORD=<your chosen admin password>
   ```

3. In Portainer → Stacks → Add Stack → upload `docker-compose.yml`
   and paste the env vars from your `.env`.

4. Deploy. Portainer starts MySQL, waits for healthy, then starts the app.

5. Expose via Cloudflare Tunnel (same as EMS) or direct port 4000.

6. Verify:
   ```bash
   curl https://demo-api.yourserver.com/health
   # {"status":"ok","timestamp":"..."}
   ```

7. Open the URL in your browser → log in → create your first API key.

---

## 7. Running the local client

```bash
cd demo-api-client
npm install
cp .env.example .env
```

Edit `.env`:
```env
API_BASE_URL=https://demo-api.yourserver.com
API_KEY=dak_<paste key from frontend>
```

Run:
```bash
npm start
```

---

## 8. How this maps to a future EMS API

| Demo API | Future EMS API |
|---|---|
| `api_keys` table + frontend | Same pattern in EMS settings |
| `requirePermission('read:users')` | `requirePermission('read:employees')` etc. |
| `GET /api/users` | `GET /api/external/employees` |
| `GET /api/greetings` | `GET /api/external/tasks`, `/workload` |
| Bearer token in client `.env` | Same — any external app |

---

## 9. Troubleshooting

| Symptom | Cause |
|---|---|
| `401` on login | Wrong `ADMIN_PASSWORD` |
| `403 Invalid or revoked API key` | Key was revoked, or wrong key |
| `403 does not have permission` | Key lacks the required permission |
| Client: `ECONNREFUSED` | `API_BASE_URL` wrong or server unreachable |
| MySQL wait loop | Check `demo-api-mysql` container is healthy |
