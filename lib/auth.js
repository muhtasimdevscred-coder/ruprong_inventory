import { sql, withTransaction } from "./db";

const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
export const SESSION_COOKIE_NAME = "ruprong_session";

function bufToBase64Url(buf) {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const base64 = btoa(binary);
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function getKey() {
  const secret = process.env.SESSION_SECRET || "dev-secret-change-me";
  const enc = new TextEncoder();
  return crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
}

async function sign(payload) {
  const key = await getKey();
  const enc = new TextEncoder();
  const sigBuf = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return bufToBase64Url(sigBuf);
}

export async function createSessionToken(userId) {
  const payload = `ok.${Date.now()}.${userId || 0}`;
  const sig = await sign(payload);
  return `${payload}.${sig}`;
}

export async function verifySessionToken(token) {
  if (!token || typeof token !== "string") return false;
  const parts = token.split(".");
  // Support both old 3-part tokens (ok.timestamp.sig) and new 4-part tokens (ok.timestamp.userId.sig)
  if (parts.length === 3) {
    const [tag, ts, sig] = parts;
    const payload = `${tag}.${ts}`;
    const expectedSig = await sign(payload);
    if (expectedSig !== sig) return false;
    if (tag !== "ok") return false;
    const issuedAt = Number(ts);
    if (!Number.isFinite(issuedAt)) return false;
    if (Date.now() - issuedAt > SESSION_MAX_AGE_MS) return false;
    return true;
  }
  if (parts.length === 4) {
    const [tag, ts, uid, sig] = parts;
    const payload = `${tag}.${ts}.${uid}`;
    const expectedSig = await sign(payload);
    if (expectedSig !== sig) return false;
    if (tag !== "ok") return false;
    const issuedAt = Number(ts);
    if (!Number.isFinite(issuedAt)) return false;
    if (Date.now() - issuedAt > SESSION_MAX_AGE_MS) return false;
    return true;
  }
  return false;
}

export async function getSessionUserId(token) {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [tag, ts, uid, sig] = parts;
  const payload = `${tag}.${ts}.${uid}`;
  const expectedSig = await sign(payload);
  if (expectedSig !== sig) return null;
  if (tag !== "ok") return null;
  const issuedAt = Number(ts);
  if (!Number.isFinite(issuedAt)) return null;
  if (Date.now() - issuedAt > SESSION_MAX_AGE_MS) return null;
  return parseInt(uid, 10) || 0;
}

// Initialize default user from APP_PASSWORD if no users table exists yet
export async function ensureDefaultUser() {
  try {
    const rows = await sql`SELECT id FROM users LIMIT 1`;
    if (rows.length === 0 && process.env.APP_PASSWORD) {
      await sql`INSERT INTO users (username, password) VALUES ('admin', ${process.env.APP_PASSWORD})`;
    }
  } catch {
    // Table doesn't exist yet — will be created by migration
  }
}

export async function checkPassword(username, password) {
  if (!username || !password) return null;
  try {
    const rows = await sql`SELECT id, username FROM users WHERE username = ${username} AND password = ${password}`;
    return rows.length > 0 ? rows[0] : null;
  } catch {
    // Table doesn't exist — fall back to env var
    if (process.env.APP_PASSWORD && password === process.env.APP_PASSWORD) {
      return { id: 0, username: "admin" };
    }
    return null;
  }
}

export async function getUsers() {
  try {
    return await sql`SELECT id, username, created_at FROM users ORDER BY id`;
  } catch {
    return [];
  }
}

export async function createUser(username, password) {
  const uname = (username || "").trim();
  if (!uname || !password) return { error: "Username and password are required." };
  try {
    const rows = await sql`INSERT INTO users (username, password) VALUES (${uname}, ${password}) RETURNING id, username`;
    return { user: rows[0] };
  } catch (err) {
    if (String(err.message || err).includes("duplicate key")) {
      return { error: `Username '${uname}' already exists.` };
    }
    return { error: "Could not create user." };
  }
}

export async function updateUser(id, updates) {
  const fields = [];
  const values = [];
  if (updates.username !== undefined) {
    fields.push(`username = $${fields.length + 1}`);
    values.push(updates.username.trim());
  }
  if (updates.password !== undefined) {
    fields.push(`password = $${fields.length + 1}`);
    values.push(updates.password);
  }
  if (fields.length === 0) return { error: "Nothing to update." };
  values.push(id);
  try {
    const setClause = fields.join(", ");
    const query = `UPDATE users SET ${setClause} WHERE id = $${values.length} RETURNING id, username`;
    const result = await withTransaction(async (client) => {
      return await client.query(query, values);
    });
    if (result.rows.length === 0) return { error: "User not found." };
    return { user: result.rows[0] };
  } catch (err) {
    if (String(err.message || err).includes("duplicate key")) {
      return { error: "Username already exists." };
    }
    return { error: "Could not update user." };
  }
}

export async function deleteUser(id) {
  try {
    const rows = await sql`DELETE FROM users WHERE id = ${id} RETURNING id`;
    if (rows.length === 0) return { error: "User not found." };
    return { ok: true };
  } catch {
    return { error: "Could not delete user." };
  }
}
