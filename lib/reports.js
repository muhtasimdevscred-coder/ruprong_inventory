import { sql } from "./db";

// Profit is computed from each invoice line's cost_price, which was
// snapshotted at the moment the invoice was created — so editing an item's
// cost price later never rewrites historical profit numbers.
export async function getReportSummary(startDate, endDate) {
  const invoices = await sql`
    SELECT * FROM invoices
    WHERE invoice_date >= ${startDate} AND invoice_date <= ${endDate}
    ORDER BY invoice_date ASC, id ASC`;

  const ids = invoices.map((i) => i.id);
  const items = ids.length
    ? await sql`SELECT * FROM invoice_items WHERE invoice_id = ANY(${ids})`
    : [];

  const itemsByInvoice = {};
  for (const li of items) {
    (itemsByInvoice[li.invoice_id] ||= []).push(li);
  }

  let totalRevenue = 0, totalSubtotal = 0, totalDiscount = 0, totalCost = 0, totalDelivery = 0;
  let unknownCostLines = 0;
  const byInvoice = [];
  const productStats = {};

  for (const inv of invoices) {
    const lines = itemsByInvoice[inv.id] || [];
    let invCost = 0;
    for (const li of lines) {
      const qty = Number(li.quantity);
      const lineCost = li.cost_price == null ? 0 : Number(li.cost_price) * qty;
      if (li.cost_price == null) unknownCostLines++;
      invCost += lineCost;

      const key = li.description;
      const ps = (productStats[key] ||= { qty: 0, revenue: 0, cost: 0 });
      ps.qty += qty;
      ps.revenue += Number(li.line_total);
      ps.cost += lineCost;
    }

    const invTotal = Number(inv.total);
    const invSubtotal = inv.subtotal != null ? Number(inv.subtotal) : invTotal;
    const invDiscount = Number(inv.discount_amount || 0);
    const invDelivery = Number(inv.delivery_charge || 0);
    const invProfit = invTotal - invCost;

    totalRevenue += invTotal;
    totalSubtotal += invSubtotal;
    totalDiscount += invDiscount;
    totalDelivery += invDelivery;
    totalCost += invCost;

    byInvoice.push({
      invoice_no: inv.invoice_no,
      date: inv.invoice_date,
      customer: inv.customer_name,
      subtotal: invSubtotal,
      discount: invDiscount,
      delivery: invDelivery,
      total: invTotal,
      cost: invCost,
      profit: invProfit,
    });
  }

  const totalProfit = totalRevenue - totalCost;
  const marginPct = totalRevenue ? (totalProfit / totalRevenue) * 100 : 0;

  const byProduct = Object.entries(productStats)
    .map(([description, s]) => ({
      description, qty: s.qty, revenue: s.revenue, cost: s.cost, profit: s.revenue - s.cost,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  return {
    totals: {
      invoiceCount: invoices.length,
      subtotal: totalSubtotal,
      discount: totalDiscount,
      delivery: totalDelivery,
      revenue: totalRevenue,
      cost: totalCost,
      profit: totalProfit,
      marginPct,
      unknownCostLines,
    },
    byInvoice,
    byProduct,
  };
}
