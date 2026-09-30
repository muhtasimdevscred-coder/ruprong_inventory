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

  // Create items table if it doesn't exist
  await sql`
    CREATE TABLE IF NOT EXISTS items (
      id SERIAL PRIMARY KEY,
      sku TEXT,
      sku_sort TEXT,
      name TEXT NOT NULL,
      category TEXT,
      quantity INTEGER DEFAULT 0,
      price NUMERIC DEFAULT 0,
      cost_price NUMERIC,
      notes TEXT,
      image_url TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`;

  // Add sku_sort column if it doesn't exist
  try {
    await sql`ALTER TABLE items ADD COLUMN IF NOT EXISTS sku_sort TEXT`;
  } catch (err) {
    // Column already exists
  }

  // Create index on sku_sort for fast ordering
  try {
    await sql`CREATE INDEX IF NOT EXISTS idx_items_sku_sort ON items(sku_sort)`;
  } catch (err) {
    // Index already exists
  }

  // Drop weight, purity, stone columns if they exist (for existing databases)
  try {
    await withTransaction(async (client) => {
      const { rows } = await client.query(
        "SELECT column_name FROM information_schema.columns WHERE table_name = 'items' AND column_name = 'weight'"
      );
      if (rows.length > 0) {
        await client.query("ALTER TABLE items DROP COLUMN IF EXISTS weight");
        await client.query("ALTER TABLE items DROP COLUMN IF EXISTS purity");
        await client.query("ALTER TABLE items DROP COLUMN IF EXISTS stone");
      }
    });
  } catch (err) {
    console.error("Migration error:", err.message);
  }

  // Create invoices table if it doesn't exist
  await sql`
    CREATE TABLE IF NOT EXISTS invoices (
      id SERIAL PRIMARY KEY,
      invoice_no TEXT,
      invoice_date DATE,
      customer_name TEXT,
      customer_phone TEXT,
      customer_address TEXT,
      parcel_id TEXT,
      subtotal NUMERIC DEFAULT 0,
      discount_type TEXT DEFAULT 'none',
      discount_value NUMERIC DEFAULT 0,
      discount_amount NUMERIC DEFAULT 0,
      delivery_charge NUMERIC DEFAULT 0,
      total NUMERIC DEFAULT 0
    )`;

  // Create invoice_items table if it doesn't exist
  await sql`
    CREATE TABLE IF NOT EXISTS invoice_items (
      id SERIAL PRIMARY KEY,
      invoice_id INTEGER REFERENCES invoices(id) ON DELETE CASCADE,
      item_id INTEGER REFERENCES items(id),
      description TEXT,
      quantity INTEGER DEFAULT 0,
      unit_price NUMERIC DEFAULT 0,
      line_total NUMERIC DEFAULT 0,
      cost_price NUMERIC
    )`;

  // Populate sku_sort for existing items
  try {
    await sql`
      UPDATE items SET sku_sort = 
        CASE 
          WHEN sku ~ '^[A-Za-z]+[0-9]+$' THEN
            substring(sku from '^[A-Za-z]+') || 
            lpad(substring(sku from '[0-9]+$'), 10, '0')
          ELSE sku
        END
      WHERE sku_sort IS NULL AND sku IS NOT NULL
    `;
  } catch (err) {
    console.error("SKU sort population error:", err.message);
  }
}
