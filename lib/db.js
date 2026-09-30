import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;

const pool = new Pool({
  connectionString,
  ssl: connectionString && connectionString.includes("sslmode=require")
    ? { rejectUnauthorized: false }
    : false,
  max: 20,
  idleTimeoutMillis: 60000,
  connectionTimeoutMillis: 10000,
  allowExitOnIdle: true,
});

// Migration state
let migrated = false;
let migrationPromise = null;

export async function ensureMigrated() {
  if (migrated) return;
  if (migrationPromise) return migrationPromise;

  migrationPromise = (async () => {
    try {
      await pool.query("SELECT 1 FROM items LIMIT 1");
      migrated = true;
    } catch {
      const { migrate } = await import("./migrate");
      await migrate();
      migrated = true;
    }
  })();

  return migrationPromise;
}

export async function sql(strings, ...values) {
  let text = "";
  strings.forEach((s, i) => {
    text += s;
    if (i < values.length) text += `$${i + 1}`;
  });
  const result = await pool.query(text, values);
  return result.rows;
}

export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
