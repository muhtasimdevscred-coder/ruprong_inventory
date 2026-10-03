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

// Simple in-memory cache with TTL
const cache = new Map();
const CACHE_TTL = 30000; // 30 seconds

function getCacheKey(text, values) {
  return text + JSON.stringify(values);
}

function getCached(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCached(key, data) {
  cache.set(key, { data, timestamp: Date.now() });
}

export function invalidateCache() {
  cache.clear();
}

// Run once at startup to ensure indexes exist
let initialized = false;
async function ensureSetup() {
  if (initialized) return;
  try {
    await pool.query("CREATE EXTENSION IF NOT EXISTS pg_trgm");
    await pool.query("ALTER TABLE items ADD COLUMN IF NOT EXISTS sku_sort TEXT");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_items_sku_sort ON items(sku_sort)");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_items_name ON items(name)");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_items_category ON items(category)");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_items_name_trgm ON items USING gin(name gin_trgm_ops)");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_items_sku_trgm ON items USING gin(sku gin_trgm_ops)");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_items_category_trgm ON items USING gin(category gin_trgm_ops)");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_invoices_id ON invoices(id)");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_invoices_invoice_no ON invoices(invoice_no)");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_invoices_customer_name ON invoices(customer_name)");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_invoices_customer_phone ON invoices(customer_phone)");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_invoices_parcel_id ON invoices(parcel_id)");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_invoices_invoice_no_trgm ON invoices USING gin(invoice_no gin_trgm_ops)");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_invoices_customer_name_trgm ON invoices USING gin(customer_name gin_trgm_ops)");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_invoices_customer_phone_trgm ON invoices USING gin(customer_phone gin_trgm_ops)");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_invoices_parcel_id_trgm ON invoices USING gin(parcel_id gin_trgm_ops)");
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

ensureSetup();

export async function sql(strings, ...values) {
  let text = "";
  strings.forEach((s, i) => {
    text += s;
    if (i < values.length) text += `$${i + 1}`;
  });
  const key = getCacheKey(text, values);
  const cached = getCached(key);
  if (cached) return cached;
  const result = await pool.query(text, values);
  setCached(key, result.rows);
  return result.rows;
}

export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    invalidateCache();
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
