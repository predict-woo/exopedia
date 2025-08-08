"use client";

import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Home, Flag, Calendar, Eye, Loader2, Globe } from "lucide-react";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { ReportDialog } from "@/components/report-dialog";

interface WikiPageViewerProps {
  page: {
    id: number;
    slug: string;
    title: string;
    markdown: string;
    summary?: string;
    created_at: string;
    updated_at: string;
    view_count?: number;
  };
}

export function WikiPageViewer({ page }: WikiPageViewerProps) {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [creatingLink, setCreatingLink] = useState<string | null>(null);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);

  const handleCreateLink = async (targetSlug: string) => {
    setIsCreating(true);
    setCreatingLink(targetSlug);

    try {
      const response = await fetch("/api/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sourceSlug: page.slug,
          targetSlug: targetSlug,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        if (data.redirect) {
          // Redirect to existing page
          router.push(data.redirect);
        } else if (data.slug) {
          // Navigate to newly created page
          router.push(`/wiki/${data.slug}`);
        }
      } else {
        console.error("Failed to create page:", data.error);
        alert(data.error || "페이지 생성에 실패했습니다.");
      }
    } catch (error) {
      console.error("Error creating page:", error);
      alert("페이지 생성 중 오류가 발생했습니다.");
    } finally {
      setIsCreating(false);
      setCreatingLink(null);
    }
  };

  const customRenderers: Components = {
    a: ({ href, children, ...props }) => {
      // Handle different link types
      if (!href) return <span>{children}</span>;

      // External links
      if (href.startsWith("http://") || href.startsWith("https://")) {
        return (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 dark:text-blue-400 hover:underline"
            {...props}
          >
            {children}
          </a>
        );
      }

      // Blue links (existing pages)
      if (href.startsWith("/wiki/")) {
        return (
          <Link
            href={href}
            className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
            {...props}
          >
            {children}
          </Link>
        );
      }

      // Red links (pages to create)
      if (href.startsWith("/create/")) {
        const targetSlug = href.replace("/create/", "");
        const isThisLink = creatingLink === targetSlug;

        return (
          <button
            onClick={() => handleCreateLink(targetSlug)}
            disabled={isCreating}
            className={`text-red-600 dark:text-red-400 hover:underline font-medium disabled:opacity-50 disabled:cursor-not-allowed ${
              isThisLink ? "animate-pulse" : ""
            }`}
          >
            {children}
            {isThisLink && (
              <Loader2 className="inline ml-1 h-3 w-3 animate-spin" />
            )}
          </button>
        );
      }

      // Default link handling
      return (
        <Link href={href} {...props}>
          {children}
        </Link>
      );
    },
    h1: ({ children, ...props }) => (
      <h1 className="text-4xl font-bold mt-8 mb-4 text-foreground" {...props}>
        {children}
      </h1>
    ),
    h2: ({ children, ...props }) => (
      <h2
        className="text-3xl font-semibold mt-6 mb-3 text-foreground"
        {...props}
      >
        {children}
      </h2>
    ),
    h3: ({ children, ...props }) => (
      <h3
        className="text-2xl font-semibold mt-4 mb-2 text-foreground"
        {...props}
      >
        {children}
      </h3>
    ),
    p: ({ children, ...props }) => (
      <p className="mb-4 leading-relaxed text-foreground/90" {...props}>
        {children}
      </p>
    ),
    ul: ({ children, ...props }) => (
      <ul className="list-disc list-inside mb-4 space-y-1" {...props}>
        {children}
      </ul>
    ),
    ol: ({ children, ...props }) => (
      <ol className="list-decimal list-inside mb-4 space-y-1" {...props}>
        {children}
      </ol>
    ),
    blockquote: ({ children, ...props }) => (
      <blockquote
        className="border-l-4 border-primary/50 pl-4 my-4 italic text-muted-foreground"
        {...props}
      >
        {children}
      </blockquote>
    ),
    code: ({ children, className, ...props }) => {
      const text = Array.isArray(children)
        ? children.join("")
        : String(children ?? "");
      const isBlock = /language-/.test(className ?? "") || text.includes("\n");
      if (!isBlock) {
        return (
          <code
            className="px-1.5 py-0.5 rounded bg-muted text-sm font-mono"
            {...props}
          >
            {children}
          </code>
        );
      }
      return (
        <code
          className="block p-4 rounded-lg bg-muted font-mono text-sm overflow-x-auto"
          {...props}
        >
          {children}
        </code>
      );
    },
    table: ({ children, ...props }) => (
      <div className="overflow-x-auto mb-4">
        <table className="min-w-full border-collapse" {...props}>
          {children}
        </table>
      </div>
    ),
    th: ({ children, ...props }) => (
      <th
        className="border border-border px-4 py-2 bg-muted font-semibold text-left"
        {...props}
      >
        {children}
      </th>
    ),
    td: ({ children, ...props }) => (
      <td className="border border-border px-4 py-2" {...props}>
        {children}
      </td>
    ),
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link href="/" className="flex items-center space-x-2">
                <Globe className="h-6 w-6 text-primary" />
                <span className="font-bold text-lg">엑소피디아</span>
              </Link>
              <span className="text-muted-foreground">/</span>
              <span className="text-sm font-medium truncate max-w-[200px] md:max-w-none">
                {page.title}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/">
                <Button variant="ghost" size="icon">
                  <Home className="h-4 w-4" />
                </Button>
              </Link>
              <ThemeSwitcher />
            </div>
          </div>
        </div>
      </header>

      {/* Creating Overlay */}
      {isCreating && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center">
          <Card className="max-w-md w-full mx-4">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center space-y-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <div>
                  <p className="font-semibold">
                    새로운 문서를 생성하고 있습니다...
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    3025년의 미래를 구성하는 중입니다
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 container mx-auto px-4 py-8 max-w-4xl">
        <article className="prose prose-lg dark:prose-invert max-w-none">
          <h1 className="text-5xl font-bold mb-6 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            {page.title}
          </h1>

          {/* Metadata */}
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mb-8 not-prose">
            <span className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              생성: {new Date(page.created_at).toLocaleDateString("ko-KR")}
            </span>
            {page.updated_at !== page.created_at && (
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                수정: {new Date(page.updated_at).toLocaleDateString("ko-KR")}
              </span>
            )}
            {page.view_count !== undefined && (
              <span className="flex items-center gap-1">
                <Eye className="h-4 w-4" />
                조회: {page.view_count}회
              </span>
            )}
          </div>

          {/* Summary Box */}
          {page.summary && (
            <Card className="mb-8 bg-muted/50">
              <CardContent className="pt-6">
                <p className="text-sm leading-relaxed">{page.summary}</p>
              </CardContent>
            </Card>
          )}

          {/* Markdown Content */}
          {(() => {
            // Normalize invisible characters globally that can break markdown emphasis parsing
            const normalizedMarkdown = page.markdown
              .replace(/\uFEFF/g, "") // BOM anywhere
              .replace(/[\u200B-\u200D\u2060\u200E\u200F]/g, "") // zero-widths & dir marks
              .replace(/\r\n/g, "\n"); // normalize newlines

            return (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={customRenderers}
              >
                {normalizedMarkdown}
              </ReactMarkdown>
            );
          })()}
        </article>

        {/* Report Button */}
        <div className="mt-12 pt-8 border-t">
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setReportDialogOpen(true)}
              className="gap-2"
            >
              <Flag className="h-4 w-4" />
              문서 신고
            </Button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t py-6 px-4">
        <div className="container mx-auto text-center text-sm text-muted-foreground">
          <p>© 3025 엑소피디아. 이 문서는 AI에 의해 자동 생성되었습니다.</p>
        </div>
      </footer>

      {/* Report Dialog */}
      <ReportDialog
        open={reportDialogOpen}
        onOpenChange={setReportDialogOpen}
        pageId={page.id}
        pageTitle={page.title}
      />
    </div>
  );
}
