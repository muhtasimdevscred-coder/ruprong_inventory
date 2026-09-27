export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { withTransaction } from "../../../../lib/db";

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  if (body.confirm !== "DELETE") {
    return NextResponse.json({ error: 'You must confirm with "DELETE".' }, { status: 400 });
  }
  await withTransaction(async (client) => {
    await client.query("DELETE FROM invoice_items");
    await client.query("DELETE FROM invoices");
    await client.query("DELETE FROM items");
    await client.query("ALTER SEQUENCE items_id_seq RESTART WITH 1");
    await client.query("ALTER SEQUENCE invoices_id_seq RESTART WITH 1");
    await client.query("ALTER SEQUENCE invoice_items_id_seq RESTART WITH 1");
  });
  return NextResponse.json({ ok: true });
}
