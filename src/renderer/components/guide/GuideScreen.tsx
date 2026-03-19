import { Link } from "react-router-dom";

const quickStartSteps = [
  {
    title: "1. 캘린더에서 수동 일정 만들기",
    description: "캘린더 화면에서 날짜를 드래그하거나 우측 편집 폼에 제목, 시간, 상태(예정/진행 중/완료/보류/취소)를 입력한 뒤 저장합니다.",
  },
  {
    title: "2. 반복 일정 설정하기",
    description: "일정 폼의 반복 섹션에서 daily, weekly, monthly, yearly와 간격, 요일, 종료 조건을 입력합니다.",
  },
  {
    title: "3. 메모와 위키링크 연결하기",
    description: "메모 화면에서 [[note:메모 제목]] 또는 [[event:일정 제목]] 형식으로 작성하면 저장 시 링크와 백링크가 계산됩니다.",
  },
  {
    title: "4. 관계도에서 연결 구조 보기",
    description: "관계도 화면에서 event, note, annotation, tag를 필터링하고 검색으로 특정 노드를 빠르게 찾을 수 있습니다.",
  },
  {
    title: "5. 함수 엔진으로 조건 테스트하기",
    description: "함수 화면에서 표현식을 직접 평가하고, 유효한 식만 저장 규칙으로 등록할 수 있습니다.",
  },
  {
    title: "6. AI 기능 활성화하기",
    description: "설정에서 GPT API 키와 모델명을 저장한 뒤 캘린더 화면의 AI 입력 패널에서 자연어 일정을 후보로 미리 볼 수 있습니다.",
  },
];

const featureSections = [
  {
    title: "캘린더",
    points: [
      "월, 주, 일, agenda 보기를 전환할 수 있습니다.",
      "완료 체크는 상태와 동기화됩니다. 반복 일정 회차는 개별 오버라이드로 저장됩니다.",
      "현재 화면 범위 기준 주석(date, week, month)을 우측 패널에서 저장할 수 있습니다.",
    ],
    cta: { to: "/calendar", label: "캘린더 열기" },
  },
  {
    title: "메모 / 링크 / 백링크",
    points: [
      "메모는 독립적으로 저장되며 event와 연결할 수 있습니다.",
      "저장 시 위키링크가 파싱되어 link_edges가 갱신됩니다.",
      "오른쪽 패널에서 outgoing 링크와 backlinks를 확인할 수 있습니다.",
    ],
    example: "[[note:프로젝트 메모]]  [[event:월간 정산]]",
    cta: { to: "/notes", label: "메모 열기" },
  },
  {
    title: "관계도",
    points: [
      "event, note, annotation, tag를 노드로 보여 줍니다.",
      "검색과 타입 필터를 조합해 필요한 연결만 볼 수 있습니다.",
      "노드를 선택하면 해당 엔티티 타입과 ID를 확인할 수 있습니다.",
    ],
    cta: { to: "/graph", label: "관계도 열기" },
  },
  {
    title: "함수 엔진",
    points: [
      "예: isDone(), and(hasMemo(), not(isDone())), daysUntil(startAt), currentRecurrenceCount()",
      "live 규칙에는 random 계열 함수를 저장할 수 없습니다.",
      "반환 타입(boolean, number, string)이 맞는 식만 저장됩니다.",
    ],
    example: "and(hasMemo(), not(isDone()))",
    cta: { to: "/functions", label: "함수 열기" },
  },
  {
    title: "AI 일정 입력",
    points: [
      "API 키가 없으면 입력 패널은 열리지만 실행은 비활성화됩니다.",
      "AI 결과는 자동 저장되지 않고 항상 미리보기 후 저장됩니다.",
      "날짜나 시간이 불명확하면 ambiguityFlags가 표시됩니다.",
    ],
    cta: { to: "/settings", label: "AI 설정 열기" },
  },
  {
    title: "데이터 관리",
    points: [
      "설정 화면에서 JSON 내보내기와 가져오기를 실행할 수 있습니다.",
      "앱 데이터는 userData 경로의 SQLite DB에 영구 저장됩니다.",
      "데이터 폴더 열기 버튼으로 실제 저장 위치를 바로 확인할 수 있습니다.",
    ],
    cta: { to: "/settings", label: "데이터 관리 열기" },
  },
];

const faqItems = [
  {
    q: "AI 없이도 앱을 쓸 수 있나요?",
    a: "가능합니다. 일정 CRUD, 반복 일정, 메모, 위키링크, 백링크, 관계도, 함수 엔진, 내보내기/가져오기는 AI 없이 동작합니다.",
  },
  {
    q: "위키링크는 어떻게 작성하나요?",
    a: "권장 형식은 [[note:제목]], [[event:제목]]입니다. 제목만 쓰는 [[제목]]도 지원하지만 중복 제목이 있으면 자동 연결하지 않습니다.",
  },
  {
    q: "반복 일정에서 한 회차만 완료할 수 있나요?",
    a: "가능합니다. 캘린더에서 반복 회차를 선택한 뒤 완료 체크를 하면 해당 occurrenceDate 기준 오버라이드가 저장됩니다.",
  },
];

export function GuideScreen(): JSX.Element {
  return (
    <section className="screen">
      <div className="panel stack">
        <div className="section-title">
          <strong>앱 설명서</strong>
          <span className="badge">Calendar AI Desktop Guide</span>
        </div>
        <p className="muted">
          이 설명서는 현재 앱에 구현된 핵심 기능과 실제 사용 흐름만 정리합니다. 빠르게 시작하려면 아래 빠른 시작을 먼저 보고, 세부 사용법은 화면별 설명을 확인하면 됩니다.
        </p>
      </div>

      <div className="grid-3">
        <div className="panel stack">
          <div className="section-title">
            <strong>빠른 시작</strong>
          </div>
          <div className="list">
            {quickStartSteps.map((step) => (
              <div key={step.title} className="list-item">
                <strong>{step.title}</strong>
                <div className="muted">{step.description}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel stack">
          <div className="section-title">
            <strong>핵심 원칙</strong>
          </div>
          <div className="list">
            <div className="list-item">
              <strong>로컬 우선</strong>
              <div className="muted">핵심 데이터는 브라우저 저장소가 아니라 로컬 SQLite DB에 영구 저장됩니다.</div>
            </div>
            <div className="list-item">
              <strong>AI는 선택 기능</strong>
              <div className="muted">API 키가 없어도 수동 기능은 계속 사용할 수 있습니다.</div>
            </div>
            <div className="list-item">
              <strong>저장은 항상 사용자 확인 후</strong>
              <div className="muted">AI 파싱 결과는 자동 반영되지 않고 미리보기 후 저장됩니다.</div>
            </div>
          </div>
        </div>

        <div className="panel stack">
          <div className="section-title">
            <strong>바로 가기</strong>
          </div>
          <div className="list">
            <Link className="list-item" to="/calendar">
              <strong>캘린더</strong>
              <div className="muted">일정 생성, 반복 일정, 주석, AI 입력</div>
            </Link>
            <Link className="list-item" to="/notes">
              <strong>메모</strong>
              <div className="muted">메모 작성, 위키링크, 백링크</div>
            </Link>
            <Link className="list-item" to="/settings">
              <strong>설정</strong>
              <div className="muted">API 키, 기본 보기, 내보내기/가져오기</div>
            </Link>
          </div>
        </div>
      </div>

      <div className="grid-3">
        {featureSections.map((section) => (
          <div key={section.title} className="panel stack">
            <div className="section-title">
              <strong>{section.title}</strong>
            </div>
            <div className="list">
              {section.points.map((point) => (
                <div key={point} className="list-item">
                  {point}
                </div>
              ))}
            </div>
            {section.example ? (
              <div className="panel">
                <strong>예시</strong>
                <pre>{section.example}</pre>
              </div>
            ) : null}
            <Link className="button" to={section.cta.to}>
              {section.cta.label}
            </Link>
          </div>
        ))}
      </div>

      <div className="grid-2">
        <div className="panel stack">
          <div className="section-title">
            <strong>자주 묻는 질문</strong>
          </div>
          <div className="list">
            {faqItems.map((item) => (
              <div key={item.q} className="list-item">
                <strong>{item.q}</strong>
                <div className="muted">{item.a}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel stack">
          <div className="section-title">
            <strong>권장 사용 순서</strong>
          </div>
          <div className="list">
            <div className="list-item">
              <strong>1. 설정</strong>
              <div className="muted">기본 보기, 타임존, API 키 사용 여부를 먼저 결정합니다.</div>
            </div>
            <div className="list-item">
              <strong>2. 캘린더</strong>
              <div className="muted">수동 일정과 반복 일정을 먼저 입력해 기본 구조를 만듭니다.</div>
            </div>
            <div className="list-item">
              <strong>3. 메모</strong>
              <div className="muted">관련 정보를 메모로 정리하고 위키링크로 일정과 연결합니다.</div>
            </div>
            <div className="list-item">
              <strong>4. 관계도 / 함수</strong>
              <div className="muted">연결 구조를 확인하고 필터 규칙이나 배지 규칙을 실험합니다.</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
