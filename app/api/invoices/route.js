export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { sql, withTransaction } from "../../../lib/db";
import { generateInvoiceNo } from "./next-number/route";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("search") || "").trim();
  let rows;
  if (q) {
    const like = `%${q}%`;
    rows = await sql`
      SELECT * FROM invoices
      WHERE invoice_no ILIKE ${like} OR customer_name ILIKE ${like}
            OR customer_phone ILIKE ${like} OR parcel_id ILIKE ${like}
      ORDER BY id DESC`;
  } else {
    rows = await sql`SELECT * FROM invoices ORDER BY id DESC`;
  }
  return NextResponse.json({ invoices: rows });
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const customerName = (body.customer_name || "").trim();
  if (!customerName) {
    return NextResponse.json({ error: "Customer name is required." }, { status: 400 });
  }
  const lineItems = Array.isArray(body.line_items) ? body.line_items : [];
  if (!lineItems.length) {
    return NextResponse.json({ error: "Add at least one item to the invoice." }, { status: 400 });
  }

  const discountType = ["flat", "percent"].includes(body.discount_type) ? body.discount_type : "none";
  const discountValue = parseFloat(body.discount_value) || 0;
  const deliveryCharge = parseFloat(body.delivery_charge) || 0;

  try {
    const result = await withTransaction(async (client) => {
      // Lock and validate stock for any inventory-linked lines.
      const neededByItem = {};
      for (const li of lineItems) {
        if (li.item_id) {
          neededByItem[li.item_id] = (neededByItem[li.item_id] || 0) + Number(li.quantity);
        }
      }
      const lineCostById = {};
      for (const itemId of Object.keys(neededByItem)) {
        const { rows } = await client.query(
          "SELECT id, name, quantity, cost_price FROM items WHERE id = $1 FOR UPDATE",
          [itemId]
        );
        const item = rows[0];
        if (!item) throw new Error(`Inventory item ${itemId} no longer exists.`);
        if (item.quantity < neededByItem[itemId]) {
          throw new Error(`Not enough stock for ${item.name} — only ${item.quantity} left.`);
        }
        lineCostById[itemId] = item.cost_price;
      }

      const subtotal = lineItems.reduce((sum, li) => sum + Number(li.quantity) * Number(li.unit_price), 0);
      let discountAmount = 0;
      if (discountType === "flat") discountAmount = discountValue;
      else if (discountType === "percent") discountAmount = subtotal * (discountValue / 100);
      discountAmount = Math.max(0, Math.min(discountAmount, subtotal));
      const total = subtotal - discountAmount + deliveryCharge;

      const invoiceNo = (body.invoice_no || "").trim() || (await generateInvoiceNo());
      const invoiceDate = body.invoice_date || new Date().toISOString().slice(0, 10);

      const { rows: invRows } = await client.query(
        `INSERT INTO invoices (invoice_no, invoice_date, customer_name, customer_phone, customer_address,
                                parcel_id, subtotal, discount_type, discount_value, discount_amount,
                                delivery_charge, total)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
        [invoiceNo, invoiceDate, customerName, body.customer_phone || null, body.customer_address || null,
          body.parcel_id || null, subtotal, discountType, discountValue, discountAmount, deliveryCharge, total]
      );
      const invoice = invRows[0];

      for (const li of lineItems) {
        const qty = Number(li.quantity);
        const unitPrice = Number(li.unit_price);
        const lineTotal = qty * unitPrice;
        const costPrice = li.item_id ? lineCostById[li.item_id] : null;
        await client.query(
          `INSERT INTO invoice_items (invoice_id, item_id, description, quantity, unit_price, line_total, cost_price)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [invoice.id, li.item_id || null, li.description, qty, unitPrice, lineTotal, costPrice]
        );
        if (li.item_id) {
          await client.query("UPDATE items SET quantity = quantity - $1 WHERE id = $2", [qty, li.item_id]);
        }
      }

      return invoice;
    });

    return NextResponse.json({ invoice: result });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 400 });
  }
}
