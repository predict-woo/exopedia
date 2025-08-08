"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";

type QueueJob = {
  id: string;
  source_slug: string;
  target_slug: string;
  status: "queued" | "running" | "succeeded" | "failed";
  result_slug?: string | null;
  error_message?: string | null;
  created_at?: string;
  started_at?: string | null;
  finished_at?: string | null;
};

type QueueLog = {
  id: string;
  ts: string;
  level: "info" | "warn" | "error";
  phase?: string | null;
  tool_name?: string | null;
  message?: string | null;
  args_snip?: string | null;
  result_snip?: string | null;
};

type ApiResponse = {
  job: QueueJob;
  logs: QueueLog[];
};

export function QueueProgress({ queueId }: { queueId: string }) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    let isCancelled = false;

    const fetchStatus = async () => {
      try {
        const res = await fetch(`/api/queue/${queueId}`, { cache: "no-store" });
        if (!res.ok) {
          throw new Error(`Failed to fetch queue status: ${res.status}`);
        }
        const json = (await res.json()) as ApiResponse;
        if (!isCancelled) {
          setData(json);
          setError(null);
        }
      } catch (e) {
        if (!isCancelled) {
          setError((e as Error).message);
        }
      }
    };

    void fetchStatus();
    timerRef.current = window.setInterval(fetchStatus, 1500);
    return () => {
      isCancelled = true;
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [queueId]);

  // Auto-redirect when succeeded
  useEffect(() => {
    if (data?.job.status === "succeeded" && data.job.result_slug) {
      window.location.href = `/wiki/${data.job.result_slug}`;
    }
  }, [data]);

  const statusBadge = useMemo(() => {
    const s = data?.job.status;
    if (s === "succeeded") return <span className="text-green-600">완료</span>;
    if (s === "failed") return <span className="text-red-600">실패</span>;
    if (s === "running") return <span className="text-blue-600">실행 중</span>;
    return <span className="text-muted-foreground">대기 중</span>;
  }, [data?.job.status]);

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">페이지 생성 대기열</h2>
              {data?.job && (
                <p className="text-sm text-muted-foreground mt-1">
                  {data.job.source_slug} → {data.job.target_slug}
                </p>
              )}
            </div>
            <div className="text-sm">상태: {statusBadge}</div>
          </div>

          {error && <div className="mt-4 text-sm text-red-600">{error}</div>}

          <div className="mt-6 max-h-[420px] overflow-auto rounded border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted">
                  <th className="text-left p-2 w-44">시간</th>
                  <th className="text-left p-2 w-16">레벨</th>
                  <th className="text-left p-2 w-32">단계</th>
                  <th className="text-left p-2 w-40">툴</th>
                  <th className="text-left p-2">메시지 / 인자 / 결과</th>
                </tr>
              </thead>
              <tbody>
                {data?.logs?.length ? (
                  data.logs.map((log) => (
                    <tr key={log.id} className="border-t align-top">
                      <td className="p-2 whitespace-nowrap">
                        {new Date(log.ts).toLocaleTimeString("ko-KR")}
                      </td>
                      <td className="p-2">
                        {log.level === "error" ? (
                          <span className="text-red-600">error</span>
                        ) : log.level === "warn" ? (
                          <span className="text-yellow-600">warn</span>
                        ) : (
                          <span className="text-muted-foreground">info</span>
                        )}
                      </td>
                      <td className="p-2 text-muted-foreground">
                        {log.phase || "-"}
                      </td>
                      <td className="p-2 text-muted-foreground">
                        {log.tool_name || "-"}
                      </td>
                      <td className="p-2">
                        <div className="text-foreground">
                          {log.message || ""}
                        </div>
                        {(log.args_snip || log.result_snip) && (
                          <pre className="mt-1 text-xs text-muted-foreground whitespace-pre-wrap">
                            {log.args_snip ? `args: ${log.args_snip}\n` : ""}
                            {log.result_snip
                              ? `result: ${log.result_snip}`
                              : ""}
                          </pre>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="p-4" colSpan={5}>
                      <div className="text-center text-muted-foreground">
                        로그를 불러오는 중이거나 로그가 아직 없습니다.
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {data?.job.status === "failed" && data.job.error_message && (
            <div className="mt-4 text-sm text-red-600">
              {data.job.error_message}
            </div>
          )}

          <div className="mt-6 text-sm text-muted-foreground">
            이 페이지를 떠나도 생성은 계속됩니다. 완료 시 자동으로 새 문서로
            이동합니다.
          </div>

          {data?.job.result_slug && (
            <div className="mt-4">
              <Link
                className="underline"
                href={`/wiki/${data.job.result_slug}`}
              >
                생성된 문서로 이동
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
