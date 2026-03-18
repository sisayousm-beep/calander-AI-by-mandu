import { z } from "zod";
import { recurrenceFrequencies } from "@shared/constants/enums";

export const aiCandidateSchema = z.object({
  title: z.string().trim().min(1),
  description: z.string().default(""),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
  allDay: z.boolean(),
  recurrence: z.object({
    frequency: z.enum(recurrenceFrequencies),
    interval: z.number().int().min(1),
    daysOfWeek: z.array(z.number().int().min(1).max(7)),
    dayOfMonth: z.number().int().min(1).max(31).nullable(),
    monthOfYear: z.number().int().min(1).max(12).nullable(),
    untilDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
    count: z.number().int().min(1).nullable(),
  }),
  tags: z.array(z.string()).default([]),
  noteDrafts: z
    .array(
      z.object({
        title: z.string().trim().min(1),
        content: z.string().default(""),
      }),
    )
    .default([]),
  confidence: z.number().min(0).max(1),
  ambiguityFlags: z.array(z.string()).default([]),
  questions: z.array(z.string()).default([]),
});

export const aiParsedResultSchema = z.object({
  summary: z.string(),
  candidates: z.array(aiCandidateSchema).default([]),
  unresolved: z.array(z.string()).default([]),
});

export type AiCandidate = z.infer<typeof aiCandidateSchema>;
export type AiParsedResult = z.infer<typeof aiParsedResultSchema>;
