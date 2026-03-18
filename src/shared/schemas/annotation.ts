import { z } from "zod";
import { annotationTargetTypes } from "@shared/constants/enums";

export const annotationInputSchema = z.object({
  targetType: z.enum(annotationTargetTypes),
  targetKey: z.string().trim().min(1),
  content: z.string().trim().min(1),
});

export const annotationRecordSchema = annotationInputSchema.extend({
  id: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type AnnotationInput = z.infer<typeof annotationInputSchema>;
export type AnnotationRecord = z.infer<typeof annotationRecordSchema>;
