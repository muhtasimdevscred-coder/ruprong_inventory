export const dynamic = "force-dynamic";
import { sql } from "../../../../lib/db";

function csvEscape(v) {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const idsParam = searchParams.get("ids");
  let rows;
  if (idsParam) {
    const ids = idsParam.split(",").map((x) => parseInt(x, 10)).filter(Boolean);
    rows = await sql`SELECT * FROM items WHERE id = ANY(${ids}) ORDER BY name`;
  } else {
    rows = await sql`SELECT * FROM items ORDER BY name`;
  }

  const headers = ["SKU", "Name", "Category", "Quantity", "Selling Price", "Cost Price", "Notes"];
  const lines = [headers.join(",")];
  for (const it of rows) {
    lines.push([
      csvEscape(it.sku), csvEscape(it.name), csvEscape(it.category), csvEscape(it.quantity),
      csvEscape(it.price), csvEscape(it.cost_price), csvEscape(it.notes),
    ].join(","));
  }
  const csv = "\uFEFF" + lines.join("\r\n") + "\r\n";

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="RupRong_Inventory_${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
