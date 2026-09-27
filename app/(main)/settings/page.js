"use client";
import { useState } from "react";

export default function SettingsPage() {
  const [confirmText, setConfirmText] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function clearAll() {
    if (confirmText !== "DELETE") {
      setError('Type "DELETE" exactly to confirm.');
      return;
    }
    if (!confirm("This will permanently erase ALL inventory and invoices. This cannot be undone. Continue?")) return;
    setBusy(true);
    setError(""); setMsg("");
    try {
      const res = await fetch("/api/settings/clear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: confirmText }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Could not clear data."); return; }
      setMsg("All inventory and invoice data has been erased.");
      setConfirmText("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h2 style={{ color: "var(--gold)" }}>Settings</h2>

      <div className="card">
        <h2>About</h2>
        <p>RupRong Inventory & Invoicing — web version 1.0</p>
        <p className="muted">Your data is stored in a private Neon Postgres database, accessible only through this app.</p>
      </div>

      <div className="card" style={{ borderColor: "var(--danger)" }}>
        <h2 style={{ color: "var(--danger)" }}>Danger Zone</h2>
        {error && <div className="msg msg-error">{error}</div>}
        {msg && <div className="msg msg-success">{msg}</div>}
        <p>
          If you entered wrong data or want a completely clean start, you can permanently erase
          every inventory item and invoice. This cannot be undone.
        </p>
        <div className="field">
          <label>Type DELETE to confirm</label>
          <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} style={{ maxWidth: 200 }} />
        </div>
        <button className="btn btn-danger" style={{ marginTop: 10 }} onClick={clearAll} disabled={busy}>
          {busy ? "Clearing..." : "Clear All Data (Inventory + Invoices)"}
        </button>
      </div>
    </div>
  );
}
