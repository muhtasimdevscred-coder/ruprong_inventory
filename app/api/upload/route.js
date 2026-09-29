export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const dataUrl = body?.dataUrl;

    if (!dataUrl || typeof dataUrl !== "string") {
      return NextResponse.json({ error: "No image data provided" }, { status: 400 });
    }

    // Validate data URL format
    const match = dataUrl.match(/^data:(image\/(jpeg|png|gif|webp));base64,(.+)$/);
    if (!match) {
      return NextResponse.json({ error: "Invalid image format. Only JPEG, PNG, GIF, and WebP are allowed." }, { status: 400 });
    }

    // Validate size (max 5MB base64 encoded ~ 3.75MB binary)
    const base64Data = match[2];
    const sizeInBytes = Math.ceil((base64Data.length * 3) / 4);
    if (sizeInBytes > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "File too large. Maximum size is 5MB." }, { status: 400 });
    }

    return NextResponse.json({ url: dataUrl });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
