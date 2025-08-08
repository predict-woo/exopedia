# 엑소피디아 (Exopedia)

3025년의 미래를 탐험하는 AI 기반 실시간 위키 시스템

## 개요

엑소피디아는 3025년의 관점에서 작성되는 미래 백과사전입니다. 모든 문서는 Google Gemini 2.5 Pro를 통해 실시간으로 생성되며, 사용자의 탐험을 통해 끊임없이 확장되는 살아있는 지식 체계입니다.

### 주요 특징

- 🚀 **실시간 AI 생성**: 모든 콘텐츠는 Gemini 2.5 Pro가 3025년의 관점에서 생성
- 🔗 **유기적 연결**: 빨간 링크(미생성)를 클릭하면 자동으로 새 문서 생성
- 🧠 **일관된 세계관**: RAG와 벡터 검색을 통한 콘텐츠 일관성 유지
- 🎯 **중복 방지**: 유사 문서 자동 감지 및 리다이렉트
- 📊 **지능형 임베딩**: OpenAI text-embedding-3-small을 통한 의미 기반 검색

## 기술 스택

- **Frontend**: Next.js 15, React 19, Tailwind CSS, Shadcn UI
- **Backend**: Next.js API Routes
- **Database**: Supabase (PostgreSQL + pgvector)
- **Storage**: Supabase Storage
- **AI/ML**: 
  - Google Gemini 2.5 Pro (콘텐츠 생성)
  - OpenAI Embeddings (벡터 검색)
- **Language**: TypeScript

## 설치 및 실행

### 1. 필요 조건

- Node.js 18+ 
- pnpm (권장) 또는 npm
- Supabase 프로젝트
- API 키:
  - Google Gemini API 키
  - OpenAI API 키

### 2. 프로젝트 설정

```bash
# 의존성 설치
pnpm install

# 환경 변수 설정
cp env.example .env.local
# .env.local 파일을 편집하여 API 키와 Supabase 정보 입력
```

### 3. Supabase 설정

1. [Supabase](https://supabase.com)에서 새 프로젝트 생성
2. SQL Editor에서 마이그레이션 파일 실행:
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_vector_functions.sql`
3. Storage에서 'pages' 버킷 생성 (Public 설정)

### 4. 초기 데이터 시드

```bash
# 메인 페이지 생성
pnpm run seed
```

### 5. 개발 서버 실행

```bash
pnpm dev
```

http://localhost:3000 에서 확인

## 프로젝트 구조

```
exopedia-claude/
├── app/
│   ├── api/               # API 엔드포인트
│   │   ├── wiki/[slug]/   # 위키 페이지 조회
│   │   ├── create/        # 새 페이지 생성
│   │   ├── homepage/      # 홈페이지 데이터
│   │   └── report/        # 신고 기능
│   ├── wiki/[slug]/       # 위키 페이지 뷰어
│   └── page.tsx           # 홈페이지
├── components/
│   ├── ui/                # Shadcn UI 컴포넌트
│   ├── wiki-page-viewer.tsx
│   └── report-dialog.tsx
├── lib/
│   ├── gemini/            # Gemini API 통합
│   ├── supabase/          # Supabase 클라이언트
│   └── embeddings.ts      # OpenAI 임베딩
└── scripts/
    └── seed.ts            # 초기 데이터 시드
```

## 핵심 기능

### 1. 링크 시스템

- **파란 링크**: 존재하는 페이지 (`[텍스트](/wiki/slug)`)
- **빨간 링크**: 미생성 페이지 (`[텍스트](/create/slug)`)

### 2. 페이지 생성 플로우

1. 사용자가 빨간 링크 클릭
2. Gemini가 기존 문서 검색 (유사도 임계값 0.85)
3. 유사 문서 발견 시 → 리다이렉트
4. 없을 경우 → 새 문서 생성
5. 소스 문서의 링크 자동 업데이트

### 3. RAG (Retrieval Augmented Generation)

- 문서 생성 시 관련 콘텐츠 검색
- pgvector를 통한 의미 기반 유사도 검색
- 일관된 세계관 유지

## 환경 변수

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# AI APIs
GEMINI_API_KEY=your_gemini_api_key
OPENAI_API_KEY=your_openai_api_key

# Optional
GEMINI_DEBUG_LOG=false
NEXT_PUBLIC_URL=http://localhost:3000
```

## 개발 가이드

### 새 기능 추가

1. API 엔드포인트는 `app/api/` 디렉토리에 추가
2. UI 컴포넌트는 `components/` 디렉토리에 추가
3. Gemini 함수 추가 시 `lib/gemini/client.ts` 수정

### 데이터베이스 스키마 변경

1. `supabase/migrations/` 디렉토리에 새 SQL 파일 생성
2. Supabase Dashboard에서 실행

## 라이선스

MIT

## 기여

이슈와 PR을 환영합니다!

---

*"미래는 탐험하는 자의 것이다"* - 엑소피디아 모토