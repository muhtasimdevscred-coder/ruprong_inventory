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

export async function PUT(request, { params }) {
  const id = parseInt(params.id, 10);
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
    const updated = await withTransaction(async (client) {
      // Get current invoice items to restore stock
      const { rows: oldItems } = await client.query("SELECT * FROM invoice_items WHERE invoice_id = $1", [id]);
      if (!oldItems.length) throw new Error("Invoice not found.");

      // Restore stock from old line items
      for (const li of oldItems) {
        if (li.item_id) {
          await client.query("UPDATE items SET quantity = quantity + $1 WHERE id = $2", [li.quantity, li.item_id]);
        }
      }

      // Check stock for new line items
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

      // Calculate totals
      const subtotal = lineItems.reduce((sum, li) => sum + Number(li.quantity) * Number(li.unit_price), 0);
      let discountAmount = 0;
      if (discountType === "flat") discountAmount = discountValue;
      else if (discountType === "percent") discountAmount = subtotal * (discountValue / 100);
      discountAmount = Math.max(0, Math.min(discountAmount, subtotal));
      const total = subtotal - discountAmount + deliveryCharge;

      // Update invoice
      const invoiceDate = body.invoice_date || new Date().toISOString().slice(0, 10);
      const { rows: invRows } = await client.query(
        `UPDATE invoices SET invoice_date = $1, customer_name = $2, customer_phone = $3,
         customer_address = $4, parcel_id = $5, subtotal = $6, discount_type = $7,
         discount_value = $8, discount_amount = $9, delivery_charge = $10, total = $11
         WHERE id = $12 RETURNING *`,
        [invoiceDate, customerName, body.customer_phone || null, body.customer_address || null,
         body.parcel_id || null, subtotal, discountType, discountValue, discountAmount,
         deliveryCharge, total, id]
      );
      const invoice = invRows[0];

      // Delete old line items
      await client.query("DELETE FROM invoice_items WHERE invoice_id = $1", [id]);

      // Insert new line items and deduct stock
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

    return NextResponse.json({ invoice: updated });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 400 });
  }
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
