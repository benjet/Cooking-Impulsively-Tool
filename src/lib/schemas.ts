import { z } from "zod";
import { EXPERIENCE, FEEDBACK_TAGS, GOALS, PAN_TYPES } from "./options";

export const extractRequestSchema = z.object({
  url: z.string().url(),
});

export const extractedRecipeSchema = z.object({
  title: z.string().min(1),
  sourceName: z.string().nullable(),
  sourceUrl: z.string().nullable(),
  yieldText: z.string().nullable(),
  ingredients: z.array(z.string().min(1)).min(1),
  instructions: z.array(z.string().min(1)).min(1),
});

export const cookingContextSchema = z.object({
  panType: z.enum(PAN_TYPES),
  experience: z.enum(EXPERIENCE),
  goal: z.enum(GOALS),
  userNotes: z.string().max(2000).optional(),
});

export const generateRequestSchema = z.object({
  recipe: extractedRecipeSchema,
  context: cookingContextSchema,
});

export const feedbackRequestSchema = z.object({
  cardSlug: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  tags: z.array(z.enum(FEEDBACK_TAGS)).default([]),
  actualTempF: z.number().int().min(50).max(700).optional(),
  stepIndex: z.number().int().min(0).optional(),
  ingredientIndex: z.number().int().min(0).optional(),
  technique: z.string().max(120).optional(),
  notes: z.string().max(2000).optional(),
});

export type ExtractRequest = z.infer<typeof extractRequestSchema>;
export type GenerateRequest = z.infer<typeof generateRequestSchema>;
export type FeedbackRequest = z.infer<typeof feedbackRequestSchema>;
