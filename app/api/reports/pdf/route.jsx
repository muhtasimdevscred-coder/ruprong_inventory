import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { getReportSummary } from "../../../../lib/reports";
import ReportDocument from "../../../../lib/pdf/ReportDocument";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");
  if (!start || !end) {
    return new Response("start and end are required", { status: 400 });
  }
  const summary = await getReportSummary(start, end);
  const buffer = await renderToBuffer(<ReportDocument start={start} end={end} summary={summary} />);

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="RupRong_Sales_Report_${start}_to_${end}.pdf"`,
    },
  });
}
