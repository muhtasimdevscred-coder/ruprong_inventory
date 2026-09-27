import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { sql } from "../../../../../lib/db";
import InvoiceDocument from "../../../../../lib/pdf/InvoiceDocument";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  const id = parseInt(params.id, 10);
  const invRows = await sql`SELECT * FROM invoices WHERE id = ${id}`;
  if (!invRows.length) {
    return new Response("Invoice not found", { status: 404 });
  }
  const invoice = invRows[0];
  const items = await sql`SELECT * FROM invoice_items WHERE invoice_id = ${id} ORDER BY id`;

  const buffer = await renderToBuffer(<InvoiceDocument invoice={invoice} items={items} />);
  const safeCustomer = invoice.customer_name.replace(/[^a-zA-Z0-9 _-]/g, "").trim().replace(/\s+/g, "_") || "customer";

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${invoice.invoice_no}_${safeCustomer}.pdf"`,
    },
  });
}
