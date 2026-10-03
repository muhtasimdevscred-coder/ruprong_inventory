"use client";
import { useEffect, useState, useCallback } from "react";
import { cachedFetch, invalidateCache } from "../../../lib/client-cache";

export default function HistoryPage() {
  const [invoices, setInvoices] = useState([]);
  const [search, setSearch] = useState("");
  const [msg, setMsg] = useState("");
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [items, setItems] = useState([]);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState("");

  const load = useCallback(async (q) => {
    const res = await cachedFetch(`/api/invoices?search=${encodeURIComponent(q || "")}`);
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

  async function startEdit(inv) {
    setEditing(inv.id);
    setEditError("");
    const res = await fetch(`/api/invoices/${inv.id}`);
    const data = await res.json();
    const itemsRes = await fetch("/api/items");
    const itemsData = await itemsRes.json();
    setItems(itemsData.items || []);
    setEditForm({
      customer_name: data.invoice.customer_name,
      customer_phone: data.invoice.customer_phone || "",
      customer_address: data.invoice.customer_address || "",
      parcel_id: data.invoice.parcel_id || "",
      invoice_date: data.invoice.invoice_date,
      discount_type: data.invoice.discount_type === "none" ? "flat" : data.invoice.discount_type,
      discount_value: String(data.invoice.discount_value || 0),
      delivery_charge: String(data.invoice.delivery_charge || 0),
      line_items: data.items.map((li) => ({
        item_id: li.item_id,
        description: li.description,
        quantity: li.quantity,
        unit_price: li.unit_price,
        line_total: li.line_total,
      })),
    });
  }

  function updateEditLine(idx, field, value) {
    const updated = [...editForm.line_items];
    updated[idx] = { ...updated[idx], [field]: value };
    if (field === "quantity" || field === "unit_price") {
      const qty = field === "quantity" ? parseFloat(value) || 0 : updated[idx].quantity;
      const price = field === "unit_price" ? parseFloat(value) || 0 : updated[idx].unit_price;
      updated[idx].line_total = qty * price;
    }
    setEditForm({ ...editForm, line_items: updated });
  }

  function removeEditLine(idx) {
    setEditForm({ ...editForm, line_items: editForm.line_items.filter((_, i) => i !== idx) });
  }

  function addEditLine() {
    setEditForm({
      ...editForm,
      line_items: [...editForm.line_items, { item_id: null, description: "", quantity: 1, unit_price: 0, line_total: 0 }],
    });
  }

  function pickEditItem(idx, itemId) {
    const item = items.find((it) => String(it.id) === itemId);
    if (item) {
      const updated = [...editForm.line_items];
      updated[idx] = { ...updated[idx], item_id: item.id, description: item.name, unit_price: item.price, line_total: updated[idx].quantity * item.price };
      setEditForm({ ...editForm, line_items: updated });
    }
  }

  async function saveEdit() {
    setEditError("");
    if (!editForm.customer_name.trim()) { setEditError("Customer name is required."); return; }
    if (editForm.line_items.length === 0) { setEditError("Add at least one item."); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/invoices/${editing}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_name: editForm.customer_name,
          customer_phone: editForm.customer_phone,
          customer_address: editForm.customer_address,
          parcel_id: editForm.parcel_id,
          invoice_date: editForm.invoice_date,
          discount_type: parseFloat(editForm.discount_value) > 0 ? editForm.discount_type : "none",
          discount_value: parseFloat(editForm.discount_value) || 0,
          delivery_charge: parseFloat(editForm.delivery_charge) || 0,
          line_items: editForm.line_items,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setEditError(data.error || "Could not update invoice."); return; }
      setMsg("Invoice updated successfully.");
      setTimeout(() => setMsg(""), 4000);
      setEditing(null);
      setEditForm(null);
      load(search);
    } finally {
      setSaving(false);
    }
  }

  const subtotal = editForm ? editForm.line_items.reduce((s, li) => s + (parseFloat(li.line_total) || 0), 0) : 0;
  const dVal = editForm ? parseFloat(editForm.discount_value) || 0 : 0;
  let discountAmount = editForm ? (editForm.discount_type === "percent" ? subtotal * (dVal / 100) : dVal) : 0;
  discountAmount = Math.max(0, Math.min(discountAmount, subtotal));
  const delivery = editForm ? parseFloat(editForm.delivery_charge) || 0 : 0;
  const total = subtotal - discountAmount + delivery;

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
                  <button className="btn btn-sm btn-primary" onClick={() => startEdit(inv)}>Edit</button>{" "}
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

      {editing && editForm && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", zIndex: 100, overflow: "auto", padding: 40 }}>
          <div style={{ maxWidth: 900, margin: "0 auto", background: "#fff", borderRadius: 8, padding: 24 }}>
            <h2 style={{ color: "var(--gold)", marginTop: 0 }}>Edit Invoice</h2>
            {editError && <div className="msg msg-error">{editError}</div>}

            <div className="row">
              <div className="field"><label>Customer Name*</label><input value={editForm.customer_name} onChange={(e) => setEditForm({ ...editForm, customer_name: e.target.value })} /></div>
              <div className="field"><label>Phone</label><input value={editForm.customer_phone} onChange={(e) => setEditForm({ ...editForm, customer_phone: e.target.value })} /></div>
              <div className="field"><label>Date</label><input type="date" value={editForm.invoice_date} onChange={(e) => setEditForm({ ...editForm, invoice_date: e.target.value })} /></div>
            </div>
            <div className="row" style={{ marginTop: 10 }}>
              <div className="field" style={{ flex: 1 }}><label>Address</label><input style={{ width: "100%" }} value={editForm.customer_address} onChange={(e) => setEditForm({ ...editForm, customer_address: e.target.value })} /></div>
              <div className="field"><label>Parcel ID</label><input value={editForm.parcel_id} onChange={(e) => setEditForm({ ...editForm, parcel_id: e.target.value })} /></div>
            </div>

            <h3 style={{ fontSize: 14, color: "var(--gold)", marginTop: 16 }}>Line Items</h3>
            <table>
              <thead>
                <tr><th>Item</th><th>Description</th><th>Qty</th><th>Unit Price</th><th>Line Total</th><th></th></tr>
              </thead>
              <tbody>
                {editForm.line_items.map((li, idx) => (
                  <tr key={idx}>
                    <td style={{ minWidth: 160 }}>
                      <select value={li.item_id || ""} onChange={(e) => pickEditItem(idx, e.target.value)} style={{ width: "100%", padding: "4px" }}>
                        <option value="">— custom —</option>
                        {items.map((it) => (
                          <option key={it.id} value={it.id}>{it.sku} - {it.name} (stock: {it.quantity})</option>
                        ))}
                      </select>
                    </td>
                    <td style={{ minWidth: 160 }}><input value={li.description} onChange={(e) => updateEditLine(idx, "description", e.target.value)} style={{ width: "100%", padding: "4px" }} /></td>
                    <td style={{ minWidth: 60 }}><input type="number" value={li.quantity} onChange={(e) => updateEditLine(idx, "quantity", e.target.value)} style={{ width: "100%", padding: "4px" }} /></td>
                    <td style={{ minWidth: 80 }}><input type="number" step="0.01" value={li.unit_price} onChange={(e) => updateEditLine(idx, "unit_price", e.target.value)} style={{ width: "100%", padding: "4px" }} /></td>
                    <td>{Number(li.line_total).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td><button className="btn btn-sm btn-danger" onClick={() => removeEditLine(idx)}>Remove</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button className="btn btn-sm" style={{ marginTop: 8 }} onClick={addEditLine}>+ Add Line</button>

            <div className="row" style={{ marginTop: 16, justifyContent: "space-between", alignItems: "flex-end" }}>
              <div className="row">
                <div className="field">
                  <label>Discount</label>
                  <div className="row" style={{ gap: 6 }}>
                    <input type="number" value={editForm.discount_value} onChange={(e) => setEditForm({ ...editForm, discount_value: e.target.value })} style={{ minWidth: 90 }} />
                    <select value={editForm.discount_type} onChange={(e) => setEditForm({ ...editForm, discount_type: e.target.value })}>
                      <option value="flat">Flat</option>
                      <option value="percent">Percent (%)</option>
                    </select>
                  </div>
                </div>
                <div className="field">
                  <label>Delivery Charge</label>
                  <input type="number" value={editForm.delivery_charge} onChange={(e) => setEditForm({ ...editForm, delivery_charge: e.target.value })} style={{ minWidth: 110 }} />
                </div>
              </div>
              <div className="total-box">
                <div className="line">Subtotal: {subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                {discountAmount > 0 && <div className="line">Discount: -{discountAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>}
                {delivery > 0 && <div className="line">Delivery: +{delivery.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>}
                <div className="grand">Total: {total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
              </div>
            </div>

            <div className="row" style={{ marginTop: 20 }}>
              <button className="btn btn-primary" onClick={saveEdit} disabled={saving}>{saving ? "Saving..." : "Save Changes"}</button>
              <button className="btn" onClick={() => { setEditing(null); setEditForm(null); }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
