export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { sql, withTransaction } from "../../../../lib/db";

export async function GET(request, { params }) {
  const id = parseInt(params.id, 10);
  const invRows = await sql`SELECT * FROM invoices WHERE id = ${id}`;
  if (!invRows.length) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const items = await sql`SELECT * FROM invoice_items WHERE invoice_id = ${id}`;
  return NextResponse.json({ invoice: invRows[0], items });
}

export async function DELETE(request, { params }) {
  const id = parseInt(params.id, 10);
  try {
    await withTransaction(async (client) => {
      const { rows } = await client.query("SELECT * FROM invoice_items WHERE invoice_id = $1", [id]);
      for (const li of rows) {
        if (li.item_id) {
          await client.query("UPDATE items SET quantity = quantity + $1 WHERE id = $2", [li.quantity, li.item_id]);
        }
      }
      await client.query("DELETE FROM invoices WHERE id = $1", [id]); // cascades to invoice_items
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}
