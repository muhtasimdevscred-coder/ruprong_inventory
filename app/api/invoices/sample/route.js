export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { sql, withTransaction } from "../../../../lib/db";
import { migrate } from "../../../../lib/migrate";

export async function POST(request) {
  await migrate();

  // Get all items with quantity 0
  const { rows: items } = await sql`SELECT * FROM items WHERE quantity = 0 ORDER BY id`;

  if (items.length === 0) {
    return NextResponse.json({ message: "No items with quantity 0 found.", created: 0 });
  }

  let created = 0;
  const errors = [];

  for (const item of items) {
    try {
      await withTransaction(async (client) => {
        // Generate invoice number
        const { rows: lastInv } = await client.query(
          "SELECT invoice_no FROM invoices WHERE invoice_no LIKE 'RR-INV-%' ORDER BY invoice_no DESC LIMIT 1"
        );
        let nextNum = 1;
        if (lastInv.length > 0) {
          const match = lastInv[0].invoice_no.match(/RR-INV-(\d+)/);
          if (match) nextNum = parseInt(match[1], 10) + 1;
        }
        const invoiceNo = `RR-INV-${String(nextNum).padStart(4, "0")}`;

        // Create invoice
        const invoiceDate = new Date().toISOString().slice(0, 10);
        const quantity = 1;
        const unitPrice = Number(item.price);
        const lineTotal = quantity * unitPrice;
        const subtotal = lineTotal;
        const total = subtotal;

        const { rows: invRows } = await client.query(
          `INSERT INTO invoices (invoice_no, invoice_date, customer_name, customer_phone, customer_address,
                                 parcel_id, subtotal, discount_type, discount_value, discount_amount,
                                 delivery_charge, total)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
          [invoiceNo, invoiceDate, "Sample Customer", "0000000000", "Sample Address",
           "SAMPLE", subtotal, "none", 0, 0, 0, total]
        );
        const invoice = invRows[0];

        // Create invoice item
        await client.query(
          `INSERT INTO invoice_items (invoice_id, item_id, description, quantity, unit_price, line_total, cost_price)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [invoice.id, item.id, item.name, quantity, unitPrice, lineTotal, item.cost_price]
        );

        // Update item quantity (add 1 since it was 0)
        await client.query("UPDATE items SET quantity = quantity + $1 WHERE id = $2", [quantity, item.id]);
      });
      created++;
    } catch (err) {
      errors.push({ item: item.sku, message: String(err.message || err).slice(0, 150) });
    }
  }

  return NextResponse.json({ created, errors, total: items.length });
}
