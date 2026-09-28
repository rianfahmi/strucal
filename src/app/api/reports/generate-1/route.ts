import { generateReportDocx, type ReportGenerationInput } from "../../../../lib/report-docx";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const input = await request.json() as ReportGenerationInput;
    const report = generateReportDocx(input);
    return new Response(Buffer.from(report), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${input.snapshot.file_name.replace(/["\\]/g, "")}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Generate DOCX gagal." }, { status: 400 });
  }
}
