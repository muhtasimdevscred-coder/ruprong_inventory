export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import Papa from "papaparse";
import { sql } from "../../../../lib/db";
import { migrate } from "../../../../lib/migrate";

export async function POST(request) {
  await migrate();

  const body = await request.json().catch(() => ({}));
  const csvText = body.csv;

  if (!csvText || typeof csvText !== "string") {
    return NextResponse.json({ error: "No CSV content received." }, { status: 400 });
  }

  const parsed = Papa.parse(csvText.trim(), { header: true, skipEmptyLines: true });
  if (parsed.errors && parsed.errors.length) {
    const first = parsed.errors[0];
    return NextResponse.json(
      { error: `Could not read the CSV file (row ${first.row + 2}: ${first.message}).` },
      { status: 400 }
    );
  }

  const rows = parsed.data;
  if (!rows.length) {
    return NextResponse.json({ error: "No data rows found in the file." }, { status: 400 });
  }

  const norm = (row, keys) => {
    for (const k of keys) {
      for (const rk of Object.keys(row)) {
        if (rk.trim().toLowerCase() === k) return row[rk];
      }
    }
    return undefined;
  };

  const existingSkus = await sql`SELECT sku FROM items WHERE sku LIKE 'BN%'`;
  let maxSkuNum = 0;
  for (const r of existingSkus) {
    const suffix = r.sku.slice(2);
    if (/^\d+$/.test(suffix)) maxSkuNum = Math.max(maxSkuNum, parseInt(suffix, 10));
  }

  let inserted = 0;
  const errors = [];
  let skuCounter = maxSkuNum;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;
    try {
      const name = (norm(row, ["name"]) || "").trim();
      if (!name) {
        errors.push({ row: rowNum, message: "Missing Name — row skipped." });
        continue;
      }

      let sku = (norm(row, ["sku"]) || "").trim();
      if (!sku) {
        skuCounter++;
        sku = `BN${skuCounter}`;
      }

      const category = (norm(row, ["category"]) || "").trim() || null;
      const quantity = parseInt(norm(row, ["quantity"]), 10) || 0;
      const price = parseFloat(norm(row, ["selling price", "price"])) || 0;
      const costRaw = norm(row, ["cost price"]);
      const costPrice = costRaw === undefined || costRaw === "" ? null : parseFloat(costRaw);
      const notes = (norm(row, ["notes"]) || "").trim() || null;

      await sql`
        INSERT INTO items (sku, name, category, quantity, price, cost_price, notes)
        VALUES (${sku}, ${name}, ${category}, ${quantity}, ${price}, ${costPrice}, ${notes})`;
      inserted++;
    } catch (err) {
      errors.push({ row: rowNum, message: String(err.message || err).slice(0, 150) });
    }
  }

  return NextResponse.json({ inserted, errors, total: rows.length });
}
