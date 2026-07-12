# Question Drawer — 설계 문서

- 날짜: 2026-07-12
- 상태: 승인됨 (구현 계획 대기)

## 1. 개요

Claude(`claude.ai`)와 ChatGPT(`chatgpt.com`) 웹을 사용할 때, AI 답변 속에서 **더 파고들고 싶은 단어/개념을 사용자가 직접 드래그로 선택해 "서랍"에 담아두는** 크롬 확장. 담긴 항목을 나중에 클릭하면 그 단어에 대한 질문이 입력창에 자동으로 채워져, 사용자가 이어서 물어볼 수 있다.

핵심 원칙: **"무엇이 궁금한가"의 판단은 사용자에게 맡긴다.** 확장은 AI가 개념을 자동 추출하지 않으며, 사용자가 고른 텍스트만 다룬다. 덕분에 클러터가 없고, MVP에 LLM/API가 전혀 필요 없다.

### 사용자 흐름
1. 사용자가 React에 대해 질문하고, AI 답변에 "사이드 이펙트" 관련 내용이 등장.
2. 사용자가 답변에서 "사이드 이펙트"를 드래그 선택 → 근처에 뜬 "서랍에 담기" 버튼 클릭.
3. 오른쪽 서랍 패널에 "사이드 이펙트에 대해 자세히 설명해줘"가 항목으로 추가됨.
4. 사용자는 먼저 답변을 다 읽고, 나중에 서랍의 항목을 클릭.
5. 그 질문 텍스트가 현재 사이트의 입력창에 채워짐 → 사용자가 직접 전송.

## 2. 범위 (MVP)

- 포함: 드래그 선택 → 담기, 서랍 목록(유지·삭제·클릭 삽입), Claude/ChatGPT 두 사이트, 브라우저 재시작에도 유지되는 저장.
- 제외(추후): LLM 기반 스마트 질문 생성(B안), 후보 자동 하이라이트, 대화별 서랍 분류, 설정 화면.

## 3. 기술 스택

- **프레임워크**: WXT (MV3 매니페스트/주입/HMR/크로스 브라우저 처리)
- **UI**: React + Tailwind CSS, **Shadow DOM** 내부에 렌더 (호스트 페이지 CSS 격리)
- **언어**: TypeScript
- **검증**: Zod (저장 스키마)
- **저장**: `chrome.storage.local`
- **테스트**: Vitest(단위), Playwright(E2E)

## 4. 아키텍처 & 컴포넌트

Content script가 대상 사이트에 주입되며, 아래 컴포넌트로 구성된다. 각 컴포넌트는 하나의 책임만 가지며 인터페이스로 통신한다.

1. **Selection Watcher** — 페이지에서 드래그 선택을 감지하고 선택 근처에 "서랍에 담기" 플로팅 버튼을 띄운다. 담기 시 Question Template을 적용해 Storage에 저장.
2. **Question Template** — 선택 텍스트를 질문 문자열로 변환하는 순수 함수. 기본 템플릿 사용. 예: `text => \`${text}에 대해 자세히 설명해줘\``. 나중에 템플릿 교체가 가능하도록 인터페이스만 열어둔다.
3. **Drawer Panel (React, Shadow DOM)** — 오른쪽 고정 패널. 저장된 질문 목록 렌더링, 항목 클릭 시 입력창 삽입, 삭제, 접기/펼치기.
4. **Site Adapter** — 사이트별 DOM 차이를 흡수하는 인터페이스. 구현: `claude`, `chatgpt`.
   - `getInputBox(): HTMLElement | null`
   - `insertPrompt(text: string): void`
   - (선택) `getAnswerContainer()` — 드래그 감지 범위를 답변으로 한정하고 싶을 때
5. **Storage 모듈** — `chrome.storage.local` 위의 얇은 CRUD 래퍼. 다른 코드는 chrome API를 직접 만지지 않는다.

```
Selection Watcher ──┐
                    ├─▶ Question Template ─▶ Storage ◀─▶ chrome.storage.local
Drawer Panel ◀──────┘                         ▲
      │                                        │
      └─▶ Site Adapter (insertPrompt) ─────────┘
```

## 5. 데이터 모델

```typescript
interface DrawerItem {
  id: string            // crypto.randomUUID()
  selectedText: string  // 담은 원본 텍스트 ("사이드 이펙트")
  question: string      // 템플릿 적용 결과
  site: 'claude' | 'chatgpt'
  createdAt: number     // Date.now()
}
// 저장 형태: { items: DrawerItem[] } — 전역 단일 서랍
```

- 지금은 전역 단일 서랍. 대화별 분류는 추후 확장 여지만 남긴다 (YAGNI).
- 저장/로드 시 Zod로 스키마 검증.

## 6. 사이트 연동 (최고 리스크 영역)

- **ChatGPT / Claude 모두 입력창은 ProseMirror 기반 `contenteditable`**(또는 textarea). 텍스트 삽입 후 native input 이벤트를 디스패치해야 프레임워크 상태에 반영된다.
- 두 사이트 모두 **CSS 클래스명이 난독화·수시 변경**됨. 따라서 클래스 셀렉터 의존을 피하고 **안정적 셀렉터**(`textarea`, `[contenteditable]`, `role`, `aria-label`, DOM 구조 관계)를 우선 사용.
- **답변 컨테이너 특정은 필수 아님** — 우리는 사용자가 드래그한 텍스트만 필요하므로 페이지 전체 드래그를 감지해도 된다. 컨테이너 한정은 선택적 개선.
- 사이트가 UI를 바꾸면 **Site Adapter만** 수정하면 되도록 격리.

## 7. 에러 처리

- 입력창을 못 찾으면 조용히 실패하지 않는다 → 질문을 **클립보드에 복사**하고 "입력창을 못 찾아 클립보드에 복사했어요" 토스트 표시(fallback).
- Storage 읽기 실패/스키마 불일치 → 빈 서랍으로 복구하고 로깅 모듈로 경고(`console.log` 직접 사용 금지 규칙 준수).

## 8. 테스트

- **단위(Vitest)**: Question Template 순수 함수, Storage CRUD 래퍼, Zod 스키마.
- **E2E(Playwright)**: 확장을 로드해 실제 사이트에서 "드래그→담기→목록 표시→클릭→입력창 삽입" 플로우 검증. 로그인이 필요하므로 초기엔 수동/반자동.

## 9. 향후 확장 (MVP 이후)

- **B안 — LLM 스마트 질문 생성**: 선택 단어 + 주변 맥락으로 맥락형 질문 생성. **BYOK(사용자 본인 API 키)** 방식 권장. 로그인 세션을 빌려 내부 API를 호출하는 방식은 약관 위반·계정 정지 위험·취약성 때문에 배제.
- 후보 자동 하이라이트, 대화별 서랍 분류, 설정 화면(템플릿 편집).
