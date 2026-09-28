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

  // Recreate items table without weight, purity, stone columns
  try {
    await withTransaction(async (client) => {
      // Check if items table has weight column
      const { rows } = await client.query(
        "SELECT column_name FROM information_schema.columns WHERE table_name = 'items' AND column_name = 'weight'"
      );
      if (rows.length > 0) {
        // Rename old table, create new one, copy data, drop old
        await client.query("ALTER TABLE items RENAME TO items_old");
        await client.query(`
          CREATE TABLE items (
            id SERIAL PRIMARY KEY,
            sku TEXT,
            name TEXT NOT NULL,
            category TEXT,
            quantity INTEGER DEFAULT 0,
            price NUMERIC DEFAULT 0,
            cost_price NUMERIC,
            notes TEXT,
            image_url TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW()
          )`);
        await client.query(`
          INSERT INTO items (id, sku, name, category, quantity, price, cost_price, notes, image_url)
          SELECT id, sku, name, category, quantity, price, cost_price, notes, image_url FROM items_old
        `);
        await client.query("DROP TABLE items_old");
        await client.query("ALTER SEQUENCE items_id_seq RESTART WITH 1");
      }
    });
  } catch (err) {
    console.error("Migration error:", err.message);
  }
}
