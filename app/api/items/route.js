export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { sql, withTransaction } from "../../../lib/db";

// Run once to add sku_sort column and index
let initialized = false;
async function ensureSetup() {
  if (initialized) return;
  try {
    await sql`ALTER TABLE items ADD COLUMN IF NOT EXISTS sku_sort TEXT`;
    await sql`CREATE INDEX IF NOT EXISTS idx_items_sku_sort ON items(sku_sort)`;
    // Populate sku_sort for existing items
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
    initialized = true;
  } catch (err) {
    console.error("Setup error:", err.message);
  }
}

export async function renumberSkus() {
  await withTransaction(async (client) => {
    const { rows: items } = await client.query("SELECT id, sku FROM items ORDER BY id");
    const groups = {};
    for (const item of items) {
      if (!item.sku) continue;
      const match = item.sku.match(/^([A-Za-z]+)(\d+)$/);
      if (!match) continue;
      const prefix = match[1];
      const num = parseInt(match[2], 10);
      if (!groups[prefix]) groups[prefix] = [];
      groups[prefix].push({ id: item.id, num });
    }
    for (const prefix of Object.keys(groups)) {
      const itemsInGroup = groups[prefix];
      itemsInGroup.sort((a, b) => a.num - b.num);
      for (let i = 0; i < itemsInGroup.length; i++) {
        const newSku = `${prefix}${i + 1}`;
        const skuSort = `${prefix}${String(i + 1).padStart(10, "0")}`;
        await client.query("UPDATE items SET sku = $1, sku_sort = $2 WHERE id = $3", [newSku, skuSort, itemsInGroup[i].id]);
      }
    }
  });
}

export async function GET(request) {
  try {
    await ensureSetup();
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("search") || "").trim();
    let rows;
    if (q) {
      const like = `%${q}%`;
      rows = await sql`
        SELECT * FROM items
        WHERE name ILIKE ${like} OR sku ILIKE ${like} OR category ILIKE ${like}
        ORDER BY sku_sort`;
    } else {
      rows = await sql`SELECT * FROM items ORDER BY sku_sort`;
    }
    return NextResponse.json({ items: rows });
  } catch (err) {
    console.error("GET /api/items error:", err.message);
    return NextResponse.json({ error: "Database error", details: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  await ensureSetup();
  const body = await request.json().catch(() => ({}));
  const name = (body.name || "").trim();
  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const quantity = Number.isFinite(body.quantity) ? body.quantity : parseInt(body.quantity, 10) || 0;
  const price = Number.isFinite(body.price) ? body.price : parseFloat(body.price) || 0;
  const costPrice = body.cost_price === "" || body.cost_price == null ? null : parseFloat(body.cost_price);
  const sku = (body.sku || "").trim() || null;

  // Generate sku_sort for the new item
  const match = sku ? sku.match(/^([A-Za-z]+)(\d+)$/) : null;
  const skuSort = match ? `${match[1]}${match[2].padStart(10, "0")}` : sku;

  try {
    const rows = await sql`
      INSERT INTO items (sku, sku_sort, name, category, quantity, price, cost_price, notes, image_url)
      VALUES (${sku}, ${skuSort}, ${name}, ${body.category || null}, ${quantity}, ${price}, ${costPrice},
              ${body.notes || null}, ${body.image_url || null})
      RETURNING *`;

    // Renumber SKUs serially within each prefix group
    await renumberSkus();

    return NextResponse.json({ item: rows[0] });
  } catch (err) {
    console.error("POST /api/items error:", err.message);
    return NextResponse.json({ error: "Could not create item." }, { status: 500 });
  }
}
