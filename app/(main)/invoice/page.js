"use client";
import { useEffect, useState, useCallback } from "react";

export default function InvoicePage() {
  const [items, setItems] = useState([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [parcelId, setParcelId] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [invoiceNo, setInvoiceNo] = useState("");
  const [lineItems, setLineItems] = useState([]);
  const [selectedItemId, setSelectedItemId] = useState("");
  const [customDesc, setCustomDesc] = useState("");
  const [qty, setQty] = useState("1");
  const [unitPrice, setUnitPrice] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [discountType, setDiscountType] = useState("flat");
  const [discountValue, setDiscountValue] = useState("0");
  const [deliveryCharge, setDeliveryCharge] = useState("0");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const loadItems = useCallback(async () => {
    const res = await fetch("/api/items");
    const data = await res.json();
    setItems(data.items || []);
  }, []);

  const loadNextInvoiceNo = useCallback(async () => {
    const res = await fetch("/api/invoices/next-number");
    const data = await res.json();
    setInvoiceNo(data.invoice_no);
  }, []);

  useEffect(() => { loadItems(); loadNextInvoiceNo(); }, [loadItems, loadNextInvoiceNo]);

  const searchResults = productSearch.trim()
    ? items.filter((it) => {
        const q = productSearch.toLowerCase();
        return it.name.toLowerCase().includes(q) || it.sku.toLowerCase().includes(q) || (it.category || "").toLowerCase().includes(q);
      }).slice(0, 8)
    : [];

  function pickItem(item) {
    setSelectedItemId(String(item.id));
    setUnitPrice(String(item.price));
    setCustomDesc("");
    setProductSearch("");
  }

  function addLine() {
    setError("");
    const qNum = parseInt(qty, 10);
    const priceNum = parseFloat(unitPrice);
    if (!qNum || qNum <= 0) { setError("Quantity must be a positive number."); return; }
    if (!Number.isFinite(priceNum)) { setError("Unit price must be a number."); return; }

    let itemId = null, description = "";
    if (selectedItemId && !customDesc.trim()) {
      const item = items.find((it) => String(it.id) === selectedItemId);
      if (!item) { setError("Selected item not found."); return; }
      const alreadyUsed = lineItems.filter((li) => li.item_id === item.id).reduce((s, li) => s + li.quantity, 0);
      if (qNum + alreadyUsed > item.quantity) {
        setError(`Only ${item.quantity} in stock for ${item.name} (${alreadyUsed} already on this invoice).`);
        return;
      }
      itemId = item.id;
      description = item.name + (item.purity ? ` (${item.purity})` : "");
    } else if (customDesc.trim()) {
      description = customDesc.trim();
    } else {
      setError("Select an inventory item or type a custom description.");
      return;
    }

    setLineItems([...lineItems, { item_id: itemId, description, quantity: qNum, unit_price: priceNum, line_total: qNum * priceNum }]);
    setSelectedItemId(""); setCustomDesc(""); setQty("1"); setUnitPrice("");
  }

  function removeLine(idx) {
    setLineItems(lineItems.filter((_, i) => i !== idx));
  }

  const subtotal = lineItems.reduce((s, li) => s + li.line_total, 0);
  const dVal = parseFloat(discountValue) || 0;
  let discountAmount = discountType === "percent" ? subtotal * (dVal / 100) : dVal;
  discountAmount = Math.max(0, Math.min(discountAmount, subtotal));
  const delivery = parseFloat(deliveryCharge) || 0;
  const total = subtotal - discountAmount + delivery;

  function resetForm() {
    setCustomerName(""); setCustomerPhone(""); setCustomerAddress(""); setParcelId("");
    setInvoiceDate(new Date().toISOString().slice(0, 10));
    setLineItems([]); setDiscountType("flat"); setDiscountValue("0"); setDeliveryCharge("0");
    loadNextInvoiceNo();
  }

  async function generateInvoice() {
    setError("");
    if (!customerName.trim()) { setError("Customer name is required."); return; }
    if (lineItems.length === 0) { setError("Add at least one item."); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoice_no: invoiceNo, invoice_date: invoiceDate,
          customer_name: customerName, customer_phone: customerPhone, customer_address: customerAddress,
          parcel_id: parcelId, discount_type: discountValue > 0 ? discountType : "none",
          discount_value: dVal, delivery_charge: delivery, line_items: lineItems,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Could not create invoice."); return; }
      window.open(`/api/invoices/${data.invoice.id}/pdf`, "_blank");
      resetForm();
      loadItems();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h2 style={{ color: "var(--gold)" }}>Create Invoice</h2>
      {error && <div className="msg msg-error">{error}</div>}

      <div className="card">
        <h2>Customer & Invoice Details</h2>
        <div className="row">
          <div className="field"><label>Customer Name*</label><input value={customerName} onChange={(e) => setCustomerName(e.target.value)} /></div>
          <div className="field"><label>Phone</label><input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} /></div>
          <div className="field"><label>Invoice No</label><input value={invoiceNo} readOnly style={{ background: "#f4f0ea" }} /></div>
          <div className="field"><label>Date</label><input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} /></div>
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          <div className="field" style={{ flex: 1 }}><label>Address</label><input style={{ width: "100%" }} value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} /></div>
          <div className="field"><label>Parcel ID (optional)</label><input value={parcelId} onChange={(e) => setParcelId(e.target.value)} /></div>
        </div>
      </div>

      <div className="card">
        <h2>Add Item to Invoice</h2>
        <div className="row">
          <div className="field">
            <label>From inventory</label>
            <select value={selectedItemId} onChange={(e) => { setSelectedItemId(e.target.value); const it = items.find((x) => String(x.id) === e.target.value); if (it) { setUnitPrice(String(it.price)); setCustomDesc(""); } }} style={{ minWidth: 280 }}>
              <option value="">-- choose an item --</option>
              {items.map((it) => (
                <option key={it.id} value={it.id}>{it.sku} - {it.name} (stock: {it.quantity}, price: {Number(it.price).toLocaleString()})</option>
              ))}
            </select>
          </div>
          <div className="field"><label>or custom description</label><input value={customDesc} onChange={(e) => { setCustomDesc(e.target.value); setSelectedItemId(""); }} /></div>
          <div className="field"><label>Qty</label><input type="number" value={qty} onChange={(e) => setQty(e.target.value)} style={{ minWidth: 70 }} /></div>
          <div className="field"><label>Unit Price</label><input type="number" step="0.01" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} /></div>
          <button className="btn" onClick={addLine}>+ Add Line</button>
        </div>

        <div className="field" style={{ marginTop: 14 }}>
          <label>Or search products (by name / SKU / category)</label>
          <input value={productSearch} onChange={(e) => setProductSearch(e.target.value)} style={{ minWidth: 320 }} placeholder="Start typing..." />
          {searchResults.length > 0 && (
            <div className="search-results">
              {searchResults.map((it) => (
                <div key={it.id} onClick={() => pickItem(it)}>
                  {it.sku} - {it.name} (stock: {it.quantity}, price: {Number(it.price).toLocaleString()})
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <table>
          <thead><tr><th>Description</th><th>Qty</th><th>Unit Price</th><th>Line Total</th><th></th></tr></thead>
          <tbody>
            {lineItems.map((li, i) => (
              <tr key={i}>
                <td>{li.description}</td><td>{li.quantity}</td>
                <td>{li.unit_price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td>{li.line_total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td><button className="btn btn-sm btn-danger" onClick={() => removeLine(i)}>Remove</button></td>
              </tr>
            ))}
            {lineItems.length === 0 && <tr><td colSpan={5} className="muted" style={{ textAlign: "center", padding: 16 }}>No items added yet.</td></tr>}
          </tbody>
        </table>

        <div className="row" style={{ justifyContent: "space-between", marginTop: 16, alignItems: "flex-end" }}>
          <div className="row">
            <div className="field">
              <label>Discount</label>
              <div className="row" style={{ gap: 6 }}>
                <input type="number" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} style={{ minWidth: 90 }} />
                <select value={discountType} onChange={(e) => setDiscountType(e.target.value)}>
                  <option value="flat">Flat</option>
                  <option value="percent">Percent (%)</option>
                </select>
              </div>
            </div>
            <div className="field">
              <label>Delivery Charge</label>
              <input type="number" value={deliveryCharge} onChange={(e) => setDeliveryCharge(e.target.value)} style={{ minWidth: 110 }} />
            </div>
          </div>
          <div className="total-box">
            <div className="line">Subtotal: {subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
            {discountAmount > 0 && <div className="line">Discount: -{discountAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>}
            {delivery > 0 && <div className="line">Delivery: +{delivery.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>}
            <div className="grand">Total: {total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <button className="btn btn-primary" onClick={generateInvoice} disabled={saving}>
            {saving ? "Generating..." : "Generate Invoice (PDF)"}
          </button>
        </div>
      </div>
    </div>
  );
}
