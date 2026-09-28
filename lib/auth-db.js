import { sql, withTransaction } from "./db";

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
