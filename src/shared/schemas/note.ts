import { z } from "zod";

export const noteInputSchema = z.object({
  title: z.string().trim().min(1).max(120),
  content: z.string().default(""),
  linkedEventIds: z.array(z.string()).default([]),
});

export const noteRecordSchema = z.object({
  id: z.string(),
  title: z.string().trim().min(1).max(120),
  content: z.string().default(""),
  contentFormat: z.string().default("plain_with_wikilinks"),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type NoteInput = z.infer<typeof noteInputSchema>;
export type NoteRecord = z.infer<typeof noteRecordSchema>;
