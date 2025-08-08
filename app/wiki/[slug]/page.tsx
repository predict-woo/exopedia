import { WikiPageViewer } from "@/components/wiki-page-viewer";

interface WikiPageProps {
  params: Promise<{
    slug: string;
  }>;
}

async function getWikiPage(slug: string) {
  try {
    const response = await fetch(
      `${
        process.env.NEXT_PUBLIC_URL || "http://localhost:3000"
      }/api/wiki/${slug}`,
      { cache: "no-store" }
    );

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error("Failed to fetch page");
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching wiki page:", error);
    return null;
  }
}

export async function generateMetadata({ params }: WikiPageProps) {
  const { slug } = await params;
  const page = await getWikiPage(slug);

  if (!page) {
    return {
      title: "페이지를 찾을 수 없습니다 - 엑소피디아",
    };
  }

  return {
    title: `${page.title} - 엑소피디아`,
    description: page.summary || `3025년의 ${page.title}에 대해 알아보세요.`,
  };
}

export default async function WikiPage({ params }: WikiPageProps) {
  const { slug } = await params;
  const page = await getWikiPage(slug);

  if (!page) {
    // If page doesn't exist, show creation prompt
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-2xl w-full text-center">
          <h1 className="text-4xl font-bold mb-4">
            페이지가 존재하지 않습니다
          </h1>
          <p className="text-lg text-muted-foreground mb-8">
            &quot;{slug}&quot;; 문서는 아직 생성되지 않았습니다.
          </p>
          <p className="text-sm text-muted-foreground">
            다른 문서에서 이 주제로 연결되는 링크를 클릭하면 자동으로
            생성됩니다.
          </p>
        </div>
      </div>
    );
  }

  return <WikiPageViewer page={page} />;
}
