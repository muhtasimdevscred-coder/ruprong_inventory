const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
export const SESSION_COOKIE_NAME = "ruprong_session";

function bufToBase64Url(buf) {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const base64 = btoa(binary);
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function getKey() {
  const secret = process.env.SESSION_SECRET || "dev-secret-change-me";
  const enc = new TextEncoder();
  return crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
}

async function sign(payload) {
  const key = await getKey();
  const enc = new TextEncoder();
  const sigBuf = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return bufToBase64Url(sigBuf);
}

export async function createSessionToken(userId) {
  const payload = `ok.${Date.now()}.${userId || 0}`;
  const sig = await sign(payload);
  return `${payload}.${sig}`;
}

export async function verifySessionToken(token) {
  if (!token || typeof token !== "string") return false;
  const parts = token.split(".");
  // Support both old 3-part tokens (ok.timestamp.sig) and new 4-part tokens (ok.timestamp.userId.sig)
  if (parts.length === 3) {
    const [tag, ts, sig] = parts;
    const payload = `${tag}.${ts}`;
    const expectedSig = await sign(payload);
    if (expectedSig !== sig) return false;
    if (tag !== "ok") return false;
    const issuedAt = Number(ts);
    if (!Number.isFinite(issuedAt)) return false;
    if (Date.now() - issuedAt > SESSION_MAX_AGE_MS) return false;
    return true;
  }
  if (parts.length === 4) {
    const [tag, ts, uid, sig] = parts;
    const payload = `${tag}.${ts}.${uid}`;
    const expectedSig = await sign(payload);
    if (expectedSig !== sig) return false;
    if (tag !== "ok") return false;
    const issuedAt = Number(ts);
    if (!Number.isFinite(issuedAt)) return false;
    if (Date.now() - issuedAt > SESSION_MAX_AGE_MS) return false;
    return true;
  }
  return false;
}

export async function getSessionUserId(token) {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [tag, ts, uid, sig] = parts;
  const payload = `${tag}.${ts}.${uid}`;
  const expectedSig = await sign(payload);
  if (expectedSig !== sig) return null;
  if (tag !== "ok") return null;
  const issuedAt = Number(ts);
  if (!Number.isFinite(issuedAt)) return null;
  if (Date.now() - issuedAt > SESSION_MAX_AGE_MS) return null;
  return parseInt(uid, 10) || 0;
}
