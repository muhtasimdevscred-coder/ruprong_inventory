export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getReportSummary } from "../../../../lib/reports";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");
  if (!start || !end) {
    return NextResponse.json({ error: "start and end dates are required" }, { status: 400 });
  }
  const summary = await getReportSummary(start, end);
  return NextResponse.json({ summary });
}
