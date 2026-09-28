export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getUsers, createUser } from "../../../../lib/auth";

export async function GET() {
  const users = await getUsers();
  return NextResponse.json({ users });
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const result = await createUser(body.username, body.password);
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ user: result.user });
}
