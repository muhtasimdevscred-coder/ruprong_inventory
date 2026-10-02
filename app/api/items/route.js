export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { sql } from "../../../lib/db";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("search") || "").trim();
    let rows;
    if (q) {
      const like = `%${q}%`;
      rows = await sql`
        SELECT * FROM items
        WHERE name ILIKE ${like} OR sku ILIKE ${like} OR category ILIKE ${like}
        ORDER BY id`;
    } else {
      rows = await sql`SELECT * FROM items ORDER BY id`;
    }
    return NextResponse.json({ items: rows });
  } catch (err) {
    console.error("GET /api/items error:", err.message);
    return NextResponse.json({ error: "Database error", details: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const name = (body.name || "").trim();
  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const quantity = Number.isFinite(body.quantity) ? body.quantity : parseInt(body.quantity, 10) || 0;
  const price = Number.isFinite(body.price) ? body.price : parseFloat(body.price) || 0;
  const costPrice = body.cost_price === "" || body.cost_price == null ? null : parseFloat(body.cost_price);
  const sku = (body.sku || "").trim() || null;

  try {
    const rows = await sql`
      INSERT INTO items (sku, name, category, quantity, price, cost_price, notes, image_url)
      VALUES (${sku}, ${name}, ${body.category || null}, ${quantity}, ${price}, ${costPrice},
              ${body.notes || null}, ${body.image_url || null})
      RETURNING *`;
    return NextResponse.json({ item: rows[0] });
  } catch (err) {
    console.error("POST /api/items error:", err.message);
    return NextResponse.json({ error: "Could not create item." }, { status: 500 });
  }
}
