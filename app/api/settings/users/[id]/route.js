export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { updateUser, deleteUser } from "../../../../../lib/auth";

export async function PUT(request, { params }) {
  const id = parseInt(params.id, 10);
  const body = await request.json().catch(() => ({}));
  const result = await updateUser(id, { username: body.username, password: body.password });
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ user: result.user });
}

export async function DELETE(request, { params }) {
  const id = parseInt(params.id, 10);
  const result = await deleteUser(id);
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
