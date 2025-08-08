import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Fetch job
    const { data: job, error: jobError } = await supabase
      .from("creation_queue")
      .select(
        "id, source_slug, target_slug, status, result_slug, error_message, created_at, started_at, finished_at"
      )
      .eq("id", id)
      .single();

    if (jobError || !job) {
      return NextResponse.json(
        { error: "Queue job not found" },
        { status: 404 }
      );
    }

    // Fetch logs
    const { data: logs, error: logsError } = await supabase
      .from("creation_logs")
      .select(
        "id, ts, level, phase, tool_name, message, args_snip, result_snip"
      )
      .eq("queue_id", id)
      .order("ts", { ascending: true });

    if (logsError) {
      return NextResponse.json({ job, logs: [] });
    }

    return NextResponse.json({ job, logs: logs || [] });
  } catch (error) {
    console.error("Error in queue status API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
