import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

// Service role client for storage operations
function getServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const supabase = await createClient();
    const { slug } = await params;

    // Fetch page metadata from database
    const { data: page, error: pageError } = await supabase
      .from("pages")
      .select("*")
      .eq("slug", slug)
      .single();

    if (pageError || !page) {
      return NextResponse.json({ error: "Page not found" }, { status: 404 });
    }

    // Fetch markdown content from storage using service client
    const serviceSupabase = getServiceClient();
    const { data: storageData, error: storageError } =
      await serviceSupabase.storage
        .from("pages")
        .download(page.storage_object_path);

    if (storageError || !storageData) {
      console.error("Storage error:", storageError);
      return NextResponse.json(
        { error: "Failed to fetch page content" },
        { status: 500 }
      );
    }

    // Convert blob to text
    const markdown = await storageData.text();

    // Record page view
    await supabase.from("page_views").insert({ page_id: page.id });

    // Update last visited timestamp
    await supabase
      .from("pages")
      .update({ last_visited_at: new Date().toISOString() })
      .eq("id", page.id);

    // Get view count
    const { count: viewCount } = await supabase
      .from("page_views")
      .select("*", { count: "exact", head: true })
      .eq("page_id", page.id);

    return NextResponse.json({
      id: page.id,
      slug: page.slug,
      title: page.title,
      markdown: markdown,
      summary: page.summary,
      created_at: page.created_at,
      updated_at: page.updated_at,
      view_count: viewCount || 0,
    });
  } catch (error) {
    console.error("Error fetching wiki page:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
