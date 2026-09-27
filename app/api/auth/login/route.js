export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { checkPassword, createSessionToken, SESSION_COOKIE_NAME } from "../../../../lib/auth";

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  if (!checkPassword(body.password)) {
    return NextResponse.json({ error: "Wrong password" }, { status: 401 });
  }
  const token = await createSessionToken();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
