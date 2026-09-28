export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { sql } from "../../../../lib/db";

export async function PUT(request, { params }) {
  const id = parseInt(params.id, 10);
  const body = await request.json().catch(() => ({}));
  const name = (body.name || "").trim();
  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  const quantity = Number.isFinite(body.quantity) ? body.quantity : parseInt(body.quantity, 10) || 0;
  const price = Number.isFinite(body.price) ? body.price : parseFloat(body.price) || 0;
  const costPrice = body.cost_price === "" || body.cost_price == null ? null : parseFloat(body.cost_price);
  const sku = (body.sku || "").trim();

  try {
    let rows;
    if (sku) {
      rows = await sql`
        UPDATE items SET sku=${sku}, name=${name}, category=${body.category || null}, quantity=${quantity},
          price=${price}, cost_price=${costPrice}, notes=${body.notes || null},
          image_url = COALESCE(${body.image_url ?? null}, image_url)
        WHERE id=${id} RETURNING *`;
    } else {
      rows = await sql`
        UPDATE items SET name=${name}, category=${body.category || null}, quantity=${quantity},
          price=${price}, cost_price=${costPrice}, notes=${body.notes || null},
          image_url = COALESCE(${body.image_url ?? null}, image_url)
        WHERE id=${id} RETURNING *`;
    }
    if (body.remove_image) {
      rows = await sql`UPDATE items SET image_url = NULL WHERE id=${id} RETURNING *`;
    }
    if (!rows.length) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }
    return NextResponse.json({ item: rows[0] });
  } catch (err) {
    if (String(err.message || err).includes("duplicate key")) {
      return NextResponse.json(
        { error: `SKU '${sku}' is already used by another item.` },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "Could not update item." }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const id = parseInt(params.id, 10);
  await sql`DELETE FROM items WHERE id=${id}`;
  return NextResponse.json({ ok: true });
}
