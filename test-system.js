const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Read DATABASE_URL from .env.local
const envPath = path.join(__dirname, '.env.local');
let dbUrl = '';
try {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const match = envContent.match(/DATABASE_URL=(.+)/);
  if (match) dbUrl = match[1].trim().replace(/^["']|["']$/g, '');
} catch (e) {
  dbUrl = process.env.DATABASE_URL || '';
}

if (!dbUrl) {
  console.log('ERROR: DATABASE_URL not found');
  process.exit(1);
}

const client = new Client({
  connectionString: dbUrl,
  ssl: dbUrl.includes('sslmode=require') ? { rejectUnauthorized: false } : false,
});

async function test(name, fn) {
  const start = Date.now();
  try {
    await fn();
    const ms = Date.now() - start;
    console.log(`✓ ${name} (${ms}ms)`);
    return { name, success: true, ms };
  } catch (err) {
    const ms = Date.now() - start;
    console.log(`✗ ${name} (${ms}ms) - ${err.message}`);
    return { name, success: false, ms, error: err.message };
  }
}

async function main() {
  await client.connect();
  console.log('=== System Performance Tests ===\n');

  const results = [];

  // Test 1: Database connection
  results.push(await test('Database connection', async () => {
    await client.query('SELECT 1');
  }));

  // Test 2: Items table exists and has data
  results.push(await test('Items table query', async () => {
    const { rows } = await client.query('SELECT COUNT(*) FROM items');
    if (rows[0].count === '0') throw new Error('No items in database');
  }));

  // Test 3: Items with sku_sort (indexed query)
  results.push(await test('Items ordered by sku_sort (indexed)', async () => {
    const { rows } = await client.query('SELECT id, sku, sku_sort FROM items ORDER BY sku_sort LIMIT 5');
    if (rows.length === 0) throw new Error('No items returned');
  }));

  // Test 4: Search items by name
  results.push(await test('Search items by name', async () => {
    const { rows } = await client.query("SELECT * FROM items WHERE name ILIKE '%ring%' LIMIT 5");
  }));

  // Test 5: Search items by SKU
  results.push(await test('Search items by SKU', async () => {
    const { rows } = await client.query("SELECT * FROM items WHERE sku ILIKE '%BN%' LIMIT 5");
  }));

  // Test 6: Invoices table
  results.push(await test('Invoices query', async () => {
    const { rows } = await client.query('SELECT COUNT(*) FROM invoices');
  }));

  // Test 7: Invoice items with join
  results.push(await test('Invoice items with join', async () => {
    const { rows } = await client.query(`
      SELECT ii.*, i.invoice_no 
      FROM invoice_items ii 
      JOIN invoices i ON i.id = ii.invoice_id 
      LIMIT 5
    `);
  }));

  // Test 8: Reports summary query
  results.push(await test('Reports summary query', async () => {
    const { rows } = await client.query(`
      SELECT * FROM invoices 
      WHERE invoice_date >= '2026-01-01' AND invoice_date <= '2026-12-31'
      ORDER BY invoice_date ASC, id ASC
      LIMIT 10
    `);
  }));

  // Test 9: Unsold inventory query
  results.push(await test('Unsold inventory query', async () => {
    const { rows } = await client.query('SELECT id, sku, name, category, quantity, price, cost_price FROM items WHERE quantity > 0 ORDER BY name LIMIT 10');
  }));

  // Test 10: Next invoice number
  results.push(await test('Next invoice number', async () => {
    const { rows } = await client.query("SELECT invoice_no FROM invoices WHERE invoice_no LIKE 'RR-INV-%' ORDER BY invoice_no DESC LIMIT 1");
  }));

  // Test 11: Create item (POST simulation)
  results.push(await test('Create item', async () => {
    const { rows } = await client.query(`
      INSERT INTO items (sku, sku_sort, name, category, quantity, price, cost_price, notes, image_url)
      VALUES ('TEST01', 'TEST0000000001', 'Test Item', 'Test', 1, 100, 80, 'test', null)
      RETURNING *
    `);
    // Clean up
    await client.query("DELETE FROM items WHERE sku = 'TEST01'");
  }));

  // Test 12: Update item (PUT simulation)
  results.push(await test('Update item', async () => {
    const { rows } = await client.query(`
      UPDATE items SET name = 'Updated Test' WHERE sku = 'TEST01' RETURNING *
    `);
  }));

  // Test 13: Delete item (DELETE simulation)
  results.push(await test('Delete item', async () => {
    await client.query("DELETE FROM items WHERE sku = 'TEST01'");
  }));

  // Test 14: Index verification
  results.push(await test('Index verification', async () => {
    const { rows } = await client.query(`
      SELECT indexname FROM pg_indexes WHERE tablename = 'items'
    `);
    const indexes = rows.map(r => r.indexname);
    if (!indexes.includes('idx_items_sku_sort')) throw new Error('Missing idx_items_sku_sort');
    if (!indexes.includes('idx_items_name')) throw new Error('Missing idx_items_name');
  }));

  // Test 15: Connection pool simulation (multiple concurrent queries)
  results.push(await test('Concurrent queries (10 parallel)', async () => {
    const promises = [];
    for (let i = 0; i < 10; i++) {
      promises.push(client.query('SELECT COUNT(*) FROM items'));
    }
    await Promise.all(promises);
  }));

  // Summary
  console.log('\n=== Test Summary ===');
  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const totalTime = results.reduce((s, r) => s + r.ms, 0);
  const avgTime = Math.round(totalTime / results.length);

  console.log(`Passed: ${passed}/${results.length}`);
  console.log(`Failed: ${failed}/${results.length}`);
  console.log(`Total time: ${totalTime}ms`);
  console.log(`Average time: ${avgTime}ms`);

  if (failed > 0) {
    console.log('\nFailed tests:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`  - ${r.name}: ${r.error}`);
    });
  }

  await client.end();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Test error:', err.message);
  client.end();
  process.exit(1);
});
