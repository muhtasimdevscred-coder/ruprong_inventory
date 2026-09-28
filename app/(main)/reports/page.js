"use client";
import { useState } from "react";

function firstOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function toISO(d) { return d.toISOString().slice(0, 10); }

export default function ReportsPage() {
  const today = new Date();
  const [start, setStart] = useState(toISO(firstOfMonth(today)));
  const [end, setEnd] = useState(toISO(today));
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function generate() {
    setError(""); setLoading(true);
    try {
      const res = await fetch(`/api/reports/summary?start=${start}&end=${end}`);
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Could not generate report."); return; }
      setSummary(data.summary);
    } finally {
      setLoading(false);
    }
  }

  function quickRange(kind) {
    const now = new Date();
    if (kind === "week") {
      const day = now.getDay();
      const monday = new Date(now);
      monday.setDate(now.getDate() - ((day + 6) % 7));
      setStart(toISO(monday)); setEnd(toISO(now));
    } else if (kind === "month") {
      setStart(toISO(firstOfMonth(now))); setEnd(toISO(now));
    } else if (kind === "lastMonth") {
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
      const lastMonthStart = new Date(lastMonthEnd.getFullYear(), lastMonthEnd.getMonth(), 1);
      setStart(toISO(lastMonthStart)); setEnd(toISO(lastMonthEnd));
    }
  }

  const t = summary?.totals;
  const u = summary?.unsold;

  return (
    <div>
      <h2 style={{ color: "var(--gold)" }}>Sales & Profit Report</h2>
      {error && <div className="msg msg-error">{error}</div>}

      <div className="card">
        <h2>Date Range</h2>
        <div className="row">
          <div className="field"><label>From</label><input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></div>
          <div className="field"><label>To</label><input type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
          <button className="btn btn-primary" onClick={generate} disabled={loading}>{loading ? "Loading..." : "Generate Report"}</button>
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          <span className="muted">Quick pick:</span>
          <button className="btn btn-sm" onClick={() => quickRange("week")}>This Week</button>
          <button className="btn btn-sm" onClick={() => quickRange("month")}>This Month</button>
          <button className="btn btn-sm" onClick={() => quickRange("lastMonth")}>Last Month</button>
        </div>
      </div>

      <div className="card">
        <h2>Summary</h2>
        {!summary ? (
          <p className="muted">Choose a date range and click Generate Report.</p>
        ) : (
          <div>
            <p>Invoices: {t.invoiceCount}</p>
            <p>Gross Sales (before discount): {t.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            <p>Total Discount Given: {t.discount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            <p>Total Delivery Charges: {t.delivery.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            <p>Net Revenue: {t.revenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            <p>Cost of Goods Sold: {t.cost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            <p><b>Net Profit: {t.profit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</b></p>
            <p>Profit Margin: {t.marginPct.toFixed(1)}%</p>
            {t.unknownCostLines > 0 && (
              <p className="muted">Note: {t.unknownCostLines} line item(s) had no cost price on record and are counted as zero cost above.</p>
            )}
          </div>
        )}
      </div>

      {summary && (
        <>
          <div className="row" style={{ marginBottom: 16 }}>
            <a className="btn" href={`/api/reports/pdf?start=${start}&end=${end}`} target="_blank" rel="noreferrer">Download PDF</a>
            <a className="btn" href={`/api/reports/xlsx?start=${start}&end=${end}`}>Download Excel (.xlsx)</a>
          </div>

          <div className="card">
            <h2>By Invoice</h2>
            <table>
              <thead><tr><th>Invoice No</th><th>Date</th><th>Customer</th><th>Subtotal</th><th>Discount</th><th>Delivery</th><th>Total</th><th>Cost</th><th>Profit</th></tr></thead>
              <tbody>
                {summary.byInvoice.map((r) => (
                  <tr key={r.invoice_no}>
                    <td>{r.invoice_no}</td><td>{r.date}</td><td>{r.customer}</td>
                    <td>{r.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td>{r.discount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td>{r.delivery.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td>{r.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td>{r.cost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td>{r.profit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  </tr>
                ))}
                {summary.byInvoice.length === 0 && <tr><td colSpan={9} className="muted" style={{ textAlign: "center", padding: 16 }}>No invoices in this period.</td></tr>}
              </tbody>
            </table>
          </div>

          <div className="card">
            <h2>By Product</h2>
            <table>
              <thead><tr><th>Product</th><th>Qty Sold</th><th>Revenue</th><th>Cost</th><th>Profit</th></tr></thead>
              <tbody>
                {summary.byProduct.map((r) => (
                  <tr key={r.description}>
                    <td>{r.description}</td><td>{r.qty}</td>
                    <td>{r.revenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td>{r.cost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td>{r.profit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  </tr>
                ))}
                {summary.byProduct.length === 0 && <tr><td colSpan={5} className="muted" style={{ textAlign: "center", padding: 16 }}>No sales in this period.</td></tr>}
              </tbody>
            </table>
          </div>

          <div className="card">
            <h2>Unsold Inventory</h2>
            <p className="muted">Items currently in stock that have not been sold. This shows how much inventory value is still available.</p>
            <div className="row" style={{ marginBottom: 16 }}>
              <div className="card" style={{ flex: 1, marginBottom: 0, background: "var(--gold-light)" }}>
                <p className="muted">Total Unsold Items</p>
                <p style={{ fontSize: 24, fontWeight: 700, color: "var(--gold)", margin: "4px 0" }}>{u.totalItems}</p>
              </div>
              <div className="card" style={{ flex: 1, marginBottom: 0, background: "var(--gold-light)" }}>
                <p className="muted">Total Unsold Quantity</p>
                <p style={{ fontSize: 24, fontWeight: 700, color: "var(--gold)", margin: "4px 0" }}>{u.totalQty}</p>
              </div>
              <div className="card" style={{ flex: 1, marginBottom: 0, background: "var(--gold-light)" }}>
                <p className="muted">Cost Value (Unsold)</p>
                <p style={{ fontSize: 24, fontWeight: 700, color: "var(--gold)", margin: "4px 0" }}>{u.costValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
              </div>
              <div className="card" style={{ flex: 1, marginBottom: 0, background: "var(--gold-light)" }}>
                <p className="muted">Retail Value (Unsold)</p>
                <p style={{ fontSize: 24, fontWeight: 700, color: "var(--gold)", margin: "4px 0" }}>{u.retailValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
              </div>
              <div className="card" style={{ flex: 1, marginBottom: 0, background: "var(--gold-light)" }}>
                <p className="muted">Potential Profit</p>
                <p style={{ fontSize: 24, fontWeight: 700, color: "var(--gold)", margin: "4px 0" }}>{u.profitPotential.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
              </div>
            </div>
            <table>
              <thead>
                <tr><th>SKU</th><th>Name</th><th>Category</th><th>In Stock</th><th>Sold (Period)</th><th>Unit Price</th><th>Unit Cost</th><th>Retail Value</th><th>Cost Value</th><th>Profit Potential</th></tr>
              </thead>
              <tbody>
                {u.items.map((item) => (
                  <tr key={item.sku}>
                    <td>{item.sku}</td>
                    <td>{item.name}</td>
                    <td>{item.category}</td>
                    <td>{item.qty}</td>
                    <td>{item.sold_in_period}</td>
                    <td>{item.unit_price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td>{item.unit_cost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td>{item.retail_value.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td>{item.cost_value.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td>{item.profit_potential.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  </tr>
                ))}
                {u.items.length === 0 && <tr><td colSpan={10} className="muted" style={{ textAlign: "center", padding: 16 }}>No unsold inventory.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
