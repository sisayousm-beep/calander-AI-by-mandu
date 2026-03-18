import { z } from "zod";
import { entityTypes, formulaEvaluationModes, formulaReturnTypes } from "@shared/constants/enums";

export const formulaTargetTypes = [...entityTypes, "global"] as const;

export const formulaRuleInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().default(""),
  targetType: z.enum(formulaTargetTypes),
  returnType: z.enum(formulaReturnTypes),
  expression: z.string().trim().min(1).max(500),
  evaluationMode: z.enum(formulaEvaluationModes).default("manual"),
});

export const formulaRuleRecordSchema = formulaRuleInputSchema.extend({
  id: z.string(),
  isActive: z.boolean().default(true),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type FormulaRuleInput = z.infer<typeof formulaRuleInputSchema>;
export type FormulaRuleRecord = z.infer<typeof formulaRuleRecordSchema>;
