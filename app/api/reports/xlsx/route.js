import ExcelJS from "exceljs";
import { getReportSummary } from "../../../../lib/reports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");
  if (!start || !end) {
    return new Response("start and end are required", { status: 400 });
  }
  const summary = await getReportSummary(start, end);
  const { totals, byInvoice, byProduct } = summary;

  const wb = new ExcelJS.Workbook();

  const wsSummary = wb.addWorksheet("Summary");
  wsSummary.getCell("A1").value = "RupRong Inventory — Sales & Profit Report";
  wsSummary.getCell("A1").font = { bold: true, size: 14, color: { argb: "FF8A6A45" } };
  wsSummary.getCell("A2").value = `Period: ${start} to ${end}`;
  const rows = [
    ["Invoices", totals.invoiceCount],
    ["Gross Sales (before discount)", totals.subtotal],
    ["Total Discount Given", totals.discount],
    ["Total Delivery Charges", totals.delivery],
    ["Net Revenue", totals.revenue],
    ["Cost of Goods Sold", totals.cost],
    ["Net Profit", totals.profit],
    ["Profit Margin (%)", Math.round(totals.marginPct * 10) / 10],
  ];
  rows.forEach(([label, value], i) => {
    const r = i + 4;
    wsSummary.getCell(`A${r}`).value = label;
    wsSummary.getCell(`A${r}`).font = { bold: true, color: { argb: "FF8A6A45" } };
    wsSummary.getCell(`B${r}`).value = value;
  });
  if (totals.unknownCostLines) {
    wsSummary.getCell(`A${rows.length + 5}`).value =
      `Note: ${totals.unknownCostLines} line item(s) had no cost price on record and are counted as zero cost above.`;
  }
  wsSummary.getColumn(1).width = 34;
  wsSummary.getColumn(2).width = 18;

  const wsInv = wb.addWorksheet("By Invoice");
  wsInv.addRow(["Invoice No", "Date", "Customer", "Subtotal", "Discount", "Delivery", "Total", "Cost", "Profit"]);
  wsInv.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  wsInv.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF8A6A45" } };
  byInvoice.forEach((r) => {
    wsInv.addRow([r.invoice_no, r.date, r.customer, r.subtotal, r.discount, r.delivery, r.total, r.cost, r.profit]);
  });
  wsInv.columns.forEach((c, i) => { c.width = [16, 12, 22, 12, 12, 12, 12, 12, 12][i] || 12; });

  const wsProd = wb.addWorksheet("By Product");
  wsProd.addRow(["Product", "Qty Sold", "Revenue", "Cost", "Profit"]);
  wsProd.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  wsProd.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF8A6A45" } };
  byProduct.forEach((r) => {
    wsProd.addRow([r.description, r.qty, r.revenue, r.cost, r.profit]);
  });
  wsProd.columns.forEach((c, i) => { c.width = [34, 12, 14, 14, 14][i] || 14; });

  const buffer = await wb.xlsx.writeBuffer();

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="RupRong_Sales_Report_${start}_to_${end}.xlsx"`,
    },
  });
}
