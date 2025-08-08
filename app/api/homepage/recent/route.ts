import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();

    // Fetch 10 most recent pages
    const { data: pages, error } = await supabase
      .from("pages")
      .select("id, slug, title, created_at")
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) {
      console.error("Error fetching recent pages:", error);
      return NextResponse.json(
        { error: "Failed to fetch recent pages" },
        { status: 500 }
      );
    }

    return NextResponse.json(pages || []);
  } catch (error) {
    console.error("Error in recent pages API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
