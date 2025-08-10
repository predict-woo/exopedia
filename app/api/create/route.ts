import { NextRequest, NextResponse, after } from "next/server";
import { FunctionCallingConfigMode, FunctionDeclaration } from "@google/genai";
import { createClient } from "@/lib/supabase/server";
import {
  getGeminiClient,
  getFunctionDeclarations,
  searchPageIndex,
  batchResolvePageIndex,
  searchContentIndex,
  getPage,
  persistNewPage,
  persistPageUpdate,
} from "@/lib/gemini/client";
import {
  createOrGetQueueJob,
  updateQueueStatus,
  appendCreationLog,
} from "@/lib/queue";

const RULES = `
**I. 집필 원칙**
1.  **시점:** 모든 내용은 3025년의 관점에서 과거형으로 서술합니다.
2.  **언어:** 모든 내용은 한국어로 작성합니다.
3.  **일관성:** 기존에 설정된 모든 문서와 내용적 일관성을 유지합니다.
4.  **확장성:** 위키의 끊임없는 확장을 위해 새롭게 생성된 문서는 반드시 조사한 내용 외의 새로운 내용과, 빨간 링크 (create/) 를 포함하고 있어야 합니다.
**II. 우주와 물리 법칙**
1.  **기반 법칙:** 현재의 물리 법칙을 기반으로 하며, 논리적으로 예측 가능한 미래를 상상합니다.
2.  **열역학 법칙:** 열역학 법칙은 절대적이며, 어떤 기술로도 위반할 수 없습니다.
3.  **에너지 보존 법칙:** 에너지는 보존됩니다. 무(無)에서 새로운 물질이나 에너지를 생성하는 것은 불가능하며, 이는 사용 불가능한 것으로 증명된 영점 에너지를 포함합니다.
4.  **광속의 한계:** 빛보다 빠르거나 같은 속도의 이동은 인과율을 파괴하므로 절대 불가능합니다. (알큐비에르 드라이브와 같은 초광속 항법은 존재할 수 없습니다.)
5.  **정보 전달의 한계:** 정보 역시 빛의 속도보다 빠르게 전달될 수 없으며, 이는 항성계 간 통신에 상당한 지연을 발생시킵니다.
6.  **우주의 팽창:** 우주는 계속해서 팽창합니다.
**III. 기술과 사회 기반**
1.  **기술의 불완전성:** 기술은 시간이 지남에 따라 노후화되고 고장 나며, 최첨단 기술과 낙후된 구식 기술이 사회에 공존합니다.
2.  **자원과 경제:** 에너지 보존 법칙에 따라, 에너지의 효율적인 확보와 저장이 경제의 핵심이 됩니다. 또한 우주 개척으로 인해 특정 자원의 가치는 지구 시대와 크게 달라질 수 있습니다.
**IV. 인간과 문명**
1.  **인간의 본성:** 인간은 기본적으로 이기적인 존재입니다.
2.  **정치 체제:** 인류는 단일 정부를 이루지 못합니다.
3.  **문화의 분절:** 통신 지연으로 인해 각 식민지는 고립되어 독자적인 문화, 기술, 가치관을 발전시키며, 이는 중앙과의 격차 및 갈등의 원인이 됩니다.
**V. 생명과 환경**
1.  **외계 생명체:** 우주에 높은 지능을 가진 외계 문명은 존재하지 않습니다. 단, 단세포 생물이나 식물과 같은 단순한 형태의 생명체는 존재할 수 있습니다.
2.  **느린 테라포밍:** 열역학 법칙의 한계로 인해 다른 행성을 지구처럼 만드는 테라포밍은 매우 느리며, 대부분의 인류는 돔이나 지하 도시 같은 인공 환경에 의존하여 살아갑니다.
`;

// Helper to get client IP
function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0] : "127.0.0.1";
  return ip;
}

// Debug logging (dev only or when GEMINI_DEBUG_LOG=true)
const shouldDebugLog =
  process.env.NODE_ENV === "development" ||
  process.env.GEMINI_DEBUG_LOG === "true";

function debugLog(...args: unknown[]) {
  if (shouldDebugLog) {
    // Prefix to make grepping logs easier
    console.log("[CREATE]", ...args);
  }
}

function snip(text: unknown, limit = 400): string {
  if (typeof text !== "string") return String(text);
  if (text.length <= limit) return text;
  return `${text.slice(0, limit)}...`;
}

function safeJson(value: unknown, limit = 800): string {
  try {
    const s = JSON.stringify(value);
    if (s.length > limit) return `${s.slice(0, limit)}...`;
    return s;
  } catch {
    return String(value);
  }
}

async function runGeminiSession(params: {
  mode: "existing" | "new";
  sourceSlug: string;
  targetSlug: string;
  linkText: string;
  localContext: string;
  sourceMarkdown: string;
  sourceTitle: string;
  existingSlug?: string;
  queueId?: string;
}) {
  const ai = getGeminiClient();
  const {
    mode,
    sourceSlug,
    targetSlug,
    linkText,
    localContext,
    sourceMarkdown,
    sourceTitle,
  } = params;

  const systemPrompt =
    mode === "existing"
      ? `당신은 3025년의 관점에서 위키 문서를 작성/편집하는 AI입니다. 분기 A(기존 문서 존재)만 수행하세요.

규칙:
${RULES}

현재 작업:
- 소스 문서: "${sourceTitle}" (${sourceSlug})
- 클릭된 링크 텍스트: "${linkText}" (${targetSlug})
- 링크 주변 컨텍스트: ${localContext}
- 동일/유사 주제의 기존 문서 slug: ${params.existingSlug}

작업 순서(분기 A 전용):
1. get_page로 기존 문서를 읽습니다
2. 소스 문서의 빨간 링크(/create/${targetSlug})를 파란 링크(/wiki/${params.existingSlug})로 교체하고, 링크가 위치한 문단이나 인접 문단 범위에서만 소규모 보강/정정을 합니다. 대규모 구조 변경 금지
3. persist_page_update로 저장하고 종료
반드시 신규 생성(persist_new_page)은 금지합니다.`
      : `당신은 3025년의 관점에서 위키 문서를 작성하는 AI입니다. 분기 B(신규 생성)만 수행하세요.

규칙:
${RULES}

현재 작업:
- 소스 문서: "${sourceTitle}" (${sourceSlug})
- 생성하려는 문서: "${linkText}" (${targetSlug})
- 링크 주변 컨텍스트: ${localContext}

작업 순서(분기 B 전용):
1. search_content_index(RAG)를 이용한 주제에 대한 사전조사, 최대 1번
2. 신규 문서 요약 및 본문 초안 생각
3. 초안의 각 부분에 대한 search_content_index(RAG), 1~3번까지 가능, 되도록이면 적게. 이후 검색된 정보를 활용한 수정본 생각
4. 생각한 수정본에서 추출할만한 링크가 무엇이 있을지 생각합니다.
5. 반드시 batch_resolve_page_index로 링크 존재 여부를 조회합니다. 각 후보에 대해 반환된 summary를 읽고, 제목 유사도에 의존하지 말고 요약 내용 기준으로 동일 주제라고 명확히 판단될 때에만 /wiki/{slug}로 연결하세요. 애매하거나 불확실하면 그대로 /create/{target-slug}를 유지합니다.
6. persist_new_page로 저장
7. 소스 문서의 빨간 링크를 방금 생성된 파란 링크(/wiki/{canonicalSlug})로 교체하고 필요한 최소 범위를 편집하여 persist_page_update로 저장
분기 A로 절대 진행하지 않습니다.
8. 모든 단계가 성공적으로 완료되면, finish_session 으로 세션 종료`;

  const tools: Array<{ functionDeclarations: FunctionDeclaration[] }> = [
    { functionDeclarations: getFunctionDeclarations() },
  ];

  const contents: Array<{
    role: "user" | "model";
    parts: Array<Record<string, unknown>>;
  }> = [
    {
      role: "user",
      parts: [
        {
          text:
            `소스 문서 전체 내용:\n\n${sourceMarkdown}\n\n` +
            (params.existingSlug
              ? `기존 문서 slug: ${params.existingSlug}\n`
              : `생성 대상: ${targetSlug}\n`) +
            `링크 클릭: "${linkText}" (${targetSlug})\n` +
            `링크 주변 컨텍스트: ${localContext}\n\n` +
            `위의 작업 순서에 따라 진행하세요.`,
        },
      ],
    },
  ];

  const logToQueue = async (
    level: "info" | "warn" | "error",
    phase: string,
    message: string,
    toolName?: string,
    args?: unknown,
    result?: unknown
  ) => {
    if (params.queueId) {
      await appendCreationLog({
        queueId: params.queueId,
        level,
        phase,
        toolName,
        message,
        argsSnip: args ? safeJson(args) : undefined,
        resultSnip: result ? safeJson(result) : undefined,
      });
    } else {
      debugLog(`[${phase}] ${message}`, {
        toolName,
        args: args,
        result: result,
      });
    }
  };

  await logToQueue(
    "info",
    "start",
    `Mode=${mode}`,
    undefined,
    { sourceSlug, targetSlug },
    undefined
  );

  for (let turn = 0; turn < 12; turn++) {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.7,
        tools,
        toolConfig: {
          functionCallingConfig: { mode: FunctionCallingConfigMode.ANY },
        },
        thinkingConfig: { includeThoughts: true },
      },
    });

    await logToQueue(
      "info",
      "model",
      "response",
      undefined,
      undefined,
      (response as { text?: string }).text ?? ""
    );

    const functionCalls = response.functionCalls || [];
    if (functionCalls.length === 0) break;

    for (const functionCall of functionCalls) {
      const name = functionCall.name;
      const args: Record<string, unknown> =
        (functionCall as { args?: Record<string, unknown> }).args || {};
      await logToQueue("info", "tool", "call", name, args, undefined);

      try {
        switch (name) {
          case "search_page_index": {
            const result = await searchPageIndex(
              String(args.query ?? ""),
              typeof args.topK === "number" ? args.topK : 5,
              typeof args.threshold === "number" ? args.threshold : 0.85
            );
            await logToQueue("info", "tool", "result", name, args, result);
            contents.push({ role: "model", parts: [{ functionCall }] });
            contents.push({
              role: "user",
              parts: [{ functionResponse: { name, response: { result } } }],
            });
            break;
          }
          case "batch_resolve_page_index": {
            const result = await batchResolvePageIndex(
              (args.candidates ?? []) as Array<{
                term: string;
                context?: string;
              }>,
              typeof args.topK === "number" ? args.topK : 1,
              typeof args.threshold === "number" ? args.threshold : 0.85
            );
            console.log(result);

            await logToQueue("info", "tool", "result", name, args, result);
            contents.push({ role: "model", parts: [{ functionCall }] });
            contents.push({
              role: "user",
              parts: [
                {
                  functionResponse: {
                    name,
                    response: {
                      result,
                      guidance:
                        "각 term의 상위 후보는 요약(summary)과 함께 제공됩니다. 제목이 유사하더라도 요약을 읽고 동일 주제인지 모델이 판단한 뒤에만 링크를 사용하세요.",
                    },
                  },
                },
              ],
            });
            break;
          }
          case "search_content_index": {
            const result = await searchContentIndex(
              String(args.query ?? ""),
              typeof args.topK === "number" ? args.topK : 10
            );
            await logToQueue("info", "tool", "result", name, args, result);
            contents.push({ role: "model", parts: [{ functionCall }] });
            contents.push({
              role: "user",
              parts: [{ functionResponse: { name, response: { result } } }],
            });
            break;
          }
          case "get_page": {
            const result = await getPage(String(args.slug ?? ""));
            await logToQueue("info", "tool", "result", name, args, result);
            contents.push({ role: "model", parts: [{ functionCall }] });
            contents.push({
              role: "user",
              parts: [{ functionResponse: { name, response: { result } } }],
            });
            break;
          }
          case "persist_new_page": {
            const result = await persistNewPage({
              title: String(args.title ?? params.linkText),
              proposedSlug: String(args.proposedSlug ?? params.targetSlug),
              summary: String(
                args.summary ?? `3025년의 ${params.linkText}에 대한 문서입니다.`
              ),
              markdown: String(
                args.markdown ??
                  `# ${params.linkText}\n\n이 문서는 3025년의 관점에서 ${params.linkText}에 대해 설명합니다.\n\n*이 문서는 자동 생성되었으며 추가 정보가 필요합니다.*`
              ),
            });
            await logToQueue("info", "tool", "result", name, args, result);
            contents.push({ role: "model", parts: [{ functionCall }] });
            contents.push({
              role: "user",
              parts: [{ functionResponse: { name, response: { result } } }],
            });
            // For queue use: capture success
            if (params.queueId) {
              await updateQueueStatus(params.queueId, "succeeded", {
                resultSlug: result.canonicalSlug,
                finished: true,
              });
            }
            break;
          }
          case "persist_page_update": {
            const result = await persistPageUpdate({
              slug: String(args.slug ?? params.sourceSlug),
              markdown: String(args.markdown ?? params.sourceMarkdown),
              summary:
                typeof args.summary === "string" ? args.summary : undefined,
            });
            await logToQueue("info", "tool", "result", name, args, result);
            contents.push({ role: "model", parts: [{ functionCall }] });
            contents.push({
              role: "user",
              parts: [{ functionResponse: { name, response: { result } } }],
            });
            break;
          }
          case "redirect_to_existing": {
            // Should not be used in background modes typically, but log and continue
            await logToQueue("info", "tool", "result", name, args, {
              accepted: true,
            });
            contents.push({ role: "model", parts: [{ functionCall }] });
            contents.push({
              role: "user",
              parts: [
                {
                  functionResponse: {
                    name,
                    response: { result: { accepted: true } },
                  },
                },
              ],
            });
            break;
          }
          case "finish_session": {
            await logToQueue("info", "tool", "finish", name, args, {
              ok: true,
            });
            // Send back function response and break entire loop by returning early
            contents.push({ role: "model", parts: [{ functionCall }] });
            contents.push({
              role: "user",
              parts: [{ functionResponse: { name, response: { ok: true } } }],
            });
            // Force loop termination by setting turn to max
            return;
          }
          default: {
            contents.push({ role: "model", parts: [{ functionCall }] });
            contents.push({
              role: "user",
              parts: [
                { functionResponse: { name, response: { result: null } } },
              ],
            });
            await logToQueue("warn", "tool", "unknown", name, args, undefined);
          }
        }
      } catch (error) {
        contents.push({ role: "model", parts: [{ functionCall }] });
        contents.push({
          role: "user",
          parts: [
            { functionResponse: { name, response: { error: String(error) } } },
          ],
        });
        await logToQueue(
          "error",
          "tool",
          "exception",
          name,
          args,
          String(error)
        );
        if (params.queueId) {
          await updateQueueStatus(params.queueId, "failed", {
            errorMessage: String(error),
            finished: true,
          });
        }
      }
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sourceSlug, targetSlug } = body;

    if (!sourceSlug || !targetSlug) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Rate limiting check
    const clientIp = getClientIp(request);
    const { data: rateLimitOk } = await supabase.rpc("check_rate_limit", {
      p_ip_address: clientIp,
      p_endpoint: "/api/create",
      p_max_requests: 10,
      p_window_minutes: 5,
    });

    if (!rateLimitOk) {
      return NextResponse.json(
        { error: "너무 많은 요청입니다. 잠시 후 다시 시도해주세요." },
        { status: 429 }
      );
    }

    // Fetch source page
    const sourcePageData = await getPage(sourceSlug);
    if (!sourcePageData) {
      return NextResponse.json(
        { error: "Source page not found" },
        { status: 404 }
      );
    }

    debugLog("Request", { sourceSlug, targetSlug });

    // Verify the red link exists in the source markdown
    const createLinkPattern = new RegExp(
      `\\[([^\\]]+)\\]\\(/create/${targetSlug}\\)`
    );
    const match = sourcePageData.markdown.match(createLinkPattern);

    if (!match) {
      return NextResponse.json(
        { error: "Link not found in source page" },
        { status: 400 }
      );
    }

    // Extract context around the link (10 words before and after)
    const linkText = match[1];
    const linkIndex = sourcePageData.markdown.indexOf(match[0]);
    const beforeText = sourcePageData.markdown.substring(
      Math.max(0, linkIndex - 100),
      linkIndex
    );
    const afterText = sourcePageData.markdown.substring(
      linkIndex + match[0].length,
      linkIndex + match[0].length + 100
    );
    const localContext = `${beforeText}[${linkText}]${afterText}`;
    debugLog("Link", { linkText, localContext: snip(localContext, 200) });

    // Initialize Gemini with function calling
    const ai = getGeminiClient();

    // (Background session will rebuild its own conversation internally.)

    const tools: Array<{ functionDeclarations: FunctionDeclaration[] }> = [
      {
        functionDeclarations: getFunctionDeclarations(),
      },
    ];
    debugLog(
      "Declared tools",
      tools[0].functionDeclarations.map((f) => f.name)
    );

    // FAST-FIRST-TURN: decide A/B. We run title-based page search ourselves and let the model choose between two tools.
    // 1) Run page index search on server (not via tool) so the model isn't forced to call any search function
    console.log(linkText);
    const fastSearch = await searchPageIndex(linkText, 5, 0.7);

    // Prepare compact candidates including summaries
    const candidatesForDecision = (fastSearch.matches || []).map(
      (m: {
        slug: string;
        title: string;
        score: number;
        summary?: string | null;
      }) => ({
        slug: m.slug,
        title: m.title,
        score: m.score,
        summary: snip(m.summary ?? "", 400),
      })
    );

    console.log(candidatesForDecision);

    // Limit tools to just decision tools
    const fastToolDecls = getFunctionDeclarations().filter(
      (d) =>
        d.name === "redirect_to_existing" || d.name === "declare_no_existing"
    );

    const fastDecision = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              text:
                `링크 텍스트: "${linkText}" (${targetSlug})\n` +
                `링크 주변 컨텍스트: ${snip(localContext, 500)}\n\n` +
                `다음은 제목 임베딩 검색 결과 상위 후보입니다(서버 제공):\n` +
                `${JSON.stringify(candidatesForDecision)}\n\n` +
                `작업: 동일 주제의 기존 문서 존재 여부를 결정하세요. 존재한다고 판단되면 redirect_to_existing(slug)를 호출하고, 없다면 declare_no_existing()을 호출하세요. 생성 관련 함수는 절대 호출하지 마세요.`,
            },
          ],
        },
      ],
      config: {
        systemInstruction:
          `당신은 제공된 후보들의 요약과 점수를 바탕으로 링크의 주제와 동일한 문서가 있는지 판단합니다.\n` +
          `후보중 일치하는 후보가 존재한다고 판단되면 redirect_to_existing(slug)를 호출하고, 아니라면 declare_no_existing()을 호출하세요.\n` +
          `절대 다른 도구는 호출하지 마세요.\n\n` +
          `아래는 판단 예시입니다.\n\n` +
          `예시)\n\n` +
          `링크 텍스트: 광속장벽\n` +
          `검색된 페이지: 제목: 빛의 속도 한계 — 요약: ‘광속 장벽’과 동일 개념. 물질과 정보가 c를 넘을 수 없다는 사실이 정치·경제·문화에 미친 영향까지 요약.\n` +
          `-> 이름만 다른 경우임으로 일치\n\n` +
          `링크 텍스트: 돔 도시\n` +
          `검색된 페이지: 제목: 화성 독립 도시국가 - 요약:  '화성 독립 도시국가는 수백 년에 걸친 테라포밍 노력에도 불구하고 혹독한 환경에 적응하여 독자적인 문화와 기술을 발전시킨 화성 정착민들이 건설한 자치 공동체들을 일컫습니다. 이들은 지구의 통제에서 벗어나고자 했던 화성 독립 전쟁 이후 더욱 확고한 독립 노선을 걸었으며, 거대한 돔 도시나 지하 도시에 의존하여 삶을 영위했습니다.\n` +
          `-> 화성 독립 도시국가는 돔도시를 포함하는 내용이기에 불일치` +
          `링크 텍스트: 세대 항해선\n` +
          `검색된 페이지: 제목: 세대 항해선 — 요약: 수 세대에 걸쳐 항해하는 우주선의 설계, 사회 구조, 항해 전략을 다룸.\n` +
          `-> 동일 주제이므로 일치\n\n` +
          `링크 텍스트: 알파 센타우리 상호연대\n` +
          `검색된 페이지: 제목: 알파 센타우리 | 상호연대 — 요약: 알파 센타우리 식민지 연대체의 정치·사회 제도와 태양계와의 데이터 교환 구조.\n` +
          `-> 표기만 다르므로 일치\n\n` +
          `링크 텍스트: 헬륨-3 채굴\n` +
          `검색된 페이지: 제목: 에너지 경제학 — 요약: 에너지 생산·저장·효율 전반을 다루는 상위 개념(헬륨‑3 채굴은 하위 항목).\n` +
          `-> 포함 관계이지만 동일 주제가 아니므로 불일치\n\n` +
          `링크 텍스트: 저속 데이터 패킷 교환\n` +
          `검색된 페이지: 제목: 느린 패킷 데이터 교환 — 요약: 항성간 통신에서의 저속·대용량 데이터 전송 프로토콜.\n` +
          `-> 동의어 관계이므로 일치\n\n` +
          `링크 텍스트: 유로파 해저 도시\n` +
          `검색된 페이지: 제목: 유로파의 해저 도시 — 요약: 유로파 빙하 아래 인프라와 사회 구조를 설명.\n` +
          `-> 지칭만 다르므로 일치\n\n` +
          `링크 텍스트: 금성 부유 도시\n` +
          `검색된 페이지: 제목: 금성 기업령 — 요약: 금성 상층 대기 도시를 지배하는 기업 통치 체제(부유 도시는 하위 요소).\n` +
          `-> 상위/하위 포괄 관계이므로 불일치\n\n` +
          `링크 텍스트: 목성권 연맹\n` +
          `검색된 페이지: 제목: 목성권 공화국 연맹 — 요약: 목성권 소규모 공화국들의 연합체.\n` +
          `-> 약칭/정식명 차이이므로 일치\n\n` +
          `링크 텍스트: 타이탄 개척자\n` +
          `검색된 페이지: 제목: 타이탄과 그 너머의 개척자 — 요약: 타이탄뿐 아니라 외태양계 전반의 개척 흐름을 포괄.\n` +
          `-> 링크는 더 좁고 페이지는 더 넓은 범위를 포괄하므로 불일치`,
        tools: [{ functionDeclarations: fastToolDecls }],
        toolConfig: {
          functionCallingConfig: { mode: FunctionCallingConfigMode.AUTO },
        },
        thinkingConfig: { includeThoughts: true },
        temperature: 0.3,
      },
    });

    let existingSlug: string | null = null;
    for (const fc of fastDecision.functionCalls || []) {
      if (fc.name === "redirect_to_existing") {
        existingSlug = String(
          (fc as { args?: Record<string, unknown> }).args?.slug ?? existingSlug
        );
      }
      if (fc.name === "declare_no_existing") {
        existingSlug = null;
      }
    }

    console.log(existingSlug);

    // Create or get queue job for background
    const job = await createOrGetQueueJob({
      sourceSlug,
      targetSlug,
    });
    const queueId = job.id;
    const existingStatus = job.status;
    const resultSlug = job.resultSlug;
    const wasCreated = (job as { wasCreated?: boolean }).wasCreated === true;

    // Minimal dedupe logic: if job already in progress or done, do not schedule a new background run
    if (existingStatus === "succeeded" && resultSlug) {
      return NextResponse.json({ redirect: `/wiki/${resultSlug}` });
    }
    if (
      (existingStatus === "queued" || existingStatus === "running") &&
      !wasCreated
    ) {
      return NextResponse.json({ redirect: `/queue/${queueId}` });
    }

    if (existingSlug) {
      // Immediate redirect to existing page; background task edits source page
      if (wasCreated) {
        after(async () => {
          try {
            await updateQueueStatus(queueId, "running", { started: true });
            await appendCreationLog({
              queueId,
              level: "info",
              phase: "background",
              message: "start existing-branch",
            });
            await runGeminiSession({
              mode: "existing",
              sourceSlug,
              targetSlug,
              linkText,
              localContext,
              sourceMarkdown: sourcePageData.markdown,
              sourceTitle: sourcePageData.title,
              existingSlug,
              queueId,
            });
            await updateQueueStatus(queueId, "succeeded", {
              resultSlug: existingSlug,
              finished: true,
            });
          } catch (e) {
            await updateQueueStatus(queueId, "failed", {
              errorMessage: String(e),
              finished: true,
            });
          }
        });
      }
      return NextResponse.json({ redirect: `/wiki/${existingSlug}` });
    }

    // No existing page: redirect user to queue page and create in background
    if (wasCreated) {
      after(async () => {
        try {
          await updateQueueStatus(queueId, "running", { started: true });
          await appendCreationLog({
            queueId,
            level: "info",
            phase: "background",
            message: "start new-branch",
          });
          await runGeminiSession({
            mode: "new",
            sourceSlug,
            targetSlug,
            linkText,
            localContext,
            sourceMarkdown: sourcePageData.markdown,
            sourceTitle: sourcePageData.title,
            queueId,
          });
        } catch (e) {
          await updateQueueStatus(queueId, "failed", {
            errorMessage: String(e),
            finished: true,
          });
        }
      });
    }

    // Tell client to go to queue UI for live logs/progress
    return NextResponse.json({ redirect: `/queue/${queueId}` });
  } catch (error) {
    console.error("Error in create API:", error);
    return NextResponse.json(
      { error: "문서 생성 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}

export const maxDuration = 300;
