"use client";
import { useEffect, useState, useCallback } from "react";

export default function SettingsPage() {
  const [confirmText, setConfirmText] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // User management state
  const [users, setUsers] = useState([]);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [userMsg, setUserMsg] = useState("");
  const [userError, setUserError] = useState("");
  const [editingUser, setEditingUser] = useState(null);
  const [editUsername, setEditUsername] = useState("");
  const [editPassword, setEditPassword] = useState("");

  const loadUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/users");
      const data = await res.json();
      setUsers(data.users || []);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

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

  async function handleCreateUser(e) {
    e.preventDefault();
    setUserError(""); setUserMsg("");
    const res = await fetch("/api/settings/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: newUsername, password: newPassword }),
    });
    const data = await res.json();
    if (!res.ok) { setUserError(data.error || "Could not create user."); return; }
    setUserMsg(`User "${data.user.username}" created successfully.`);
    setNewUsername(""); setNewPassword("");
    loadUsers();
  }

  function startEdit(user) {
    setEditingUser(user.id);
    setEditUsername(user.username);
    setEditPassword("");
  }

  async function handleUpdateUser(e) {
    e.preventDefault();
    setUserError(""); setUserMsg("");
    const payload = { username: editUsername };
    if (editPassword) payload.password = editPassword;
    const res = await fetch(`/api/settings/users/${editingUser}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) { setUserError(data.error || "Could not update user."); return; }
    setUserMsg(`User updated successfully.`);
    setEditingUser(null);
    loadUsers();
  }

  async function handleDeleteUser(user) {
    if (!confirm(`Delete user "${user.username}"?`)) return;
    setUserError(""); setUserMsg("");
    const res = await fetch(`/api/settings/users/${user.id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) { setUserError(data.error || "Could not delete user."); return; }
    setUserMsg(`User "${user.username}" deleted.`);
    loadUsers();
  }

  return (
    <div>
      <h2 style={{ color: "var(--gold)" }}>Settings</h2>

      <div className="card">
        <h2>User Management</h2>
        <p className="muted">Create and manage user accounts. Each user has their own username and password.</p>
        {userError && <div className="msg msg-error">{userError}</div>}
        {userMsg && <div className="msg msg-success">{userMsg}</div>}

        <table style={{ marginTop: 12 }}>
          <thead>
            <tr><th>ID</th><th>Username</th><th>Created</th><th></th></tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.id}</td>
                <td>
                  {editingUser === u.id ? (
                    <input value={editUsername} onChange={(e) => setEditUsername(e.target.value)} style={{ width: 120, padding: "4px 8px" }} />
                  ) : (
                    u.username
                  )}
                </td>
                <td>{u.created_at ? new Date(u.created_at).toISOString().slice(0, 10) : "—"}</td>
                <td>
                  {editingUser === u.id ? (
                    <>
                      <input type="password" placeholder="New password (blank = keep)" value={editPassword} onChange={(e) => setEditPassword(e.target.value)} style={{ width: 160, padding: "4px 8px", marginRight: 6 }} />
                      <button className="btn btn-sm btn-primary" onClick={handleUpdateUser}>Save</button>{" "}
                      <button className="btn btn-sm" onClick={() => setEditingUser(null)}>Cancel</button>
                    </>
                  ) : (
                    <>
                      <button className="btn btn-sm" onClick={() => startEdit(u)}>Edit</button>{" "}
                      <button className="btn btn-sm btn-danger" onClick={() => handleDeleteUser(u)}>Delete</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr><td colSpan={4} className="muted" style={{ textAlign: "center", padding: 16 }}>No users found.</td></tr>
            )}
          </tbody>
        </table>

        <form onSubmit={handleCreateUser} style={{ marginTop: 16 }}>
          <h3 style={{ fontSize: 14, color: "var(--gold)" }}>Create New User</h3>
          <div className="row">
            <div className="field">
              <label>Username</label>
              <input value={newUsername} onChange={(e) => setNewUsername(e.target.value)} required />
            </div>
            <div className="field">
              <label>Password</label>
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
            </div>
            <button type="submit" className="btn btn-primary">Create User</button>
          </div>
        </form>
      </div>

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
