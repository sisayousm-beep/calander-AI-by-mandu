import { useEffect, useState } from "react";
import type { FormulaRuleRecord } from "@shared/schemas/formula";
import { waitForCalendarApi } from "@renderer/lib/calendarApi";
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
    title: "Team sync",
    startAt: "2026-03-03T09:00:00.000Z",
    endAt: "2026-03-03T10:00:00.000Z",
    occurrenceDate: "2026-03-17",
    noteCount: 1,
    linkCount: 1,
    tags: ["important"],
    allDay: false,
    isRecurring: true,
    totalRecurrenceCount: 12,
    currentRecurrenceCount: 3,
    recurrence: {
      frequency: "weekly",
      interval: 1,
      daysOfWeek: [2],
      dayOfMonth: null,
      monthOfYear: null,
      untilDate: null,
      count: 12,
    },
    durationMinutes: 60,
  },
  note: {
    title: "Meeting notes",
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
    title: "상태와 연결 확인",
    description: "일정의 현재 상태나 메모 연결 여부처럼 바로 확인하고 싶은 정보를 찾을 때 씁니다.",
    blocks: [
      { label: "완료 상태 확인", description: "현재 일정이 완료인지 확인합니다.", expression: "isDone()", targetType: "event" },
      { label: "메모 연결 확인", description: "메모가 하나 이상 붙었는지 확인합니다.", expression: "hasMemo()", targetType: "event" },
      { label: "기한 초과 확인", description: "끝날 시간이 지났는지 확인합니다.", expression: "isOverdue()", targetType: "event" },
    ],
    items: [
      {
        signature: "isDone()",
        aliases: ["완료됨()", "완료인가()"],
        summary: "현재 일정이 완료 상태인지 확인합니다.",
        parameterDomain: "입력값 없음. 현재 일정의 상태를 직접 읽습니다.",
        codomain: "참/거짓(Boolean)",
        range: "`true` 또는 `false`",
        description: "상태가 `완료`일 때만 `true`를 돌려줍니다. 완료된 일정만 따로 모으고 싶을 때 가장 먼저 쓰는 함수입니다.",
        example: "isDone()",
      },
      {
        signature: "isPlanned(), isInProgress(), isPaused(), isCancelled()",
        aliases: ["예정됨()", "진행중()", "보류중()", "취소됨()", "예정인가()", "진행중인가()", "보류인가()", "취소인가()"],
        summary: "현재 일정이 어떤 상태인지 바로 확인합니다.",
        parameterDomain: "입력값 없음. 현재 일정의 상태를 읽습니다.",
        codomain: "참/거짓(Boolean)",
        range: "`true` 또는 `false`",
        description: "예정, 진행 중, 보류, 취소 중 원하는 상태를 바로 검사합니다. 예를 들어 지금 처리 중인 일정만 보고 싶다면 `isInProgress()`를 쓰면 됩니다.",
        example: "isInProgress()",
      },
      {
        signature: "isOverdue()",
        aliases: ["기한지남()", "마감지남()"],
        summary: "끝나는 시간이 지났는데 아직 닫히지 않은 일정인지 확인합니다.",
        parameterDomain: "입력값 없음. 현재 일정의 `endAt`과 `status`를 읽습니다.",
        codomain: "참/거짓(Boolean)",
        range: "`true` 또는 `false`",
        description: "기한이 지난 할 일을 찾을 때 씁니다. 이미 `완료`되었거나 `취소`된 일정은 자동으로 제외합니다.",
        example: "isOverdue()",
      },
      {
        signature: "hasMemo(), hasLinks(), hasTag(name), isAllDay(), isRecurring()",
        aliases: ["메모있음()", "연결있음()", "태그있음(태그이름)", "하루종일()", "반복됨()", "링크있음()", "하루종일인가()", "반복인가()"],
        summary: "메모, 연결, 태그, 하루 종일 여부, 반복 여부를 확인합니다.",
        parameterDomain: "`hasTag(name)`만 글자 1개를 받고, 나머지는 입력값이 없습니다.",
        codomain: "참/거짓(Boolean)",
        range: "`true` 또는 `false`",
        description: "일정에 메모가 붙었는지, 다른 메모나 일정과 연결되었는지, 반복 일정인지 같은 구조 정보를 확인할 때 씁니다.",
        example: "and(hasMemo(), hasTag('important'))",
      },
    ],
  },
  {
    id: "recurrence",
    title: "반복 정보",
    description: "반복 일정의 전체 회차와 현재 보고 있는 회차 순번을 숫자로 확인할 때 씁니다.",
    blocks: [
      { label: "총 반복 횟수 보기", description: "시리즈 전체가 몇 번 반복되는지 봅니다.", expression: "totalRecurrenceCount()", targetType: "event" },
      { label: "현재 반복 순번 보기", description: "지금 보고 있는 회차가 몇 번째인지 봅니다.", expression: "currentRecurrenceCount()", targetType: "event" },
      {
        label: "마지막 회차인지 확인",
        description: "현재 회차가 마지막 회차와 같은지 비교합니다.",
        expression: "eq(currentRecurrenceCount(), totalRecurrenceCount())",
        targetType: "event",
      },
    ],
    items: [
      {
        signature: "totalRecurrenceCount()",
        aliases: [],
        summary: "반복 일정이 전체적으로 몇 회차까지 이어지는지 숫자로 돌려줍니다.",
        parameterDomain: "입력값 없음. 현재 일정의 `recurrence.count`, `recurrence.untilDate`, `totalRecurrenceCount` 문맥을 읽습니다.",
        codomain: "숫자(Number)",
        range: "0 이상의 정수. 반복이 아니거나 종료 정보가 없으면 `0`",
        description:
          "반복 횟수가 직접 정해져 있으면 그 값을 그대로 돌려줍니다. 종료일만 있는 반복은 종료일까지 실제 발생하는 회차 수를 계산합니다. 끝이 정해지지 않은 반복은 총횟수를 알 수 없으므로 `0`을 돌려줍니다.",
        example: "totalRecurrenceCount()",
      },
      {
        signature: "currentRecurrenceCount()",
        aliases: [],
        summary: "현재 보고 있는 반복 회차가 시리즈에서 몇 번째인지 숫자로 돌려줍니다.",
        parameterDomain: "입력값 없음. 현재 일정의 `occurrenceDate`, `startAt`, `currentRecurrenceCount` 문맥을 읽습니다.",
        codomain: "숫자(Number)",
        range: "0 이상의 정수. 반복이 아니면 `0`, 반복 시리즈 본체는 보통 `1`부터 시작",
        description:
          "특정 반복 회차를 보고 있다면 첫 회차를 `1`로 하여 현재 순번을 계산합니다. 이미 `currentRecurrenceCount` 값이 문맥에 있으면 그 값을 우선 사용하고, 없으면 반복 규칙과 발생 날짜를 바탕으로 계산합니다.",
        example: "currentRecurrenceCount()",
      },
    ],
  },
  {
    id: "logic",
    title: "조건 묶기",
    description: "조건 여러 개를 함께 묶거나, 조건에 따라 다른 결과를 내고 싶을 때 쓰는 함수입니다.",
    blocks: [
      { label: "둘 다 맞아야 함", description: "조건이 모두 참일 때만 참입니다.", expression: "and(hasMemo(), not(isDone()))", targetType: "event" },
      { label: "하나만 맞아도 됨", description: "하나라도 참이면 참입니다.", expression: "or(isDone(), isCancelled())", targetType: "event" },
      { label: "조건에 따라 문구 바꾸기", description: "조건에 따라 다른 값을 냅니다.", expression: "if(isDone(), '완료', '진행 필요')", targetType: "event" },
    ],
    items: [
      {
        signature: "and(condition1, condition2, ...)",
        aliases: ["모두참(조건1, 조건2, ...)", "그리고(조건1, 조건2, ...)"],
        summary: "입력한 조건이 모두 참일 때만 참을 돌려줍니다.",
        parameterDomain: "참/거짓으로 계산될 수 있는 값 2개 이상",
        codomain: "참/거짓(Boolean)",
        range: "`true` 또는 `false`",
        description: "체크리스트처럼 여러 조건을 한 번에 묶고 싶을 때 씁니다. 하나라도 거짓이면 결과는 거짓입니다.",
        example: "and(hasMemo(), not(isDone()))",
      },
      {
        signature: "or(condition1, condition2, ...)",
        aliases: ["하나라도참(조건1, 조건2, ...)", "또는(조건1, 조건2, ...)"],
        summary: "입력한 조건 중 하나라도 참이면 참을 돌려줍니다.",
        parameterDomain: "참/거짓으로 계산될 수 있는 값 2개 이상",
        codomain: "참/거짓(Boolean)",
        range: "`true` 또는 `false`",
        description: "여러 상태 중 하나만 맞아도 되는 넓은 조건을 만들 때 편합니다.",
        example: "or(isDone(), isCancelled())",
      },
      {
        signature: "not(value)",
        aliases: ["아님(값)", "아니다(값)"],
        summary: "참은 거짓으로, 거짓은 참으로 뒤집습니다.",
        parameterDomain: "참/거짓으로 계산될 수 있는 값 1개",
        codomain: "참/거짓(Boolean)",
        range: "`true` 또는 `false`",
        description: "완료되지 않은 일정처럼 '아닌 것'을 찾고 싶을 때 씁니다.",
        example: "not(isDone())",
      },
      {
        signature: "if(condition, trueValue, falseValue)",
        aliases: ["조건선택(조건식, 참일때값, 거짓일때값)", "조건(조건식, 참일때값, 거짓일때값)"],
        summary: "조건이 맞으면 두 번째 값, 아니면 세 번째 값을 돌려줍니다.",
        parameterDomain: "첫 번째는 참/거짓 값 1개, 두 번째와 세 번째는 같은 종류의 값 2개",
        codomain: "숫자(Number), 글자(String), 참/거짓(Boolean) 중 하나",
        range: "입력한 두 후보 값 중 하나",
        description: "문구 라벨, 점수, 상태 표시처럼 조건에 따라 다른 결과를 만들 때 씁니다.",
        example: "if(isOverdue(), '긴급', '일반')",
      },
    ],
  },
  {
    id: "compare",
    title: "비교와 숫자",
    description: "값을 서로 비교하거나 숫자를 다듬어 점수처럼 쓰고 싶을 때 쓰는 함수입니다.",
    blocks: [
      { label: "메모가 1개 이상인지", description: "숫자를 비교합니다.", expression: "gte(noteCount, 1)", targetType: "event" },
      { label: "큰 값 고르기", description: "둘 중 더 큰 값을 고릅니다.", expression: "max(noteCount, linkCount)", targetType: "event" },
      { label: "소수 반올림", description: "보기에 좋게 숫자를 정리합니다.", expression: "round(3.6)", targetType: "global" },
    ],
    items: [
      {
        signature: "eq(a, b), neq(a, b)",
        aliases: ["같음(a, b)", "다름(a, b)", "같다(a, b)", "다르다(a, b)"],
        summary: "두 값이 같은지 또는 다른지 확인합니다.",
        parameterDomain: "비교 가능한 값 2개",
        codomain: "참/거짓(Boolean)",
        range: "`true` 또는 `false`",
        description: "상태 이름, 태그 이름, 고정 문구처럼 정확히 일치하는지 확인할 때 적합합니다.",
        example: "eq(status, '예정')",
      },
      {
        signature: "gt(a, b), gte(a, b), lt(a, b), lte(a, b)",
        aliases: ["큼(a, b)", "크거나같음(a, b)", "작음(a, b)", "작거나같음(a, b)", "크다(a, b)", "크거나같다(a, b)", "작다(a, b)", "작거나같다(a, b)"],
        summary: "두 숫자를 비교해서 크고 작음을 판단합니다.",
        parameterDomain: "숫자로 바꿀 수 있는 값 2개",
        codomain: "참/거짓(Boolean)",
        range: "`true` 또는 `false`",
        description: "메모 수, 링크 수, 날짜 차이처럼 수치 결과를 비교할 때 씁니다.",
        example: "gt(durationMinutes, 90)",
      },
      {
        signature: "min(...), max(...), abs(x), round(x), floor(x), ceil(x)",
        aliases: ["최소값(...)", "최대값(...)", "절댓값(x)", "반올림(x)", "내림(x)", "올림(x)", "최소(...)", "최대(...)", "절대값(x)", "버림(x)"],
        summary: "숫자를 고르거나 다듬습니다.",
        parameterDomain: "숫자로 바꿀 수 있는 값 1개 이상",
        codomain: "숫자(Number)",
        range: "입력 숫자를 바탕으로 계산된 정수 또는 실수",
        description: "점수 계산이나 길이 계산 결과를 깔끔하게 정리할 때 유용합니다.",
        example: "max(noteCount, linkCount)",
      },
    ],
  },
  {
    id: "date",
    title: "날짜와 시간",
    description: "오늘 기준 남은 일수, 요일, 날짜 차이를 계산할 때 쓰는 함수입니다.",
    blocks: [
      { label: "마감까지 남은 일수", description: "오늘 기준 남은 날짜 수를 셉니다.", expression: "daysUntil(endAt)", targetType: "event" },
      { label: "요일 번호 확인", description: "월요일은 1, 일요일은 7입니다.", expression: "dayOfWeek(startAt)", targetType: "event" },
      { label: "3일 뒤 날짜 만들기", description: "날짜에 일수를 더합니다.", expression: "addDays(today(), 3)", targetType: "global" },
    ],
    items: [
      {
        signature: "today(), now()",
        aliases: ["오늘날짜()", "현재시각()", "오늘()", "지금()"],
        summary: "현재 날짜나 현재 시각을 가져옵니다.",
        parameterDomain: "입력값 없음",
        codomain: "글자(String)",
        range: "`YYYY-MM-DD` 형식 날짜 또는 ISO 시각 문자열",
        description: "다른 날짜 계산의 기준점을 만들 때 자주 씁니다.",
        example: "today()",
      },
      {
        signature: "dayOfWeek(date)",
        aliases: ["요일번호(날짜)"],
        summary: "입력한 날짜가 무슨 요일인지 숫자로 알려줍니다.",
        parameterDomain: "날짜 또는 시각 문자열 1개",
        codomain: "숫자(Number)",
        range: "1부터 7 사이 정수. 월요일=1, 일요일=7",
        description: "주간 규칙이나 요일별 필터를 만들 때 유용합니다.",
        example: "dayOfWeek(startAt)",
      },
      {
        signature: "addDays(date, value)",
        aliases: ["날짜더하기(날짜, 일수)"],
        summary: "기준 날짜에 원하는 날짜 수를 더합니다.",
        parameterDomain: "날짜 문자열 1개, 숫자 1개",
        codomain: "글자(String)",
        range: "ISO 형식 날짜/시각 문자열",
        description: "오늘부터 며칠 뒤의 시험용 날짜를 만들거나 비교 기준을 옮길 때 씁니다.",
        example: "addDays(today(), 7)",
      },
      {
        signature: "diffDays(a, b), daysUntil(date), daysSince(date)",
        aliases: ["날짜차이(a, b)", "남은일수(날짜)", "지난일수(날짜)"],
        summary: "두 날짜 차이 또는 오늘 기준 남은/지난 일수를 계산합니다.",
        parameterDomain: "날짜 또는 시각 문자열 1개 이상",
        codomain: "숫자(Number)",
        range: "음수, 0, 양수를 포함한 정수",
        description: "마감까지 몇 일 남았는지, 시작한 지 몇 일이 지났는지 계산할 때 씁니다.",
        example: "daysUntil(endAt)",
      },
    ],
  },
  {
    id: "text",
    title: "글자 확인",
    description: "제목이나 메모 본문 속 단어를 찾거나 길이를 재고 싶을 때 쓰는 함수입니다.",
    blocks: [
      { label: "제목에 '회의' 포함", description: "단어 포함 여부를 확인합니다.", expression: "contains(title, '회의')", targetType: "event" },
      { label: "메모가 TODO로 시작", description: "앞부분 글자를 확인합니다.", expression: "startsWith(content, 'TODO')", targetType: "note" },
      { label: "제목 길이 재기", description: "글자 수를 계산합니다.", expression: "length(title)", targetType: "event" },
    ],
    items: [
      {
        signature: "contains(text, needle)",
        aliases: ["포함함(문장, 찾을말)", "포함(문장, 찾을말)"],
        summary: "문장 안에 특정 단어가 들어 있는지 확인합니다.",
        parameterDomain: "글자(String) 2개",
        codomain: "참/거짓(Boolean)",
        range: "`true` 또는 `false`",
        description: "회의, 긴급, TODO 같은 단어를 찾을 때 씁니다.",
        example: "contains(title, '긴급')",
      },
      {
        signature: "startsWith(text, prefix), endsWith(text, suffix)",
        aliases: ["시작일치(문장, 앞글자)", "끝일치(문장, 끝글자)", "시작문자인가()", "끝문자인가()"],
        summary: "문장이 특정 글자로 시작하거나 끝나는지 확인합니다.",
        parameterDomain: "글자(String) 2개",
        codomain: "참/거짓(Boolean)",
        range: "`true` 또는 `false`",
        description: "문서 형식이나 접두어/접미어 규칙을 검사할 때 유용합니다.",
        example: "startsWith(content, 'TODO')",
      },
      {
        signature: "length(text)",
        aliases: ["글자길이(문장)", "글자수(문장)"],
        summary: "문장의 길이를 숫자로 계산합니다.",
        parameterDomain: "글자(String) 1개",
        codomain: "숫자(Number)",
        range: "0 이상의 정수",
        description: "제목이 너무 긴지 확인하거나 길이에 따라 점수를 만들 때 씁니다.",
        example: "length(title)",
      },
    ],
  },
  {
    id: "random",
    title: "무작위 테스트",
    description: "테스트용으로 무작위 값을 만들 때 쓰는 함수입니다. 실시간 규칙에서는 피하는 것이 안전합니다.",
    blocks: [
      { label: "1~3 중 하나 뽑기", description: "범위 안에서 임의의 정수를 고릅니다.", expression: "randomInt(1, 3)", targetType: "global" },
      { label: "참/거짓 무작위", description: "동전 던지기처럼 결과를 냅니다.", expression: "randomBool()", targetType: "global" },
    ],
    items: [
      {
        signature: "random(), randomBool(), randomInt(min, max)",
        aliases: ["무작위값()", "무작위참거짓()", "무작위정수(최소, 최대)", "무작위()"],
        summary: "무작위 실수, 참/거짓, 정수를 만듭니다.",
        parameterDomain: "`random()`과 `randomBool()`은 입력값 없음, `randomInt()`는 숫자 2개",
        codomain: "숫자(Number) 또는 참/거짓(Boolean)",
        range: "`random()`은 0 이상 1 미만 실수, `randomBool()`은 `true/false`, `randomInt()`는 최소~최대 사이 정수",
        description: "테스트용으로는 편하지만 결과가 계속 바뀌므로 `live` 규칙에서는 저장을 막고 있습니다.",
        example: "randomInt(1, 5)",
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
  const [message, setMessage] = useState("함수 목록에서 예시를 누르면 영어 함수식이 입력칸에 바로 들어갑니다. 테스트 후 저장하세요.");

  useEffect(() => {
    void refreshRules();
  }, []);

  const refreshRules = async () => {
    const calendarApi = await waitForCalendarApi();
    const { items } = await calendarApi.formula.listRules();
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
      const calendarApi = await waitForCalendarApi();
      const result = await calendarApi.formula.evaluate(lastExpression, activeTargetType, context);
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

    const calendarApi = await waitForCalendarApi();
    await calendarApi.formula.saveRule({
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
    <section className="screen functions-screen">
      <div className="panel function-hero">
        <div className="function-hero-copy">
          <span className="function-kicker">Formula Studio</span>
          <h1>함수 도구</h1>
          <p className="muted">
            영어 함수 이름 기준으로 식을 만들 수 있도록 정리했습니다. 아래 순서대로 보면 비전공자도 규칙을 빠르게 만들 수 있게
            구성해 두었습니다.
          </p>
        </div>
        <div className="function-step-strip">
          <div className="function-step-card">
            <strong>1. 함수 목록</strong>
            <span className="muted">원하는 예시를 눌러 식을 불러옵니다.</span>
          </div>
          <div className="function-step-card">
            <strong>2. 함수 설명서</strong>
            <span className="muted">정의역, 공역, 치역을 보고 의미를 확인합니다.</span>
          </div>
          <div className="function-step-card">
            <strong>3. 규칙 만들기</strong>
            <span className="muted">테스트 후 저장해서 다시 사용할 수 있습니다.</span>
          </div>
        </div>
      </div>

      <div className="panel stack function-panel">
        <div className="section-title">
          <strong>함수 목록</strong>
          <span className="badge">클릭해서 식 넣기</span>
        </div>
        <p className="muted">자주 쓰는 함수들을 카테고리별로 정리했습니다. 각 카드를 누르면 아래 규칙 만들기 영역에 식이 바로 들어갑니다.</p>
        <div className="function-catalog-stack">
          {functionCategories.map((category) => (
            <section key={category.id} className="function-category">
              <div className="section-title">
                <strong>{category.title}</strong>
                <span className="badge">{category.blocks.length}개 예시</span>
              </div>
              <p className="muted">{category.description}</p>
              <div className="helper-grid function-block-grid">
                {category.blocks.map((block) => (
                  <button key={block.label} className="button block-button function-block-button" onClick={() => applyBlock(block)}>
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

      <div className="panel stack function-panel">
        <div className="section-title">
          <strong>함수 설명서</strong>
          <span className="badge">정의역 · 공역 · 치역 포함</span>
        </div>
        <p className="muted">각 함수가 무엇을 받고 무엇을 돌려주는지 헷갈리지 않도록, 입력과 결과를 모두 쉬운 말로 적어 두었습니다.</p>
        <div className="function-doc-stack">
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
                    {item.aliases.length > 0 ? <div className="muted">이전 호환 이름: {item.aliases.join(", ")}</div> : null}
                    <p>{item.summary}</p>
                    <div className="function-meta-grid">
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

      <div className="panel stack function-panel">
        <div className="section-title">
          <strong>규칙 만들기</strong>
          <span className="badge">불러오기 → 테스트 → 저장</span>
        </div>
        <p className="muted">화면 대상과 식을 고른 뒤, 샘플 데이터를 넣어 결과를 먼저 확인하고 저장하세요.</p>

        <label className="stack">
          <span className="muted">어느 화면에서 쓸 규칙인가요?</span>
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
          <textarea className="textarea function-expression" value={lastExpression} onChange={(event) => setLastExpression(event.target.value)} />
        </label>

        <label className="stack">
          <span className="muted">테스트용 데이터(JSON)</span>
          <textarea className="textarea function-sample" value={sampleContext} onChange={(event) => setSampleContext(event.target.value)} />
        </label>

        <button className="button primary" onClick={handleEvaluate}>
          식 테스트
        </button>

        <div className="panel stack function-result-panel">
          <strong>결과</strong>
          <pre>{lastResult || "여기에 계산 결과가 표시됩니다."}</pre>
        </div>

        <div className="section-title">
          <strong>이 식 저장하기</strong>
        </div>

        <input className="field" placeholder="예: 메모가 있는 일정 표시" value={ruleName} onChange={(event) => setRuleName(event.target.value)} />
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

        <div className="stack">
          <div className="section-title">
            <strong>저장된 규칙</strong>
            <span className="badge">{rules.length}개</span>
          </div>
          <div className="list">
            {rules.map((rule) => (
              <div key={rule.id} className="list-item function-rule-card">
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
            {rules.length === 0 ? (
              <div className="empty-state compact">
                <strong>아직 저장된 규칙이 없습니다.</strong>
                <p className="muted">위에서 식을 테스트한 뒤 저장하면 여기에 누적됩니다.</p>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
