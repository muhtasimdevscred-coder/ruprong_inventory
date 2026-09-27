"use client";
import { useEffect, useState, useCallback } from "react";

export default function HistoryPage() {
  const [invoices, setInvoices] = useState([]);
  const [search, setSearch] = useState("");
  const [msg, setMsg] = useState("");

  const load = useCallback(async (q) => {
    const res = await fetch(`/api/invoices?search=${encodeURIComponent(q || "")}`);
    const data = await res.json();
    setInvoices(data.invoices || []);
  }, []);

  useEffect(() => { load(search); }, [search, load]);

  async function deleteInvoice(inv) {
    if (!confirm(`Delete invoice ${inv.invoice_no} for ${inv.customer_name}? Any stock it used will be added back to inventory. This can't be undone.`)) return;
    const res = await fetch(`/api/invoices/${inv.id}`, { method: "DELETE" });
    if (res.ok) {
      setMsg("Invoice deleted and stock restored.");
      setTimeout(() => setMsg(""), 4000);
      load(search);
    }
  }

  return (
    <div>
      <h2 style={{ color: "var(--gold)" }}>Invoice History</h2>
      {msg && <div className="msg msg-success">{msg}</div>}
      <div className="card">
        <div className="field">
          <label>Search</label>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Invoice no, customer, phone, or parcel ID" />
        </div>
        <table style={{ marginTop: 12 }}>
          <thead>
            <tr><th>Invoice No</th><th>Date</th><th>Customer</th><th>Phone</th><th>Parcel ID</th><th>Total</th><th></th></tr>
          </thead>
          <tbody>
            {invoices.map((inv) => (
              <tr key={inv.id}>
                <td>{inv.invoice_no}</td>
                <td>{new Date(inv.invoice_date).toISOString().slice(0, 10)}</td>
                <td>{inv.customer_name}</td>
                <td>{inv.customer_phone}</td>
                <td>{inv.parcel_id}</td>
                <td>{Number(inv.total).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td>
                  <a className="btn btn-sm" href={`/api/invoices/${inv.id}/pdf`} target="_blank" rel="noreferrer">View PDF</a>{" "}
                  <button className="btn btn-sm btn-danger" onClick={() => deleteInvoice(inv)}>Delete</button>
                </td>
              </tr>
            ))}
            {invoices.length === 0 && (
              <tr><td colSpan={7} className="muted" style={{ textAlign: "center", padding: 20 }}>No invoices yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
