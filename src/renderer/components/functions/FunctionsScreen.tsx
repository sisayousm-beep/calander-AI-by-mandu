import { useEffect, useState } from "react";
import type { FormulaRuleRecord } from "@shared/schemas/formula";
import { useFormulaStore } from "@renderer/stores/useFormulaStore";

type FormulaTargetType = "event" | "note" | "annotation" | "global";
type FormulaReturnType = "boolean" | "number" | "string";
type FormulaEvaluationMode = "manual" | "live";

type FunctionGuide = {
  signature: string;
  aliases: string[];
  summary: string;
  parameterDomain: string;
  codomain: string;
  range: string;
  description: string;
  example: string;
};

type BlockTemplate = {
  label: string;
  description: string;
  expression: string;
  targetType: FormulaTargetType;
};

type FunctionCategory = {
  id: string;
  title: string;
  description: string;
  blocks: BlockTemplate[];
  items: FunctionGuide[];
};

const targetTypeLabels: Record<FormulaTargetType, string> = {
  event: "일정",
  note: "메모",
  annotation: "주석",
  global: "전체 화면",
};

const returnTypeLabels: Record<FormulaReturnType, string> = {
  boolean: "참/거짓",
  number: "숫자",
  string: "글자",
};

const evaluationModeLabels: Record<FormulaEvaluationMode, string> = {
  manual: "필요할 때만 계산",
  live: "값이 바뀔 때마다 바로 계산",
};

const sampleContexts: Record<FormulaTargetType, Record<string, unknown>> = {
  event: {
    status: "예정",
    title: "팀 회의",
    startAt: new Date().toISOString(),
    endAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    noteCount: 1,
    linkCount: 1,
    tags: ["중요"],
    allDay: false,
    isRecurring: false,
    durationMinutes: 60,
  },
  note: {
    title: "회의 메모",
    content: "TODO: 회의 안건 정리",
    tagCount: 1,
    linkCount: 0,
  },
  annotation: {
    targetType: "date",
    targetKey: "2026-03-19",
    content: "오늘은 집중 근무일",
  },
  global: {
    currentView: "month",
    today: "2026-03-19",
    now: new Date().toISOString(),
  },
};

const functionCategories: FunctionCategory[] = [
  {
    id: "status",
    title: "상태 확인",
    description: "일정의 상태나 연결 여부를 바로 확인할 때 쓰는 함수입니다.",
    blocks: [
      { label: "완료된 일정 찾기", description: "완료 상태인지 확인합니다.", expression: "완료인가()", targetType: "event" },
      { label: "메모가 붙은 일정 찾기", description: "메모가 1개 이상인지 확인합니다.", expression: "메모있음()", targetType: "event" },
      { label: "마감 지난 일정 찾기", description: "기한이 지났는지 확인합니다.", expression: "마감지남()", targetType: "event" },
    ],
    items: [
      {
        signature: "완료인가()",
        aliases: ["isDone()"],
        summary: "현재 일정이 완료 상태인지 확인합니다.",
        parameterDomain: "없음. 이 함수는 현재 일정의 상태값을 직접 읽습니다.",
        codomain: "참/거짓(Boolean)",
        range: "`true` 또는 `false`",
        description: "상태가 `완료`일 때만 `true`를 돌려줍니다. 완료된 일정만 따로 분류하고 싶을 때 가장 많이 씁니다.",
        example: "완료인가()",
      },
      {
        signature: "예정인가(), 진행중인가(), 보류인가(), 취소인가()",
        aliases: ["isPlanned()", "isInProgress()", "isPaused()", "isCancelled()"],
        summary: "현재 일정이 특정 상태인지 각각 확인합니다.",
        parameterDomain: "없음. 현재 일정의 상태값을 읽습니다.",
        codomain: "참/거짓(Boolean)",
        range: "`true` 또는 `false`",
        description: "예정, 진행 중, 보류, 취소 중 원하는 상태를 바로 검사합니다. 예를 들어 진행 중인 일정만 따로 보고 싶다면 `진행중인가()`를 씁니다.",
        example: "진행중인가()",
      },
      {
        signature: "마감지남()",
        aliases: ["isOverdue()"],
        summary: "끝나는 시간이 지났는데 아직 닫히지 않은 일정인지 확인합니다.",
        parameterDomain: "없음. 현재 일정의 `endAt`과 `status`를 읽습니다.",
        codomain: "참/거짓(Boolean)",
        range: "`true` 또는 `false`",
        description: "기한이 지난 할 일을 찾을 때 씁니다. `완료`나 `취소` 상태는 자동으로 제외합니다.",
        example: "마감지남()",
      },
      {
        signature: "메모있음(), 링크있음(), 태그있음(태그이름), 하루종일인가(), 반복인가()",
        aliases: ["hasMemo()", "hasLinks()", "hasTag(name)", "isAllDay()", "isRecurring()"],
        summary: "메모, 링크, 태그, 하루 종일 여부, 반복 여부를 확인합니다.",
        parameterDomain: "`태그있음(태그이름)`만 문자열 1개를 받고, 나머지는 입력이 없습니다.",
        codomain: "참/거짓(Boolean)",
        range: "`true` 또는 `false`",
        description: "일정에 메모가 있는지, 특정 태그가 붙어 있는지, 반복 일정인지 같은 구조 정보를 확인할 때 씁니다.",
        example: "그리고(메모있음(), 태그있음('중요'))",
      },
    ],
  },
  {
    id: "logic",
    title: "조건 묶기",
    description: "조건 여러 개를 함께 검사하거나, 조건에 따라 다른 값을 내고 싶을 때 쓰는 함수입니다.",
    blocks: [
      { label: "둘 다 맞아야 함", description: "조건이 모두 참일 때만 참입니다.", expression: "그리고(메모있음(), 아니다(완료인가()))", targetType: "event" },
      { label: "하나만 맞아도 됨", description: "하나라도 참이면 참입니다.", expression: "또는(완료인가(), 취소인가())", targetType: "event" },
      { label: "조건에 따라 문구 바꾸기", description: "참일 때와 거짓일 때 다른 값을 냅니다.", expression: "조건(완료인가(), '완료', '진행 필요')", targetType: "event" },
    ],
    items: [
      {
        signature: "그리고(조건1, 조건2, ...)",
        aliases: ["and(a, b, ...)"],
        summary: "입력한 조건이 모두 참일 때만 참을 돌려줍니다.",
        parameterDomain: "참/거짓으로 계산될 수 있는 값 2개 이상",
        codomain: "참/거짓(Boolean)",
        range: "`true` 또는 `false`",
        description: "체크리스트처럼 여러 조건을 한 번에 묶을 때 씁니다. 하나라도 거짓이면 결과는 거짓입니다.",
        example: "그리고(메모있음(), 아니다(완료인가()))",
      },
      {
        signature: "또는(조건1, 조건2, ...)",
        aliases: ["or(a, b, ...)"],
        summary: "입력한 조건 중 하나라도 참이면 참을 돌려줍니다.",
        parameterDomain: "참/거짓으로 계산될 수 있는 값 2개 이상",
        codomain: "참/거짓(Boolean)",
        range: "`true` 또는 `false`",
        description: "여러 상태 중 하나만 맞아도 되는 넓은 조건을 만들 때 씁니다.",
        example: "또는(완료인가(), 취소인가())",
      },
      {
        signature: "아니다(값)",
        aliases: ["not(value)"],
        summary: "참은 거짓으로, 거짓은 참으로 뒤집습니다.",
        parameterDomain: "참/거짓으로 계산될 수 있는 값 1개",
        codomain: "참/거짓(Boolean)",
        range: "`true` 또는 `false`",
        description: "완료되지 않은 일정처럼 '아닌 것'을 찾고 싶을 때 씁니다.",
        example: "아니다(완료인가())",
      },
      {
        signature: "조건(조건식, 참일때값, 거짓일때값)",
        aliases: ["if(condition, trueValue, falseValue)"],
        summary: "조건이 맞으면 두 번째 값, 아니면 세 번째 값을 돌려줍니다.",
        parameterDomain: "첫 번째는 참/거짓 값 1개, 두 번째와 세 번째는 같은 종류의 값 2개",
        codomain: "숫자(Number), 글자(String), 참/거짓(Boolean) 중 하나",
        range: "입력한 두 후보 값 중 하나",
        description: "문구 라벨, 점수, 상태 표시처럼 조건에 따라 다른 결과를 만들 때 씁니다.",
        example: "조건(마감지남(), '긴급', '일반')",
      },
    ],
  },
  {
    id: "compare",
    title: "비교와 숫자 계산",
    description: "값이 같은지 비교하거나 숫자를 다듬어 점수처럼 쓰고 싶을 때 쓰는 함수입니다.",
    blocks: [
      { label: "메모가 1개 이상인지", description: "숫자를 비교합니다.", expression: "크거나같다(noteCount, 1)", targetType: "event" },
      { label: "큰 값 고르기", description: "둘 중 더 큰 숫자를 고릅니다.", expression: "최대(noteCount, linkCount)", targetType: "event" },
      { label: "반올림하기", description: "소수점을 보기 좋게 정리합니다.", expression: "반올림(3.6)", targetType: "global" },
    ],
    items: [
      {
        signature: "같다(a, b), 다르다(a, b)",
        aliases: ["eq(a, b)", "neq(a, b)"],
        summary: "두 값이 같은지 또는 다른지 확인합니다.",
        parameterDomain: "비교 가능한 값 2개",
        codomain: "참/거짓(Boolean)",
        range: "`true` 또는 `false`",
        description: "상태 이름, 태그 이름, 고정 문구처럼 정확히 일치하는지 확인할 때 적합합니다.",
        example: "같다(status, '예정')",
      },
      {
        signature: "크다(a, b), 크거나같다(a, b), 작다(a, b), 작거나같다(a, b)",
        aliases: ["gt()", "gte()", "lt()", "lte()"],
        summary: "두 숫자를 비교해서 크고 작음을 판단합니다.",
        parameterDomain: "숫자로 바꿀 수 있는 값 2개",
        codomain: "참/거짓(Boolean)",
        range: "`true` 또는 `false`",
        description: "메모 수, 링크 수, 날짜 차이처럼 수치 결과를 비교할 때 씁니다.",
        example: "크다(durationMinutes, 90)",
      },
      {
        signature: "최소(...), 최대(...), 절대값(x), 반올림(x), 버림(x), 올림(x)",
        aliases: ["min()", "max()", "abs()", "round()", "floor()", "ceil()"],
        summary: "숫자를 고르거나 다듬습니다.",
        parameterDomain: "숫자로 바꿀 수 있는 값 1개 이상",
        codomain: "숫자(Number)",
        range: "입력 숫자를 바탕으로 계산된 정수 또는 실수",
        description: "점수 계산이나 길이 계산 결과를 깔끔하게 정리할 때 유용합니다.",
        example: "최대(noteCount, linkCount)",
      },
    ],
  },
  {
    id: "date",
    title: "날짜와 시간",
    description: "오늘 기준 남은 일수, 요일, 날짜 차이를 계산할 때 쓰는 함수입니다.",
    blocks: [
      { label: "마감까지 남은 일수", description: "오늘 기준 남은 날짜 수를 셉니다.", expression: "남은일수(endAt)", targetType: "event" },
      { label: "요일 번호 확인", description: "월요일은 1, 일요일은 7입니다.", expression: "요일번호(startAt)", targetType: "event" },
      { label: "3일 뒤 날짜 만들기", description: "날짜에 일수를 더합니다.", expression: "날짜더하기(오늘(), 3)", targetType: "global" },
    ],
    items: [
      {
        signature: "오늘(), 지금()",
        aliases: ["today()", "now()"],
        summary: "현재 날짜나 현재 시각을 가져옵니다.",
        parameterDomain: "없음",
        codomain: "글자(String)",
        range: "`YYYY-MM-DD` 형식 날짜 또는 ISO 시각 문자열",
        description: "다른 날짜 계산의 기준점을 만들 때 자주 씁니다.",
        example: "오늘()",
      },
      {
        signature: "요일번호(날짜)",
        aliases: ["dayOfWeek(date)"],
        summary: "입력한 날짜가 무슨 요일인지 숫자로 알려줍니다.",
        parameterDomain: "날짜 또는 시각 문자열 1개",
        codomain: "숫자(Number)",
        range: "1부터 7 사이 정수. 월요일=1, 일요일=7",
        description: "주간 규칙이나 요일별 필터를 만들 때 유용합니다.",
        example: "요일번호(startAt)",
      },
      {
        signature: "날짜더하기(날짜, 일수)",
        aliases: ["addDays(date, value)"],
        summary: "기준 날짜에 원하는 날짜 수를 더합니다.",
        parameterDomain: "날짜 문자열 1개, 숫자 1개",
        codomain: "글자(String)",
        range: "ISO 형식 날짜/시각 문자열",
        description: "오늘부터 며칠 뒤의 시험용 날짜를 만들거나 비교 기준을 옮길 때 씁니다.",
        example: "날짜더하기(오늘(), 7)",
      },
      {
        signature: "날짜차이(a, b), 남은일수(날짜), 지난일수(날짜)",
        aliases: ["diffDays(a, b)", "daysUntil(date)", "daysSince(date)"],
        summary: "두 날짜 차이 또는 오늘 기준 남은/지난 일수를 계산합니다.",
        parameterDomain: "날짜 또는 시각 문자열 1개 이상",
        codomain: "숫자(Number)",
        range: "음수, 0, 양수를 포함한 정수",
        description: "마감까지 몇 일 남았는지, 시작한 지 몇 일이 지났는지 계산할 때 씁니다.",
        example: "남은일수(endAt)",
      },
    ],
  },
  {
    id: "text",
    title: "글자 확인",
    description: "제목이나 메모 본문 속 단어를 찾거나 길이를 재고 싶을 때 쓰는 함수입니다.",
    blocks: [
      { label: "제목에 '회의' 포함", description: "단어 포함 여부를 확인합니다.", expression: "포함(title, '회의')", targetType: "event" },
      { label: "메모가 TODO로 시작", description: "앞부분 글자를 확인합니다.", expression: "시작문자인가(content, 'TODO')", targetType: "note" },
      { label: "제목 길이 재기", description: "글자 수를 계산합니다.", expression: "글자수(title)", targetType: "event" },
    ],
    items: [
      {
        signature: "포함(문장, 찾을말)",
        aliases: ["contains(text, needle)"],
        summary: "문장 안에 특정 단어가 들어 있는지 확인합니다.",
        parameterDomain: "글자(String) 2개",
        codomain: "참/거짓(Boolean)",
        range: "`true` 또는 `false`",
        description: "회의, 긴급, TODO 같은 단어를 찾을 때 씁니다.",
        example: "포함(title, '긴급')",
      },
      {
        signature: "시작문자인가(문장, 앞글자), 끝문자인가(문장, 끝글자)",
        aliases: ["startsWith(text, prefix)", "endsWith(text, suffix)"],
        summary: "문장이 특정 글자로 시작하거나 끝나는지 확인합니다.",
        parameterDomain: "글자(String) 2개",
        codomain: "참/거짓(Boolean)",
        range: "`true` 또는 `false`",
        description: "문서 형식이나 접두어/접미어 규칙을 검사할 때 유용합니다.",
        example: "시작문자인가(content, 'TODO')",
      },
      {
        signature: "글자수(문장)",
        aliases: ["length(text)"],
        summary: "문장의 길이를 숫자로 계산합니다.",
        parameterDomain: "글자(String) 1개",
        codomain: "숫자(Number)",
        range: "0 이상의 정수",
        description: "제목이 너무 긴지 확인하거나 길이에 따라 점수를 만들 때 씁니다.",
        example: "글자수(title)",
      },
    ],
  },
  {
    id: "random",
    title: "랜덤",
    description: "테스트용으로 무작위 값을 만들 때 쓰는 함수입니다. 실시간 규칙에서는 피하는 것이 안전합니다.",
    blocks: [
      { label: "1~3 중 하나 뽑기", description: "범위 안에서 임의의 정수를 고릅니다.", expression: "무작위정수(1, 3)", targetType: "global" },
      { label: "참/거짓 무작위", description: "동전 던지기처럼 결과를 냅니다.", expression: "무작위참거짓()", targetType: "global" },
    ],
    items: [
      {
        signature: "무작위(), 무작위참거짓(), 무작위정수(최소, 최대)",
        aliases: ["random()", "randomBool()", "randomInt(min, max)"],
        summary: "무작위 실수, 참/거짓, 정수를 만듭니다.",
        parameterDomain: "`무작위()`와 `무작위참거짓()`은 입력 없음, `무작위정수()`는 숫자 2개",
        codomain: "숫자(Number) 또는 참/거짓(Boolean)",
        range: "`무작위()`는 0 이상 1 미만 실수, `무작위참거짓()`은 `true/false`, `무작위정수()`는 최소~최대 사이 정수",
        description: "테스트용으로는 편하지만 결과가 계속 바뀌므로 `live` 규칙에서는 저장을 막고 있습니다.",
        example: "무작위정수(1, 5)",
      },
    ],
  },
];

export function FunctionsScreen(): JSX.Element {
  const activeTargetType = useFormulaStore((state) => state.activeTargetType) as FormulaTargetType;
  const sampleContext = useFormulaStore((state) => state.sampleContext);
  const lastExpression = useFormulaStore((state) => state.lastExpression);
  const lastResult = useFormulaStore((state) => state.lastResult);
  const setActiveTargetType = useFormulaStore((state) => state.setActiveTargetType);
  const setSampleContext = useFormulaStore((state) => state.setSampleContext);
  const setLastExpression = useFormulaStore((state) => state.setLastExpression);
  const setLastResult = useFormulaStore((state) => state.setLastResult);

  const [rules, setRules] = useState<FormulaRuleRecord[]>([]);
  const [ruleName, setRuleName] = useState("");
  const [ruleDescription, setRuleDescription] = useState("");
  const [returnType, setReturnType] = useState<FormulaReturnType>("boolean");
  const [evaluationMode, setEvaluationMode] = useState<FormulaEvaluationMode>("manual");
  const [message, setMessage] = useState("왼쪽 블록을 누르면 한국어 함수식이 바로 들어갑니다. 테스트 후 저장하세요.");

  useEffect(() => {
    void refreshRules();
  }, []);

  const refreshRules = async () => {
    const { items } = await window.calendarApi.formula.listRules();
    setRules(items);
  };

  const handleTargetTypeChange = (nextTargetType: FormulaTargetType) => {
    setActiveTargetType(nextTargetType);
    setSampleContext(JSON.stringify(sampleContexts[nextTargetType], null, 2));
    setLastResult("");
  };

  const applyBlock = (block: BlockTemplate) => {
    handleTargetTypeChange(block.targetType);
    setLastExpression(block.expression);
    setMessage(`"${block.label}" 예시를 불러왔습니다. 그대로 테스트하거나 조금 바꿔서 저장해도 됩니다.`);
  };

  const handleEvaluate = async () => {
    try {
      const context = JSON.parse(sampleContext) as Record<string, unknown>;
      const result = await window.calendarApi.formula.evaluate(lastExpression, activeTargetType, context);
      setLastResult(result.ok ? JSON.stringify(result.result, null, 2) : result.error ?? "계산 실패");
      setMessage(result.ok ? "식 계산이 끝났습니다." : result.error ?? "식 계산에 실패했습니다.");
    } catch (error) {
      const nextMessage = error instanceof Error ? error.message : "테스트용 데이터(JSON) 형식이 올바르지 않습니다.";
      setLastResult(nextMessage);
      setMessage(nextMessage);
    }
  };

  const handleSaveRule = async () => {
    if (!ruleName.trim()) {
      setMessage("규칙 이름을 먼저 적어 주세요.");
      return;
    }

    if (!lastExpression.trim()) {
      setMessage("저장할 식이 비어 있습니다.");
      return;
    }

    await window.calendarApi.formula.saveRule({
      name: ruleName.trim(),
      description: ruleDescription.trim(),
      targetType: activeTargetType,
      returnType,
      expression: lastExpression,
      evaluationMode,
    });
    setMessage("규칙이 저장되었습니다.");
    setRuleName("");
    setRuleDescription("");
    await refreshRules();
  };

  return (
    <section className="screen grid-3">
      <div className="panel stack">
        <div className="section-title">
          <strong>쉬운 블록</strong>
          <span className="badge">한국어 함수</span>
        </div>
        <p className="muted">비전공자도 바로 쓸 수 있게 자주 쓰는 식을 블록처럼 정리했습니다. 버튼을 누르면 오른쪽 입력칸에 한국어 함수식이 들어갑니다.</p>
        <div className="list scroll-panel">
          {functionCategories.map((category) => (
            <section key={category.id} className="function-category">
              <strong>{category.title}</strong>
              <p className="muted">{category.description}</p>
              <div className="helper-grid">
                {category.blocks.map((block) => (
                  <button key={block.label} className="button block-button" onClick={() => applyBlock(block)}>
                    <strong>{block.label}</strong>
                    <span className="muted">{block.description}</span>
                    <code>{block.expression}</code>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>

      <div className="panel stack">
        <div className="section-title">
          <strong>함수 설명서</strong>
          <span className="badge">정의역/공역/치역 포함</span>
        </div>
        <div className="list scroll-panel">
          {functionCategories.map((category) => (
            <section key={category.id} className="function-category">
              <strong>{category.title}</strong>
              <p className="muted">{category.description}</p>
              <div className="list">
                {category.items.map((item) => (
                  <article key={item.signature} className="function-item">
                    <div className="section-title">
                      <strong>{item.signature}</strong>
                      <span className="badge">{item.codomain}</span>
                    </div>
                    <div className="muted">영문 호환: {item.aliases.join(", ")}</div>
                    <p>{item.summary}</p>
                    <div className="list">
                      <div className="list-item">
                        <strong>정의역(입력/파라미터)</strong>
                        <div className="muted">{item.parameterDomain}</div>
                      </div>
                      <div className="list-item">
                        <strong>공역(결과 타입)</strong>
                        <div className="muted">{item.codomain}</div>
                      </div>
                      <div className="list-item">
                        <strong>치역(실제 출력값)</strong>
                        <div className="muted">{item.range}</div>
                      </div>
                    </div>
                    <p className="muted">{item.description}</p>
                    <pre>{item.example}</pre>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>

      <div className="panel stack">
        <div className="section-title">
          <strong>규칙 만들기</strong>
          <span className="badge">1. 블록 선택 2. 테스트 3. 저장</span>
        </div>
        <label className="stack">
          <span className="muted">어느 화면에 쓸 규칙인가요?</span>
          <select className="select" value={activeTargetType} onChange={(event) => handleTargetTypeChange(event.target.value as FormulaTargetType)}>
            {Object.entries(targetTypeLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="stack">
          <span className="muted">식</span>
          <textarea className="textarea" value={lastExpression} onChange={(event) => setLastExpression(event.target.value)} />
        </label>
        <label className="stack">
          <span className="muted">테스트용 데이터(JSON)</span>
          <textarea className="textarea" value={sampleContext} onChange={(event) => setSampleContext(event.target.value)} />
        </label>
        <button className="button primary" onClick={handleEvaluate}>
          식 테스트
        </button>
        <div className="panel stack">
          <strong>결과</strong>
          <pre>{lastResult || "여기에 계산 결과가 표시됩니다."}</pre>
        </div>

        <div className="section-title">
          <strong>이 식 저장하기</strong>
        </div>
        <input className="field" placeholder="예: 메모 있는 일정 표시" value={ruleName} onChange={(event) => setRuleName(event.target.value)} />
        <textarea
          className="textarea"
          placeholder="이 규칙이 무엇을 하는지 쉬운 말로 적어 두세요."
          value={ruleDescription}
          onChange={(event) => setRuleDescription(event.target.value)}
        />
        <div className="dense-grid">
          <label className="stack">
            <span className="muted">결과 종류</span>
            <select className="select" value={returnType} onChange={(event) => setReturnType(event.target.value as FormulaReturnType)}>
              {Object.entries(returnTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="stack">
            <span className="muted">계산 시점</span>
            <select className="select" value={evaluationMode} onChange={(event) => setEvaluationMode(event.target.value as FormulaEvaluationMode)}>
              {Object.entries(evaluationModeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button className="button primary" onClick={handleSaveRule}>
          규칙 저장
        </button>
        <div className="muted">{message}</div>

        <div className="list scroll-panel">
          {rules.map((rule) => (
            <div key={rule.id} className="list-item">
              <div className="section-title">
                <strong>{rule.name}</strong>
                <span className="badge">{targetTypeLabels[rule.targetType as FormulaTargetType]}</span>
              </div>
              <div className="muted">{rule.description || "설명 없음"}</div>
              <pre>{rule.expression}</pre>
              <div className="muted">
                결과: {returnTypeLabels[rule.returnType as FormulaReturnType]} / 계산 시점: {evaluationModeLabels[rule.evaluationMode as FormulaEvaluationMode]}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
