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

export async function createSessionToken() {
  const payload = `ok.${Date.now()}`;
  const sig = await sign(payload);
  return `${payload}.${sig}`;
}

export async function verifySessionToken(token) {
  if (!token || typeof token !== "string") return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
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

export function checkPassword(candidate) {
  const real = process.env.APP_PASSWORD || "";
  return typeof candidate === "string" && candidate.length > 0 && candidate === real;
}
