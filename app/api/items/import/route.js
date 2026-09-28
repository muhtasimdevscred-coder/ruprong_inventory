export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import Papa from "papaparse";
import { sql } from "../../../../lib/db";
import { generateSku } from "../route";
import { migrate } from "../../../../lib/migrate";

// Accepts { csv: "<raw csv text>" } or { excel: "<base64 xlsx data>" }.
// Expected columns (case-insensitive, extra/missing optional columns are fine):
//   Name, Category, Quantity, Selling Price, Cost Price, Notes
// SKU column is ignored — all products get serial SKU numbers (RR-0001, RR-0002, etc.)
export async function POST(request) {
  await migrate();

  const body = await request.json().catch(() => ({}));
  const csvText = body.csv;
  const excelBase64 = body.excel;

  if (!csvText && !excelBase64) {
    return NextResponse.json({ error: "No file content received." }, { status: 400 });
  }

  let rows = [];

  if (excelBase64) {
    try {
      const XLSX = await import("xlsx");
      const buffer = Buffer.from(excelBase64, "base64");
      const workbook = XLSX.read(buffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
    } catch (err) {
      return NextResponse.json(
        { error: `Could not read the Excel file: ${String(err.message || err)}` },
        { status: 400 }
      );
    }
  } else {
    const parsed = Papa.parse(csvText.trim(), { header: true, skipEmptyLines: true });
    if (parsed.errors && parsed.errors.length) {
      const first = parsed.errors[0];
      return NextResponse.json(
        { error: `Could not read the CSV file (row ${first.row + 2}: ${first.message}).` },
        { status: 400 }
      );
    }
    rows = parsed.data;
  }

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

  const existingSkus = await sql`SELECT sku FROM items WHERE sku LIKE 'RR-%'`;
  let maxSkuNum = 0;
  for (const r of existingSkus) {
    const suffix = r.sku.slice(3);
    if (/^\d+$/.test(suffix)) maxSkuNum = Math.max(maxSkuNum, parseInt(suffix, 10));
  }

  let inserted = 0;
  let updated = 0;
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

      skuCounter++;
      const sku = `RR-${String(skuCounter).padStart(4, "0")}`;

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

  return NextResponse.json({ inserted, updated, errors, nextSku: skuCounter });
}
