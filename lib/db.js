import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("DATABASE_URL is not set!");
}

const pool = new Pool({
  connectionString,
  ssl: connectionString && connectionString.includes("sslmode=require")
    ? { rejectUnauthorized: false }
    : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Run once at startup to ensure indexes exist
let initialized = false;
async function ensureSetup() {
  if (initialized) return;
  try {
    await pool.query("ALTER TABLE items ADD COLUMN IF NOT EXISTS sku_sort TEXT");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_items_sku_sort ON items(sku_sort)");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_items_name ON items(name)");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_items_category ON items(category)");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_invoices_id ON invoices(id)");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_invoices_invoice_no ON invoices(invoice_no)");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_invoices_customer_name ON invoices(customer_name)");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON invoice_items(invoice_id)");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_invoice_items_item_id ON invoice_items(item_id)");
    await pool.query(`
      UPDATE items SET sku_sort = 
        CASE 
          WHEN sku ~ '^[A-Za-z]+[0-9]+$' THEN
            substring(sku from '^[A-Za-z]+') || 
            lpad(substring(sku from '[0-9]+$'), 10, '0')
          ELSE sku
        END
      WHERE sku_sort IS NULL AND sku IS NOT NULL
    `);
    initialized = true;
    console.log("Database setup completed");
  } catch (err) {
    console.error("Setup error:", err.message);
  }
}

// Run setup immediately
ensureSetup();

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
