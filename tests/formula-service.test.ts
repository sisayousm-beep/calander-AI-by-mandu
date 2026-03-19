import { describe, expect, it } from "vitest";
import { FormulaService } from "@main/services/FormulaService";

describe("FormulaService", () => {
  it("evaluates boolean expressions with Korean helper aliases", () => {
    const service = new FormulaService({} as never);
    const result = service.evaluate("그리고(메모있음(), 아니다(완료인가()))", "event", {
      status: "예정",
      noteCount: 1,
      linkCount: 0,
      tags: ["중요"],
    });

    expect(result.ok).toBe(true);
    expect(result.result).toBe(true);
  });

  it("returns an error for invalid expressions", () => {
    const service = new FormulaService({} as never);
    const result = service.evaluate("그리고(", "event", {});

    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
  });
});
