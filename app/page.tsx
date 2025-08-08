import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Clock, TrendingUp, Sparkles, Globe } from "lucide-react";
import { ThemeSwitcher } from "@/components/theme-switcher";

type RecentPage = {
  id: number;
  slug: string;
  title: string;
  created_at: string;
};

type PopularPage = {
  id: number;
  slug: string;
  title: string;
  view_count: number;
};

async function getRecentPages(): Promise<RecentPage[]> {
  try {
    const response = await fetch(
      `${
        process.env.NEXT_PUBLIC_URL || "http://localhost:3000"
      }/api/homepage/recent`,
      {
        cache: "no-store",
      }
    );
    if (response.ok) {
      return (await response.json()) as RecentPage[];
    }
  } catch (error) {
    console.error("Failed to fetch recent pages:", error);
  }
  return [];
}

async function getPopularPages(): Promise<PopularPage[]> {
  try {
    const response = await fetch(
      `${
        process.env.NEXT_PUBLIC_URL || "http://localhost:3000"
      }/api/homepage/popular`,
      {
        cache: "no-store",
      }
    );
    if (response.ok) {
      return (await response.json()) as PopularPage[];
    }
  } catch (error) {
    console.error("Failed to fetch popular pages:", error);
  }
  return [];
}

export default async function HomePage() {
  const [recentPages, popularPages] = await Promise.all([
    getRecentPages(),
    getPopularPages(),
  ]);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center space-x-2">
              <Globe className="h-8 w-8 text-primary" />
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  엑소피디아
                </h1>
                <p className="text-xs text-muted-foreground">
                  3025년의 미래 백과사전
                </p>
              </div>
            </Link>
            <div className="flex items-center gap-4">
              <ThemeSwitcher />
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 px-4 text-center bg-gradient-to-b from-background to-muted/20">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-5xl font-bold mb-6 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
            3025년의 세계를 탐험하세요
          </h2>
          <p className="text-xl text-muted-foreground mb-8">
            천 년 후의 미래, 인류가 이룩한 놀라운 문명과 기술의 세계.
            <br />
            AI가 실시간으로 생성하는 살아있는 지식의 우주로 여러분을 초대합니다.
          </p>
          <div className="flex gap-4 justify-center">
            <Link href="/wiki/main">
              <Button size="lg" className="gap-2">
                <Sparkles className="h-5 w-5" />
                탐험 시작하기
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Content Grid */}
      <main className="flex-1 py-12 px-4">
        <div className="container mx-auto max-w-7xl">
          <div className="grid md:grid-cols-2 gap-8">
            {/* Recent Pages */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  최근 생성된 문서
                </CardTitle>
                <CardDescription>방금 탄생한 미래의 이야기들</CardDescription>
              </CardHeader>
              <CardContent>
                {recentPages.length > 0 ? (
                  <ul className="space-y-3">
                    {recentPages.map((page) => (
                      <li key={page.slug}>
                        <Link
                          href={`/wiki/${page.slug}`}
                          className="block p-3 rounded-lg hover:bg-muted transition-colors"
                        >
                          <div className="font-medium text-foreground">
                            {page.title}
                          </div>
                          {page.created_at && (
                            <div className="text-sm text-muted-foreground mt-1">
                              {new Date(page.created_at).toLocaleString(
                                "ko-KR"
                              )}
                            </div>
                          )}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>아직 생성된 문서가 없습니다.</p>
                    <p className="text-sm mt-2">첫 번째 탐험가가 되어보세요!</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Popular Pages */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  인기 문서
                </CardTitle>
                <CardDescription>
                  많은 사람들이 관심을 갖는 미래
                </CardDescription>
              </CardHeader>
              <CardContent>
                {popularPages.length > 0 ? (
                  <ul className="space-y-3">
                    {popularPages.map((page) => (
                      <li key={page.slug}>
                        <Link
                          href={`/wiki/${page.slug}`}
                          className="block p-3 rounded-lg hover:bg-muted transition-colors"
                        >
                          <div className="font-medium text-foreground">
                            {page.title}
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">
                            조회수: {page.view_count}회
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>아직 인기 문서가 없습니다.</p>
                    <p className="text-sm mt-2">탐험을 시작해보세요!</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Explanation Section */}
          <Card className="mt-12">
            <CardHeader>
              <CardTitle>엑소피디아란?</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none">
              <p>
                엑소피디아는 3025년의 관점에서 작성된 미래 백과사전입니다. 모든
                문서는 AI에 의해 실시간으로 생성되며, 서로 유기적으로 연결되어
                일관된 미래 세계관을 구축합니다.
              </p>
              <div className="grid md:grid-cols-3 gap-4 mt-6">
                <div className="text-center">
                  <div className="text-2xl mb-2">🚀</div>
                  <h3 className="font-semibold mb-1">우주 개척</h3>
                  <p className="text-sm text-muted-foreground">
                    태양계를 넘어선 인류의 여정
                  </p>
                </div>
                <div className="text-center">
                  <div className="text-2xl mb-2">🧬</div>
                  <h3 className="font-semibold mb-1">생명 공학</h3>
                  <p className="text-sm text-muted-foreground">
                    진화를 넘어선 생명의 재창조
                  </p>
                </div>
                <div className="text-center">
                  <div className="text-2xl mb-2">🤖</div>
                  <h3 className="font-semibold mb-1">AI 문명</h3>
                  <p className="text-sm text-muted-foreground">
                    인간과 AI의 공존과 협력
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t py-8 px-4">
        <div className="container mx-auto text-center text-sm text-muted-foreground">
          <p>© 3025 엑소피디아. 모든 미래는 탐험을 통해 창조됩니다.</p>
        </div>
      </footer>
    </div>
  );
}
