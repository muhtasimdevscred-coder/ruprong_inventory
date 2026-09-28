"use client";
import { useEffect, useState, useCallback, useRef } from "react";

const CATEGORIES = ["Ring", "Necklace", "Earring", "Bracelet", "Bangle", "Anklet", "Pendant", "Chain", "Set", "Other"];
const EMPTY_FORM = {
  id: null, sku: "", name: "", category: "", quantity: "0", price: "",
  cost_price: "", weight: "", purity: "", stone: "", notes: "",
};

export default function InventoryPage() {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [selected, setSelected] = useState(new Set());
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [importSummary, setImportSummary] = useState(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef(null);

  const load = useCallback(async (q) => {
    const res = await fetch(`/api/items?search=${encodeURIComponent(q || "")}`);
    const data = await res.json();
    setItems(data.items || []);
  }, []);

  useEffect(() => { load(search); }, [search, load]);

  function flash(setter, msg) {
    setter(msg);
    setTimeout(() => setter(""), 4000);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    const payload = {
      sku: form.sku, name: form.name, category: form.category,
      quantity: parseInt(form.quantity, 10) || 0, price: parseFloat(form.price) || 0,
      cost_price: form.cost_price === "" ? null : parseFloat(form.cost_price),
      weight: form.weight === "" ? null : parseFloat(form.weight),
      purity: form.purity, stone: form.stone, notes: form.notes,
    };
    const isEdit = !!form.id;
    const res = await fetch(isEdit ? `/api/items/${form.id}` : "/api/items", {
      method: isEdit ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Something went wrong.");
      return;
    }
    setForm(EMPTY_FORM);
    flash(setSuccess, isEdit ? "Item updated." : "Item added.");
    load(search);
  }

  function editRow(item) {
    setForm({
      id: item.id, sku: item.sku, name: item.name, category: item.category || "",
      quantity: String(item.quantity), price: String(item.price),
      cost_price: item.cost_price == null ? "" : String(item.cost_price),
      weight: item.weight == null ? "" : String(item.weight),
      purity: item.purity || "", stone: item.stone || "", notes: item.notes || "",
    });
  }

  async function deleteRow(id) {
    if (!confirm("Delete this item?")) return;
    await fetch(`/api/items/${id}`, { method: "DELETE" });
    if (form.id === id) setForm(EMPTY_FORM);
    flash(setSuccess, "Item deleted.");
    load(search);
  }

  function toggleSelect(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function exportCsv() {
    const ids = [...selected];
    const url = ids.length ? `/api/items/export?ids=${ids.join(",")}` : "/api/items/export";
    window.location.href = url;
  }

  async function handleImportFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportSummary(null);
    try {
      const isExcel = /\.(xlsx|xls)$/i.test(file.name);
      let res;
      if (isExcel) {
        const buffer = await file.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
        res = await fetch("/api/items/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ excel: base64 }),
        });
      } else {
        const text = await file.text();
        res = await fetch("/api/items/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ csv: text }),
        });
      }
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Import failed.");
      } else {
        setImportSummary(data);
        load(search);
      }
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const totalUnits = items.reduce((s, it) => s + it.quantity, 0);

  return (
    <div>
      <h2 style={{ color: "var(--gold)" }}>Inventory</h2>
      {error && <div className="msg msg-error">{error}</div>}
      {success && <div className="msg msg-success">{success}</div>}

      <div className="card">
        <h2>{form.id ? "Edit Item" : "Add Item"}</h2>
        <form onSubmit={handleSubmit}>
          <div className="row">
            <div className="field">
              <label>SKU (blank = auto)</label>
              <input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
            </div>
            <div className="field">
              <label>Name*</label>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="field">
              <label>Category (type new or pick)</label>
              <input list="categories" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
              <datalist id="categories">
                {CATEGORIES.map((c) => <option key={c} value={c} />)}
              </datalist>
            </div>
          </div>
          <div className="row" style={{ marginTop: 10 }}>
            <div className="field">
              <label>Quantity*</label>
              <input required type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} style={{ minWidth: 90 }} />
            </div>
            <div className="field">
              <label>Selling Price*</label>
              <input required type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
            </div>
            <div className="field">
              <label>Cost Price</label>
              <input type="number" step="0.01" value={form.cost_price} onChange={(e) => setForm({ ...form, cost_price: e.target.value })} />
            </div>
            <div className="field">
              <label>Weight (g)</label>
              <input type="number" step="0.01" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} style={{ minWidth: 90 }} />
            </div>
            <div className="field">
              <label>Purity / Karat</label>
              <input value={form.purity} onChange={(e) => setForm({ ...form, purity: e.target.value })} style={{ minWidth: 100 }} />
            </div>
            <div className="field">
              <label>Stone</label>
              <input value={form.stone} onChange={(e) => setForm({ ...form, stone: e.target.value })} style={{ minWidth: 100 }} />
            </div>
          </div>
          <div className="row" style={{ marginTop: 10 }}>
            <div className="field" style={{ flex: 1 }}>
              <label>Notes</label>
              <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} style={{ width: "100%" }} />
            </div>
          </div>
          <div className="row" style={{ marginTop: 14 }}>
            <button type="submit" className="btn btn-primary">{form.id ? "Update Item" : "Add Item"}</button>
            {form.id && <button type="button" className="btn" onClick={() => setForm(EMPTY_FORM)}>Cancel Edit</button>}
          </div>
        </form>
      </div>

      <div className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div className="field">
            <label>Search</label>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, SKU, or category" />
          </div>
          <div className="row">
            <button className="btn" onClick={exportCsv}>
              Export {selected.size ? `Selected (${selected.size})` : "All"} to CSV
            </button>
            <label className="btn" style={{ marginBottom: 0 }}>
              {importing ? "Importing..." : "Bulk Import CSV / Excel"}
              <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" onChange={handleImportFile} style={{ display: "none" }} disabled={importing} />
            </label>
          </div>
        </div>
        {importSummary && (
          <div className="msg msg-success" style={{ marginTop: 10 }}>
            Import done: {importSummary.inserted} added, {importSummary.updated} updated
            {importSummary.nextSku ? ` — next SKU: RR-${String(importSummary.nextSku).padStart(4, "0")}` : ""}
            {importSummary.errors.length > 0 && `, ${importSummary.errors.length} row(s) skipped`}.
            {importSummary.errors.length > 0 && (
              <ul style={{ margin: "6px 0 0" }}>
                {importSummary.errors.slice(0, 8).map((e, i) => (
                  <li key={i}>Row {e.row}: {e.message}</li>
                ))}
              </ul>
            )}
          </div>
        )}
        <p className="muted" style={{ marginTop: 8 }}>
          CSV/Excel columns: Name, Category, Quantity, Selling Price, Cost Price, Weight (g), Purity, Stone, Notes.
          All products are assigned serial SKU numbers (RR-0001, RR-0002, etc.) automatically.
        </p>
        <p className="muted">{items.length} item types | {totalUnits} units in stock</p>
        <table>
          <thead>
            <tr>
              <th></th><th>SKU</th><th>Name</th><th>Category</th><th>Qty</th>
              <th>Price</th><th>Cost</th><th>Weight</th><th>Purity</th><th>Stone</th><th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id} className={it.quantity <= 3 ? "low-stock" : ""}>
                <td><input type="checkbox" checked={selected.has(it.id)} onChange={() => toggleSelect(it.id)} /></td>
                <td>{it.sku}</td>
                <td>{it.name}</td>
                <td>{it.category}</td>
                <td>{it.quantity}</td>
                <td>{Number(it.price).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td>{it.cost_price != null ? Number(it.cost_price).toLocaleString(undefined, { minimumFractionDigits: 2 }) : ""}</td>
                <td>{it.weight ?? ""}</td>
                <td>{it.purity}</td>
                <td>{it.stone}</td>
                <td>
                  <button className="btn btn-sm" onClick={() => editRow(it)}>Edit</button>{" "}
                  <button className="btn btn-sm btn-danger" onClick={() => deleteRow(it.id)}>Delete</button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={11} className="muted" style={{ padding: 20, textAlign: "center" }}>No items yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
