export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { sql } from "../../../lib/db";

export async function generateSku() {
  const rows = await sql`SELECT sku FROM items WHERE sku LIKE 'RR-%'`;
  let maxN = 0;
  for (const r of rows) {
    const suffix = r.sku.slice(3);
    if (/^\d+$/.test(suffix)) maxN = Math.max(maxN, parseInt(suffix, 10));
  }
  return `RR-${String(maxN + 1).padStart(4, "0")}`;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("search") || "").trim();
  let rows;
  if (q) {
    const like = `%${q}%`;
    rows = await sql`
      SELECT * FROM items
      WHERE name ILIKE ${like} OR sku ILIKE ${like} OR category ILIKE ${like}
      ORDER BY name`;
  } else {
    rows = await sql`SELECT * FROM items ORDER BY name`;
  }
  return NextResponse.json({ items: rows });
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const name = (body.name || "").trim();
  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  let sku = (body.sku || "").trim();
  if (!sku) sku = await generateSku();

  const quantity = Number.isFinite(body.quantity) ? body.quantity : parseInt(body.quantity, 10) || 0;
  const price = Number.isFinite(body.price) ? body.price : parseFloat(body.price) || 0;
  const costPrice = body.cost_price === "" || body.cost_price == null ? null : parseFloat(body.cost_price);

  try {
    const rows = await sql`
      INSERT INTO items (sku, name, category, quantity, price, cost_price, notes, image_url)
      VALUES (${sku}, ${name}, ${body.category || null}, ${quantity}, ${price}, ${costPrice},
              ${body.notes || null}, ${body.image_url || null})
      RETURNING *`;
    return NextResponse.json({ item: rows[0] });
  } catch (err) {
    if (String(err.message || err).includes("duplicate key")) {
      return NextResponse.json(
        { error: `SKU '${sku}' is already used by another item.` },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "Could not create item." }, { status: 500 });
  }
}
