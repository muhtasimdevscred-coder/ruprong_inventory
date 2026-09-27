export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { sql } from "../../../../lib/db";

export async function generateInvoiceNo() {
  const rows = await sql`SELECT invoice_no FROM invoices WHERE invoice_no LIKE 'RR-INV-%'`;
  let maxN = 0;
  for (const r of rows) {
    const suffix = r.invoice_no.slice(7);
    if (/^\d+$/.test(suffix)) maxN = Math.max(maxN, parseInt(suffix, 10));
  }
  return `RR-INV-${String(maxN + 1).padStart(4, "0")}`;
}

export async function GET() {
  const next = await generateInvoiceNo();
  return NextResponse.json({ invoice_no: next });
}
