export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import Papa from "papaparse";
import { sql } from "../../../../lib/db";
import { generateSku } from "../route";

// Accepts { csv: "<raw csv text>" }.
// Expected columns (case-insensitive, extra/missing optional columns are fine):
//   SKU, Name, Category, Quantity, Selling Price, Cost Price, Weight (g), Purity, Stone, Notes
// Row matching: if a row's SKU already exists in inventory, that item is
// UPDATED (its Name/Category/Quantity/... are overwritten with the CSV's
// values). If the SKU is blank or not found, a NEW item is created (auto
// SKU if left blank). Nothing is deleted by an import.
export async function POST(request) {
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

  const norm = (row, keys) => {
    for (const k of keys) {
      for (const rk of Object.keys(row)) {
        if (rk.trim().toLowerCase() === k) return row[rk];
      }
    }
    return undefined;
  };

  let inserted = 0;
  let updated = 0;
  const errors = [];

  for (let i = 0; i < parsed.data.length; i++) {
    const row = parsed.data[i];
    const rowNum = i + 2; // account for header row, 1-indexed
    try {
      const name = (norm(row, ["name"]) || "").trim();
      if (!name) {
        errors.push({ row: rowNum, message: "Missing Name — row skipped." });
        continue;
      }
      let sku = (norm(row, ["sku"]) || "").trim();
      const category = (norm(row, ["category"]) || "").trim() || null;
      const quantity = parseInt(norm(row, ["quantity"]), 10) || 0;
      const price = parseFloat(norm(row, ["selling price", "price"])) || 0;
      const costRaw = norm(row, ["cost price"]);
      const costPrice = costRaw === undefined || costRaw === "" ? null : parseFloat(costRaw);
      const weightRaw = norm(row, ["weight (g)", "weight"]);
      const weight = weightRaw === undefined || weightRaw === "" ? null : parseFloat(weightRaw);
      const purity = (norm(row, ["purity"]) || "").trim() || null;
      const stone = (norm(row, ["stone"]) || "").trim() || null;
      const notes = (norm(row, ["notes"]) || "").trim() || null;

      let existing = null;
      if (sku) {
        const found = await sql`SELECT id FROM items WHERE sku = ${sku}`;
        existing = found[0] || null;
      }

      if (existing) {
        await sql`
          UPDATE items SET name=${name}, category=${category}, quantity=${quantity}, price=${price},
            cost_price=${costPrice}, weight=${weight}, purity=${purity}, stone=${stone}, notes=${notes}
          WHERE id=${existing.id}`;
        updated++;
      } else {
        if (!sku) sku = await generateSku();
        await sql`
          INSERT INTO items (sku, name, category, quantity, price, cost_price, weight, purity, stone, notes)
          VALUES (${sku}, ${name}, ${category}, ${quantity}, ${price}, ${costPrice}, ${weight}, ${purity}, ${stone}, ${notes})`;
        inserted++;
      }
    } catch (err) {
      errors.push({ row: rowNum, message: String(err.message || err).slice(0, 150) });
    }
  }

  return NextResponse.json({ inserted, updated, errors });
}
