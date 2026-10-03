"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { cachedFetch, invalidateCache } from "../../../lib/client-cache";

const CATEGORIES = ["Ring", "Necklace", "Earring", "Bracelet", "Bangle", "Anklet", "Pendant", "Chain", "Set", "Other"];
const EMPTY_FORM = {
  id: null, sku: "", name: "", category: "", quantity: "0", price: "",
  cost_price: "", notes: "", image_url: "",
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
  const [uploading, setUploading] = useState(false);
  const [lightboxImage, setLightboxImage] = useState(null);
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);

  const load = useCallback(async (q) => {
    const res = await cachedFetch(`/api/items?search=${encodeURIComponent(q || "")}`);
    const data = await res.json();
    setItems(data.items || []);
  }, []);

  useEffect(() => { load(search); }, [search, load]);

  function flash(setter, msg) {
    setter(msg);
    setTimeout(() => setter(""), 4000);
  }

  function handleImageUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const dataUrl = reader.result;
        const res = await fetch("/api/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dataUrl }),
        });
        const data = await res.json();
        if (!res.ok) { setError(data.error || "Upload failed."); return; }
        setForm((prev) => ({ ...prev, image_url: data.url }));
        flash(setSuccess, "Image uploaded.");
      } catch {
        setError("Upload failed.");
      } finally {
        setUploading(false);
        if (imageInputRef.current) imageInputRef.current.value = "";
      }
    };
    reader.onerror = () => {
      setError("Failed to read file.");
      setUploading(false);
    };
    reader.readAsDataURL(file);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    const payload = {
      sku: form.sku, name: form.name, category: form.category,
      quantity: parseInt(form.quantity, 10) || 0, price: parseFloat(form.price) || 0,
      cost_price: form.cost_price === "" ? null : parseFloat(form.cost_price),
      notes: form.notes,
      image_url: form.image_url || null,
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
      notes: item.notes || "",
      image_url: item.image_url || "",
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
          </div>
          <div className="row" style={{ marginTop: 10 }}>
            <div className="field" style={{ flex: 1 }}>
              <label>Notes</label>
              <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} style={{ width: "100%" }} />
            </div>
          </div>
          <div className="row" style={{ marginTop: 10, alignItems: "flex-end" }}>
            <div className="field">
              <label>Product Image</label>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <label className="btn" style={{ marginBottom: 0, cursor: "pointer" }}>
                  {uploading ? "Uploading..." : "Upload Image"}
                  <input ref={imageInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" onChange={handleImageUpload} style={{ display: "none" }} disabled={uploading} />
                </label>
                {form.image_url && (
                  <>
                    <img src={form.image_url} alt="Preview" style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 4, cursor: "pointer", border: "1px solid var(--border)" }} onClick={() => setLightboxImage(form.image_url)} />
                    <button type="button" className="btn btn-sm btn-danger" onClick={() => setForm({ ...form, image_url: "" })}>Remove</button>
                  </>
                )}
              </div>
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
            {importSummary.nextSku ? ` — next SKU: BN${importSummary.nextSku}` : ""}
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
          CSV/Excel columns: SKU, Name, Category, Quantity, Selling Price, Cost Price, Notes.
          If SKU is provided, it's used; otherwise a serial SKU (BN1, BN2, etc.) is assigned.
        </p>
        <p className="muted">{items.length} item types | {totalUnits} units in stock</p>
        <table>
          <thead>
            <tr>
              <th></th><th>Image</th><th>SKU</th><th>Name</th><th>Category</th><th>Qty</th>
              <th>Price</th><th>Cost</th><th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id} className={it.quantity <= 3 ? "low-stock" : ""}>
                <td><input type="checkbox" checked={selected.has(it.id)} onChange={() => toggleSelect(it.id)} /></td>
                <td>
                  {it.image_url ? (
                    <img src={it.image_url} alt={it.name} style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 4, cursor: "pointer", border: "1px solid var(--border)" }} onClick={() => setLightboxImage(it.image_url)} />
                  ) : (
                    <div style={{ width: 40, height: 40, borderRadius: 4, background: "#f4f0ea", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: "#bbb" }}>—</div>
                  )}
                </td>
                <td>{it.sku}</td>
                <td>{it.name}</td>
                <td>{it.category}</td>
                <td>{it.quantity}</td>
                <td>{Number(it.price).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td>{it.cost_price != null ? Number(it.cost_price).toLocaleString(undefined, { minimumFractionDigits: 2 }) : ""}</td>
                <td>
                  <button className="btn btn-sm" onClick={() => editRow(it)}>Edit</button>{" "}
                  <button className="btn btn-sm btn-danger" onClick={() => deleteRow(it.id)}>Delete</button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={9} className="muted" style={{ padding: 20, textAlign: "center" }}>No items yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {lightboxImage && (
        <div
          style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            background: "rgba(0,0,0,0.85)", zIndex: 1000,
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "zoom-out",
          }}
          onClick={() => setLightboxImage(null)}
        >
          <img
            src={lightboxImage}
            alt="Product"
            style={{ maxWidth: "90vw", maxHeight: "90vh", objectFit: "contain", borderRadius: 8 }}
            onClick={(e) => e.stopPropagation()}
          />
          <button
            style={{
              position: "absolute", top: 20, right: 20,
              background: "rgba(255,255,255,0.2)", border: "none", color: "#fff",
              fontSize: 24, cursor: "pointer", borderRadius: "50%", width: 40, height: 40,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
            onClick={() => setLightboxImage(null)}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
