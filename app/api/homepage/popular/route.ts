import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();

    // Get popular pages from last 24 hours
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    // First, get page view counts from the last 24 hours
    const { data: viewData, error: viewError } = await supabase
      .from("page_views")
      .select("page_id")
      .gte("viewed_at", twentyFourHoursAgo.toISOString());

    if (viewError) {
      console.error("Error fetching page views:", viewError);
      return NextResponse.json(
        { error: "Failed to fetch popular pages" },
        { status: 500 }
      );
    }

    // Count views per page
    const viewCounts = (viewData || []).reduce(
      (acc: Record<number, number>, view) => {
        acc[view.page_id] = (acc[view.page_id] || 0) + 1;
        return acc;
      },
      {}
    );

    // Get top 10 page IDs by view count
    const topPageIds = Object.entries(viewCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([pageId]) => parseInt(pageId));

    if (topPageIds.length === 0) {
      // If no views in last 24 hours, return most recently visited pages
      const { data: recentlyVisited, error: recentError } = await supabase
        .from("pages")
        .select("id, slug, title")
        .order("last_visited_at", { ascending: false })
        .limit(10);

      if (recentError) {
        console.error("Error fetching recently visited pages:", recentError);
        return NextResponse.json([]);
      }

      // Add view_count of 0 to each page
      const pagesWithViewCount = (recentlyVisited || []).map((page) => ({
        ...page,
        view_count: 0,
      }));

      return NextResponse.json(pagesWithViewCount);
    }

    // Fetch page details for top pages
    const { data: pages, error: pagesError } = await supabase
      .from("pages")
      .select("id, slug, title")
      .in("id", topPageIds);

    if (pagesError) {
      console.error("Error fetching page details:", pagesError);
      return NextResponse.json(
        { error: "Failed to fetch page details" },
        { status: 500 }
      );
    }

    // Add view counts and sort by popularity
    const pagesWithViewCount = (pages || [])
      .map((page) => ({
        ...page,
        view_count: viewCounts[page.id] || 0,
      }))
      .sort((a, b) => b.view_count - a.view_count);

    return NextResponse.json(pagesWithViewCount);
  } catch (error) {
    console.error("Error in popular pages API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
