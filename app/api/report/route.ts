import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { pageId, reportType, reasonText } = body;

    // Validate input
    if (!pageId || !reportType) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Validate report type
    const validReportTypes = ["부적절함", "논리적 오류", "기타"];
    if (!validReportTypes.includes(reportType)) {
      return NextResponse.json(
        { error: "Invalid report type" },
        { status: 400 }
      );
    }

    // Check if page exists
    const { data: page, error: pageError } = await supabase
      .from("pages")
      .select("id")
      .eq("id", pageId)
      .single();

    if (pageError || !page) {
      return NextResponse.json({ error: "Page not found" }, { status: 404 });
    }

    // Insert report
    const { error: insertError } = await supabase.from("reports").insert({
      page_id: pageId,
      report_type: reportType,
      reason_text: reasonText || null,
    });

    if (insertError) {
      console.error("Error inserting report:", insertError);
      return NextResponse.json(
        { error: "Failed to submit report" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in report API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
