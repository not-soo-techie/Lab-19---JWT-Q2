# Lab 19 – Q2: JWT Authentication with Prisma

## Objective

In **Q1** you stored users in an in-memory array, so every server restart wiped them out.
In this question you will build the **same** token based authentication API, but every user is **stored in and fetched from a real database using [Prisma ORM](https://www.prisma.io/)** (SQLite, so no database server to install).

Your API must let a user:

1. **Register** with a username and password. The password is **hashed** with `bcrypt` and the user is saved with **`prisma.user.create()`**.
2. **Log in**. The user is fetched with **`prisma.user.findUnique()`**, the password is checked, and a **JWT** is returned in the response body.
3. Use that token as a **Bearer token** to access a **protected route**, which fetches the user's latest data **from the database**.

---

## Background

### How token based authentication works (with a database)

```
 ┌────────┐  1. POST /register {username, password}        ┌────────┐            ┌──────────┐
 │        │ ─────────────────────────────────────────────▶ │        │ findUnique │          │
 │        │                                                │        │ ─────────▶ │          │
 │        │                                                │        │ bcrypt.hash│          │
 │        │  201 { user: {id, username} }                  │        │ create     │          │
 │        │ ◀───────────────────────────────────────────── │        │ ─────────▶ │          │
 │        │                                                │        │            │          │
 │        │  2. POST /login {username, password}           │        │ findUnique │  SQLite  │
 │ Client │ ─────────────────────────────────────────────▶ │ Server │ ─────────▶ │  (via    │
 │        │                                                │        │ bcrypt.    │  Prisma) │
 │        │  200 { token: "eyJhbGciOi..." }                │        │ compare    │          │
 │        │ ◀───────────────────────────────────────────── │        │ jwt.sign   │          │
 │        │                                                │        │            │          │
 │        │  3. GET /profile                               │        │ jwt.verify │          │
 │        │     Authorization: Bearer eyJhbGciOi...        │        │ findUnique │          │
 │        │ ─────────────────────────────────────────────▶ │        │ ─────────▶ │          │
 │        │  200 { user: {id, username, createdAt} }       │        │            │          │
 │        │ ◀───────────────────────────────────────────── │        │            │          │
 └────────┘                                                └────────┘            └──────────┘
```

### Key ideas

| Concept | Why it matters |
|---|---|
| **Prisma schema** | `prisma/schema.prisma` describes your tables (models). Prisma uses it to create the database table **and** to generate a typed client (`prisma.user.*`). |
| **Prisma Client** | A JS object to query the DB: `prisma.user.create()`, `prisma.user.findUnique()`, … Every call returns a **Promise**, so use `await`. |
| **`select`** | Picks which columns to return. Use it to make sure the password hash is **never** sent to the client. |
| **Hashing (bcrypt)** | Never store plain‑text passwords. `bcrypt.hash()` creates the hash; `bcrypt.compare()` checks a password against it. |
| **JWT** | A signed `header.payload.signature` string. Anyone can *read* the payload, but nobody can *change* it without the secret. |
| **Bearer token** | The client sends `Authorization: Bearer <token>` with every protected request. |

> ⚠️ The JWT payload is only **Base64URL encoded, not encrypted**. Never put passwords in it.

### Prisma cheat sheet

```js
// Create a row
await prisma.user.create({ data: { username: 'alice', password: hash } });

// Find ONE row by a unique field (returns the row or null)
await prisma.user.findUnique({ where: { username: 'alice' } });

// Find by id and return only some columns
await prisma.user.findUnique({
  where: { id: 1 },
  select: { id: true, username: true, createdAt: true },
});
```

---

## Project Structure

```
Q2/
├── .env.example            ← copy to .env
├── package.json
├── README.md
├── prisma/
│   └── schema.prisma       ← 📝 TODO 0: define the User model
├── src/
│   ├── app.js              ← 📝 TODO: /register, /login, /profile routes
│   ├── server.js           ← starts the server (do not change)
│   ├── config.js           ← JWT_SECRET, JWT_EXPIRES_IN, SALT_ROUNDS (do not change)
│   ├── db/
│   │   └── prisma.js       ← shared PrismaClient instance (do not change)
│   └── middleware/
│       └── auth.js         ← 📝 TODO: authenticateToken middleware
└── tests/
    ├── auth.test.js        ← automated tests (do not change)
    ├── globalSetup.js      ← syncs your schema to test.db before tests
    └── setupEnv.js         ← points tests at test.db
```

You need to edit **`prisma/schema.prisma`**, **`src/app.js`** and **`src/middleware/auth.js`**. Each one has numbered `TODO` comments.

---

## Setup

```bash
npm install               # installs deps and runs `prisma generate`
cp .env.example .env      # creates your .env (DATABASE_URL + JWT_SECRET)

# after you finish Task 0 (the User model):
npx prisma db push        # creates prisma/dev.db with the User table

npm run dev               # start the server on http://localhost:3000
npm test                  # run the test suite
npx prisma studio         # (optional) browse your database in the browser
```

Packages included: `express`, `bcryptjs`, `jsonwebtoken`, `prisma` + `@prisma/client`, `jest` + `supertest`.

> 🧪 Tests use a **separate** database file (`prisma/test.db`), so running tests never deletes the users in your `dev.db`. Your schema is pushed to `test.db` automatically each time you run `npm test`.

---

## Tasks

### Task 0 – Define the `User` model (`prisma/schema.prisma`)

| Field | Type | Rules |
|---|---|---|
| `id` | `Int` | primary key, auto‑increment → `@id @default(autoincrement())` |
| `username` | `String` | must be unique → `@unique` |
| `password` | `String` | stores the bcrypt **hash** |
| `createdAt` | `DateTime` | set automatically → `@default(now())` |

Then run `npx prisma db push`. If you skip this task, every test fails with `prisma.user is undefined`.

---

### Task 1 – `POST /register`

**Request body**
```json
{ "username": "alice", "password": "password123" }
```

**Steps**
1. Read `username` and `password` from `req.body`.
2. If either is missing → **400**.
3. `prisma.user.findUnique({ where: { username } })`. If a user is found → **409**.
4. Hash the password: `await bcrypt.hash(password, SALT_ROUNDS)`.
5. Save the user: `prisma.user.create({ data: { username, password: hashedPassword } })`.
6. Respond **201** — **without** the password.

| Status | When | Body |
|---|---|---|
| `201` | Success | `{ "message": "User registered successfully", "user": { "id": 1, "username": "alice" } }` |
| `400` | Missing username or password | `{ "message": "Username and password are required" }` |
| `409` | Username already taken | `{ "message": "Username already exists" }` |
| `500` | Unexpected DB error | `{ "message": "Internal server error" }` |

---

### Task 2 – `POST /login`

**Request body**
```json
{ "username": "alice", "password": "password123" }
```

**Steps**
1. Read `username` and `password` from `req.body`.
2. If either is missing → **400**.
3. `prisma.user.findUnique({ where: { username } })`. Not found → **401**.
4. `await bcrypt.compare(password, user.password)`. No match → **401**.
5. Sign a token with a payload of `{ id, username }`:
   ```js
   jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })
   ```
6. Respond **200** with the token in the body.

> 💡 **Security tip:** Use the **same** message for "user not found" and "wrong password" (`Invalid username or password`). Otherwise an attacker can find out which usernames exist. A test checks this.

| Status | When | Body |
|---|---|---|
| `200` | Success | `{ "message": "Login successful", "token": "<jwt>" }` |
| `400` | Missing username or password | `{ "message": "Username and password are required" }` |
| `401` | Unknown user **or** wrong password | `{ "message": "Invalid username or password" }` |

---

### Task 3 – `authenticateToken` middleware (`src/middleware/auth.js`)

Runs **before** the protected route handler. It does **not** need the database.

**Steps**
1. Read `req.headers['authorization']`. Missing → **401**.
2. Split `Bearer <token>`. If the first part isn't exactly `Bearer` or the token is empty → **401**.
3. `jwt.verify(token, JWT_SECRET)` inside `try/catch`. If it throws (tampered, wrong secret, expired or malformed token) → **403**.
4. Set `req.user = decoded` and call `next()`.

| Status | When | Body |
|---|---|---|
| `401` | No `Authorization` header | `{ "message": "Access denied. No token provided" }` |
| `401` | Header is not `Bearer <token>` | `{ "message": "Invalid authorization format. Use: Bearer <token>" }` |
| `403` | Token invalid, tampered or expired | `{ "message": "Invalid or expired token" }` |

> **401 vs 403** – In this lab, `401` means *"you did not send credentials"* and `403` means *"you sent a token, but it is not valid"*.

---

### Task 4 – `GET /profile` (protected)

**Request header**
```
Authorization: Bearer <token from /login>
```

**Steps**
1. Fetch the user from the database using `req.user.id`, with `select` so the password is excluded.
2. If not found (e.g. the user was deleted after the token was issued) → **404**.
3. Respond **200** with the user.

| Status | When | Body |
|---|---|---|
| `200` | Success | `{ "message": "Profile fetched successfully", "user": { "id": 1, "username": "alice", "createdAt": "2026-11-03T10:00:00.000Z" } }` |
| `404` | Valid token, but the user no longer exists | `{ "message": "User not found" }` |

> 🤔 **Why look the user up again?** The token only proves *who you were when you logged in*. Fetching from the DB gives you up‑to‑date data and catches users that have been deleted.

---

## Testing Your Solution

### Automated tests

```bash
npm test
```

All tests fail at the start. The suite has **28 tests**:

| # | Area | What is checked |
|---|---|---|
| 1–9 | `POST /register` | 201 response, no password leaked, **row saved in DB**, **password stored as bcrypt hash**, `createdAt` set, unique ids, 400 on missing fields, 409 on duplicate |
| 10–17 | `POST /login` | 200 + token, valid JWT signed with `JWT_SECRET`, payload has `id`/`username` (matching the DB row) but **no password**, has `exp`, 401 on wrong password / unknown user, same message for both, 400 on missing fields |
| 18–26 | `GET /profile` | 200 with valid token, **`createdAt` fetched from DB**, **404 when user was deleted**, 401 with no header / wrong scheme / empty token, 403 for tampered, wrong‑secret, expired and garbage tokens |
| 27–28 | Full flow | register → login → profile, and different users get their own identity |

Run one group at a time:
```bash
npx jest -t "POST /register"
npx jest -t "POST /login"
npx jest -t "GET /profile"
```

### Manual testing (curl / Postman / Thunder Client)

```bash
# 1. Register
curl -X POST http://localhost:3000/register \
  -H "Content-Type: application/json" \
  -d '{"username":"alice","password":"password123"}'

# 2. Login – copy the token from the response
curl -X POST http://localhost:3000/login \
  -H "Content-Type: application/json" \
  -d '{"username":"alice","password":"password123"}'

# 3. Access the protected route
curl http://localhost:3000/profile \
  -H "Authorization: Bearer <PASTE_TOKEN_HERE>"

# 4. Try without a token (should be 401)
curl -i http://localhost:3000/profile
```

✅ **Persistence check:** restart the server and log in again with the same credentials. Unlike Q1, the user is still there.

💡 Open `npx prisma studio` to see the stored hash in the `User` table, and paste your token into [jwt.io](https://jwt.io) to see its payload.

---

## Hints

- Every Prisma call returns a **Promise**, so use `await` inside `async` handlers.
- `findUnique` returns `null` (it doesn't throw) when no row matches.
- `return` after sending a response so the rest of the handler does not run.
- Wrap DB code in `try/catch` and respond `500` on unexpected errors.
- After **any** change to `schema.prisma`, run `npx prisma db push` again.
- If `npm test` fails with a *"data loss"* warning after you change the schema, delete `prisma/test.db` and run the tests again. The test DB is safe to throw away.

---

## Bonus Challenges (not tested)

1. Instead of checking `findUnique` before `create`, catch Prisma's unique‑constraint error (`P2002`) and return 409.
2. Add an `email` field to the `User` model and allow login with either username or email.
3. Add a `Note` model related to `User` and a protected `POST /notes` route that saves notes for `req.user.id`.
4. Use `prisma migrate dev --name init` instead of `db push` to create versioned migrations.

---

## Submission Checklist

- [ ] `User` model defined in `prisma/schema.prisma`
- [ ] `npm test` shows **28 passed**
- [ ] Passwords are stored as bcrypt hashes (check with `npx prisma studio`)
- [ ] No password or hash in any response or JWT payload
- [ ] Users survive a server restart
