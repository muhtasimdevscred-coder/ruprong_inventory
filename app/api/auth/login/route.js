export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { checkPassword, createSessionToken, ensureDefaultUser, SESSION_COOKIE_NAME } from "../../../../lib/auth";
import { migrate } from "../../../../lib/migrate";

export async function POST(request) {
  await migrate();
  await ensureDefaultUser();
  const body = await request.json().catch(() => ({}));
  const username = (body.username || "").trim();
  const password = body.password || "";
  const user = await checkPassword(username, password);
  if (!user) {
    return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
  }
  const token = await createSessionToken(user.id);
  const res = NextResponse.json({ ok: true, username: user.username });
  res.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
