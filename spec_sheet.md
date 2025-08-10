### **엑소피디아 (Exopedia) - 최종 기술 명세서**


### **1. 프로젝트 개요**

**엑소피디아**는 3025년의 시점에서 LLM에 의해 실시간으로 생성되는 가상의 미래 위키입니다. 사용자는 편집 권한 없이, 생성된 문서들을 탐험하며 끊임없이 확장되는 **한국어** 세계관을 경험하게 됩니다. 모든 문서는 논리적 일관성을 유지하며 유기적으로 연결되는 것을 목표로 합니다.



* **핵심 철학**:
    * **관찰자로서의 사용자**: 사용자는 역사를 읽는 관찰자이며, 직접 역사를 만들 수는 없습니다.
    * **살아있는 문서**: 위키는 고정되어 있지 않으며, 사용자의 탐험을 통해 스스로 성장하고 확장됩니다.
    * **일관된 세계관**: 모든 정보는 3025년의 타임라인과 기존 물리 법칙의 연장선상에서 생성되어야 합니다.


### **2. 시스템 아키텍처 및 기술 스택**



* **Frontend (frontend/*)**: NextJS, Tailwind CSS, Shadcn UI, react-markdown
* **Backend (frontend/src/app/api/*)**: Next.js Route Handlers / Server Actions (Node/Edge 런타임)
* **Database (Metadata)**: Supabase Postgres
* **ORM**: 없음 — Supabase JS Client(SQL/RPC) 사용
* **Storage (Page Content)**: Supabase Storage
* **Vector**: pgvector (Supabase Postgres — 본문 청크 테이블 1개, 페이지 테이블에 제목 임베딩 열 1개)
* **Rate Limiting**: Postgres 기반(테이블/함수)
* **LLM API**: Google Gemini 2.5 Pro (콘텐츠 생성), Gemini 2.5 Flash (검증 및 분류)
* **Asynchronous Tasks**: Next.js 서버 태스크 또는 Supabase Edge Functions(선택)
* **Link Management**: 모든 링크는 Markdown 내에서만 관리 (DB 테이블로 별도 관리하지 않음)
* **Embeddings**: OpenAI `text-embedding-3-small` (본문 1536차원, 제목 512차원)


### **3. 데이터베이스 및 스토리지 스키마**


#### **A. Supabase Postgres (SQL Database)**



1. **Pages Table**: 페이지 메타데이터
    * id (INTEGER, PK, Auto-increment)
    * slug (TEXT, UNIQUE): URL에 사용될 식별자
    * title (TEXT, UNIQUE): 페이지 제목
    * storage_object_path (TEXT): Supabase Storage에 저장된 Markdown 본문 경로
    * summary (TEXT): RAG 및 링크 생성 시 사용될 LLM 생성 요약본
    * created_at (DATETIME)
    * updated_at (DATETIME)
    * last_visited_at (DATETIME)
2. **PageViews Table**: 페이지 조회수 집계
    * id (INTEGER, PK, Auto-increment)
    * page_id (INTEGER, FK to Pages.id)
    * viewed_at (DATETIME)
3. **Reports Table**: 페이지 신고 내역
    * id (INTEGER, PK, Auto-increment)
    * page_id (INTEGER, FK to Pages.id)
    * report_type (TEXT): '부적절함', '논리적 오류', '기타'
    * reason_text (TEXT, Nullable)
    * created_at (DATETIME)


#### **B. Supabase Storage (Object Storage)**



* 생성된 각 위키 페이지의 순수 **Markdown** 텍스트를 저장합니다.
* 객체 키 예시: pages/venus-terraforming.md (버킷: pages)


#### **C. pgvector (Vector Database in Supabase Postgres)**



1. **Content-Embeddings Table**: **페이지 생성(RAG)용**
    * 페이지 본문을 의미 단위로 분할(Chunking)하여 벡터로 저장합니다.
    * Key: page_id:chunk_index
    * Dimension: 1536, Metric: cosine, Embedding Model: OpenAI `text-embedding-3-small`
2. **Page Title Embedding (pages.title_embedding)**: **링크 검증 및 중복 확인용**
    * 페이지의 제목을 벡터로 저장합니다.
    * Location: `pages.title_embedding vector(512)` (nullable — 백필 스크립트로 채움)
    * Dimension: 512, Metric: cosine, Embedding Model: OpenAI `text-embedding-3-small` with `dimensions: 512`

임베딩 생성 원칙
* 본문/쿼리(RAG)는 OpenAI `text-embedding-3-small` 1536차원.
* 페이지 제목/쿼리(동일 페이지 판정)는 OpenAI `text-embedding-3-small` 512차원.
* 검색 시: 쿼리 텍스트를 임베딩 → 해당 인덱스에서 cosine 유사도 기반 topK 검색.
* 저장/업데이트 시: summary 및 본문 청크를 임베딩하여 각각의 인덱스에 upsert.


### **4. 핵심 로직: 단순화 플로우 (모든 링크는 Markdown으로 관리)**

링크 상태는 전적으로 Markdown 안에서만 관리합니다.

• 파란 링크(존재): [표기](/wiki/{slug})
• 빨간 링크(미존재): [표기](/create/{target-slug})

사용자가 빨간 링크를 클릭했을 때의 전체 동작 과정입니다.

**단계 1: 요청 수신 및 사전 검증**

1. 사용자가 페이지 A의 '금성의 테라포밍' 빨간 링크([표기](/create/venus-terraforming))를 클릭하여 POST /api/create 요청을 보냅니다.
    * Request Body: { "sourceSlug": "page_a_slug", "targetSlug": "venus-terraforming" }
2. 백엔드는 요청 IP를 기준으로 **Rate Limit**을 확인합니다.
3. **보안 검증**: Supabase Storage에서 `sourceSlug`의 Markdown을 불러와, `[... ](/create/venus-terraforming)` 링크가 실제로 존재하는지 확인합니다.
4. 링크 주변 컨텍스트 추출: 클릭된 링크의 좌우로 약 10개 내외 단어를 잘라 `localContext`(스니펫)로 확보합니다.

**단계 2: Gemini 2.5 Pro 세션 시작 (Function Calling 활성화)**

백엔드는 다음 함수들을 선언하여 모델에 제공합니다: 요약 인덱스 검색, 본문 청크 검색, 기존 페이지 조회/저장, 새 페이지 저장, 리다이렉트 등(자세한 사양은 7장 참조).

모델은 전체 `source` 문서와 `localContext`를 입력으로 받아 아래 분기를 자율적으로 수행합니다.

분기 결정 정책(명시)
- 모델은 먼저 `search_page_index`를 호출해 상위 후보를 조회합니다(topK 기본 5, threshold 기본 0.85 권장).
- 유의미한 후보가 존재하고 특정 후보가 동일/동일시 가능한 주제로 확정되면 → 반드시 분기 A로 진행하고, 분기 B로 절대 진행하지 않습니다.
- 상위 후보가 없거나 임계치를 넘지 못해 동일 주제를 확정할 수 없다면 → 분기 B로 진행합니다.

**분기 A: 동일/유사 주제 문서가 이미 존재하는 경우**
1. 모델이 `search_page_index`를 호출해 상위 후보를 확인하고, 기준을 충족하면 `redirect_to_existing({ slug })`를 호출합니다.
    * 백엔드는 즉시 사용자에게 {"redirect": "/wiki/{slug}"}로 응답합니다.
2. 모델이 `get_page({ slug })`로 기존 문서 전체를 가져와 읽은 뒤, `sourceSlug` 문서의 해당 빨간 링크를 파란 링크([표기](/wiki/{slug}))로 바꾸고, 필요 시 관련 내용에 한해 보강/정정을 포함하여 편집합니다.
    * 편집 범위 가이드:
        - 링크가 위치한 문단 또는 인접 문단에 한정해 소규모 추가/수정 허용
        - 사실 일관성/맥락 연결 보강 목적에 한정, 대규모 구조 변경 금지
        - 불확실한 진술은 피하고, 3025년 타임라인과 물리 법칙을 엄수
3. 모델이 편집된 Markdown을 `persist_page_update({ slug: sourceSlug, markdown, summary?, editReason?, changeSummary? })`로 저장합니다.
4. 백엔드는 `summary` 재임베딩 및 본문 청크 재임베딩을 갱신합니다.
5. 종료: 분기 A 경로에서는 위 단계(2~4) 완료 후 세션을 종료합니다. 분기 B로 절대 진행하지 않습니다.

**분기 B: 존재하지 않는 경우(신규 생성)**
1. 모델이 필요 시 `search_content_index`(RAG)를 자율 호출하여 컨텍스트를 수집합니다.
2. 모델이 신규 문서의 요약과 본문 초안을 작성합니다.
3. 모델이 초안에서 링크 후보를 추출하고, 각 후보에 대해 `batch_resolve_page_index`(또는 `search_page_index`)로 존재 여부를 확인합니다.
    * 존재: [표기](/wiki/{slug})로 삽입
    * 미존재: [표기](/create/{target-slug})로 삽입 (source 정보 미포함)
4. 모델이 최종 Markdown과 메타데이터(title, proposedSlug, summary 등)를 `persist_new_page(...)`로 저장합니다.
5. 모델이 `sourceSlug` 문서의 해당 빨간 링크를 방금 생성된 파란 링크([표기](/wiki/{canonicalSlug}))로 바꾸고, 필요 시 관련 내용에 한해 보강/정정을 포함하여 편집한 뒤, `persist_page_update(...)`로 저장합니다.
6. 백엔드는 생성된 `canonicalSlug`를 응답하여 프론트엔드가 새 페이지로 이동합니다.


### **5. API 엔드포인트**



* GET /api/wiki/:slug: 특정 위키 페이지의 **Markdown** 콘텐츠를 Supabase Storage에서 불러와 반환합니다. PageViews에 기록을 추가합니다.
* POST /api/create: 빨간 링크 클릭 처리. Request Body: { "sourceSlug": string, "targetSlug": string }
    * 링크 존재 검증 → Gemini 세션 시작 → 분기 A(리다이렉트) 또는 분기 B(신규 생성) 수행
* GET /api/homepage/recent: Pages 테이블에서 created_at 기준으로 최신 10개 페이지의 title, slug를 반환합니다.
* GET /api/homepage/popular: PageViews 테이블에서 최근 24시간 동안의 조회수를 집계하여 상위 10개 페이지의 title, slug를 반환합니다.
* POST /api/report: 페이지 신고를 접수하여 Reports 테이블에 저장합니다.
    * Request Body: { "pageId": 123, "reportType": "논리적 오류", "reasonText": "..." }

추가 규칙: 생성 시 슬러그 충돌 발생 시 백엔드는 고유 슬러그로 정규화(canonicalize)하고, LLM에 피드백하여 링크 일관성을 유지합니다.

### **6. 링크 규칙(요약)**

* 파란 링크(존재): [텍스트](/wiki/{slug})
* 빨간 링크(미존재): [텍스트](/create/{target-slug}) — source 정보 포함 금지 (프론트엔드가 클릭 시 `sourceSlug`를 첨부하여 API 호출)


### **7. Gemini 함수(Function Calling) 사양**

모든 함수는 OpenAPI 하위 집합 스키마에 맞춘 JSON I/O를 사용합니다. 대표 함수 명세는 아래와 같습니다.

1) search_page_index
    * 입력: { query: string, topK?: number, threshold?: number }
    * 출력: { matches: [{ pageId: number, slug: string, title: string, summary?: string | null, score: number }] }
    * 처리: OpenAI `text-embedding-3-small` 512차원으로 쿼리 임베딩 후 Pages.title_embedding에서 cosine 검색

2) batch_resolve_page_index
    * 입력: { candidates: [{ term: string, context?: string }], topK?: number, threshold?: number }
    * 출력: { resolved: [{ term: string, slug: string, title: string, score: number }], unresolved: [{ term: string }] }
    * 처리: 각 term(+context)을 임베딩하여 Summary 임베딩 테이블(pgvector)에서 일괄 검색

3) search_content_index (RAG)
    * 입력: { query: string, topK?: number }
    * 출력: { chunks: [{ pageId: number, slug: string, title: string, text: string, score: number }] }
    * 처리: OpenAI `text-embedding-3-small`로 쿼리 임베딩 후 Content 임베딩 테이블(pgvector)에서 cosine 검색

4) get_page
    * 입력: { slug: string }
    * 출력: { pageId: number, slug: string, title: string, markdown: string }

5) persist_new_page
    * 입력: {
        title: string,
        proposedSlug: string,
        summary: string,
        markdown: string
      }
    * 처리: Pages insert(Supabase Postgres), Supabase Storage 저장, OpenAI 임베딩 계산 후 pgvector 테이블(요약 1개, 본문 청크 N개) upsert
    * 출력: { pageId: number, canonicalSlug: string, storageObjectPath: string }

6) persist_page_update
    * 입력: { slug: string, markdown: string, summary?: string }
    * 처리: Supabase Storage 덮어쓰기, Pages.updated_at 갱신, OpenAI 임베딩 재계산 후 pgvector 재임베딩(upsert)
    * 출력: { ok: true }

7) redirect_to_existing
    * 입력: { slug: string }
    * 처리: 즉시 사용자 리다이렉트 응답 예약(백엔드는 비동기로 세션 지속)
    * 출력: { accepted: true }

에러 및 경합 처리
* slug 충돌: `persist_new_page`는 충돌 시 `canonicalSlug`로 교정하여 반환합니다.
* 중복 생성 경쟁: 요약 인덱스/슬러그 유일성으로 방지. 교차 감지 시 `redirect_to_existing`로 전환.

프롬프트 핵심 가이드라인
* 3025년 타임라인과 물리 법칙의 연장선 유지
* 분기 A 우선 처리: 동일 주제 발견 시 즉시 리다이렉트 → 기존 문서 기준으로 소스 문서를 재작성해 링크 일관성 확보 → 재임베딩 완료 후 세션 종료(분기 B로 진행 금지)
* 분기 B: 생성 전 RAG로 충분히 검토하고, 링크는 가능한 범위 내 파란 링크 우선, 나머지는 `/create/{target-slug}`로 처리

### **8. 모더레이션 및 사용자 피드백**



* **신고 기능**: 각 페이지 하단에 '신고' 버튼을 배치합니다. 클릭 시 모달창을 통해 신고 유형을 선택하고 사유를 제출할 수 있습니다.
* **관리자 기능 (향후 과제)**: 별도의 인증된 경로를 통해 신고 내역을 조회하고, 문제가 되는 페이지를 삭제하거나 재생성할 수 있는 기능을 구현합니다.


### **9. 실행 모드 및 로깅(Dev/Prod)**

실행 모드는 환경 변수로 제어합니다.

- NODE_ENV: `development` | `production`
- NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY (서버 전용)
- GEMINI_DEBUG_LOG: `true`일 때 Gemini 상호작용 디버그 로그 활성화

개발 모드(Dev) 동작
- 스토리지: Supabase Storage 사용
- 로깅(터미널 출력):
  - 요청/응답 요약: 모델 이름, 프롬프트 길이, 응답 길이, 토큰 사용량(가능 시 `usageMetadata`).
  - 함수 호출: 함수명, 인자(JSON), 반환 요약(JSON, 길이 제한)
  - 분기 결정: 분기 A/B 선택 사유(요약), 후보 개수 및 최고 점수
  - 생각 요약: `includeThoughts: true` 설정 시 제공되는 thought summary만 로그(원시 내부 사고는 접근 불가)
  - 대용량 응답은 처음/마지막 N자만 출력하며 전체는 파일로 보관(옵션)

프로덕션(Prod) 동작
- 스토리지: Supabase Storage 사용
- 로깅: 최소화(PII/비밀키 마스킹), 함수 인자/응답은 필요 최소 수준만 보관