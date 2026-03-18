import { useEffect, useState } from "react";
import type { FormulaRuleRecord } from "@shared/schemas/formula";
import { useFormulaStore } from "@renderer/stores/useFormulaStore";

const supportedFunctions = [
  "isDone()",
  "and(a, b, ...)",
  "if(condition, trueValue, falseValue)",
  "eq(a, b)",
  "gt(a, b)",
  "randomInt(min, max)",
  "daysUntil(date)",
  "contains(text, needle)",
];

export function FunctionsScreen(): JSX.Element {
  const { activeTargetType, sampleContext, lastExpression, lastResult, setActiveTargetType, setSampleContext, setLastExpression, setLastResult } = useFormulaStore();
  const [rules, setRules] = useState<FormulaRuleRecord[]>([]);
  const [ruleName, setRuleName] = useState("");
  const [ruleDescription, setRuleDescription] = useState("");
  const [returnType, setReturnType] = useState<"boolean" | "number" | "string">("boolean");
  const [evaluationMode, setEvaluationMode] = useState<"manual" | "live">("manual");
  const [message, setMessage] = useState("함수 엔진은 안전한 parser 기반으로 동작합니다.");

  useEffect(() => {
    void refreshRules();
  }, []);

  const refreshRules = async () => {
    const { items } = await window.calendarApi.formula.listRules();
    setRules(items);
  };

  const handleEvaluate = async () => {
    try {
      const context = JSON.parse(sampleContext) as Record<string, unknown>;
      const result = await window.calendarApi.formula.evaluate(lastExpression, activeTargetType, context);
      setLastResult(result.ok ? JSON.stringify(result.result, null, 2) : result.error ?? "실패");
    } catch (error) {
      setLastResult(error instanceof Error ? error.message : "평가 실패");
    }
  };

  const handleSaveRule = async () => {
    await window.calendarApi.formula.saveRule({
      name: ruleName,
      description: ruleDescription,
      targetType: activeTargetType as "event" | "note" | "annotation" | "global",
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
          <strong>지원 함수</strong>
        </div>
        <div className="list">
          {supportedFunctions.map((item) => (
            <div key={item} className="list-item">
              {item}
            </div>
          ))}
        </div>
      </div>

      <div className="panel stack">
        <div className="section-title">
          <strong>표현식 테스트</strong>
        </div>
        <select className="select" value={activeTargetType} onChange={(event) => setActiveTargetType(event.target.value)}>
          <option value="event">event</option>
          <option value="note">note</option>
          <option value="annotation">annotation</option>
          <option value="global">global</option>
        </select>
        <input className="field" value={lastExpression} onChange={(event) => setLastExpression(event.target.value)} />
        <textarea className="textarea" value={sampleContext} onChange={(event) => setSampleContext(event.target.value)} />
        <button className="button primary" onClick={handleEvaluate}>
          평가
        </button>
        <div className="panel">
          <strong>결과</strong>
          <pre>{lastResult}</pre>
        </div>
      </div>

      <div className="panel stack">
        <div className="section-title">
          <strong>규칙 저장</strong>
        </div>
        <input className="field" placeholder="규칙 이름" value={ruleName} onChange={(event) => setRuleName(event.target.value)} />
        <textarea className="textarea" placeholder="설명" value={ruleDescription} onChange={(event) => setRuleDescription(event.target.value)} />
        <div className="dense-grid">
          <select className="select" value={returnType} onChange={(event) => setReturnType(event.target.value as "boolean" | "number" | "string")}>
            <option value="boolean">boolean</option>
            <option value="number">number</option>
            <option value="string">string</option>
          </select>
          <select className="select" value={evaluationMode} onChange={(event) => setEvaluationMode(event.target.value as "manual" | "live")}>
            <option value="manual">manual</option>
            <option value="live">live</option>
          </select>
        </div>
        <button className="button primary" onClick={handleSaveRule}>
          규칙 저장
        </button>
        <div className="muted">{message}</div>
        <div className="list scroll-panel">
          {rules.map((rule) => (
            <div key={rule.id} className="list-item">
              <strong>{rule.name}</strong>
              <div className="muted">{rule.expression}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
