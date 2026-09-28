import { sql } from "./db";

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
    await sql`ALTER TABLE items DROP COLUMN IF EXISTS weight`;
    await sql`ALTER TABLE items DROP COLUMN IF EXISTS purity`;
    await sql`ALTER TABLE items DROP COLUMN IF EXISTS stone`;
  } catch {
    // Columns might not exist, ignore
  }
}
