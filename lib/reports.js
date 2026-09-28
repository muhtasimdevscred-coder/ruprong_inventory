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

  // Unsold inventory: items with quantity > 0 that were NOT sold in this period
  const soldQtyByItemId = {};
  for (const li of items) {
    if (li.item_id) {
      soldQtyByItemId[li.item_id] = (soldQtyByItemId[li.item_id] || 0) + Number(li.quantity);
    }
  }

  const allItems = await sql`SELECT id, sku, name, category, quantity, price, cost_price FROM items WHERE quantity > 0 ORDER BY name`;

  const unsoldItems = [];
  let unsoldCostValue = 0;
  let unsoldRetailValue = 0;
  let unsoldProfitPotential = 0;

  for (const item of allItems) {
    const soldQty = soldQtyByItemId[item.id] || 0;
    const remainingQty = Number(item.quantity);
    if (remainingQty <= 0) continue;

    const costPrice = item.cost_price != null ? Number(item.cost_price) : 0;
    const retailPrice = Number(item.price);
    const costVal = remainingQty * costPrice;
    const retailVal = remainingQty * retailPrice;
    const profitPot = retailVal - costVal;

    unsoldCostValue += costVal;
    unsoldRetailValue += retailVal;
    unsoldProfitPotential += profitPot;

    unsoldItems.push({
      sku: item.sku,
      name: item.name,
      category: item.category,
      qty: remainingQty,
      sold_in_period: soldQty,
      unit_price: retailPrice,
      unit_cost: costPrice,
      retail_value: retailVal,
      cost_value: costVal,
      profit_potential: profitPot,
    });
  }

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
    unsold: {
      items: unsoldItems,
      totalItems: unsoldItems.length,
      totalQty: unsoldItems.reduce((s, i) => s + i.qty, 0),
      costValue: unsoldCostValue,
      retailValue: unsoldRetailValue,
      profitPotential: unsoldProfitPotential,
    },
  };
}
