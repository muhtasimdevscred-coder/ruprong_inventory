import { sql, withTransaction } from "./db";

export async function migrate() {
  // Create users table if it doesn't exist
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`;

  // Drop weight, purity, stone columns from items table if they exist
  try {
    await withTransaction(async (client) => {
      await client.query("ALTER TABLE items DROP COLUMN IF EXISTS weight");
      await client.query("ALTER TABLE items DROP COLUMN IF EXISTS purity");
      await client.query("ALTER TABLE items DROP COLUMN IF EXISTS stone");
    });
  } catch (err) {
    console.error("Migration error:", err.message);
  }
}
